package com.restaurante.salon.service;

import com.restaurante.salon.cliente.CartaClient;
import com.restaurante.salon.cliente.PlatilloRemoto;
import com.restaurante.salon.dto.AgregarPlatilloDTO;
import com.restaurante.salon.dto.CrearPedidoDTO;
import com.restaurante.salon.exception.ConflictoException;
import com.restaurante.salon.exception.NoEncontradoException;
import com.restaurante.salon.model.EstadoMesa;
import com.restaurante.salon.model.EstadoPedido;
import com.restaurante.salon.model.LineaPedido;
import com.restaurante.salon.model.Mesa;
import com.restaurante.salon.model.Pedido;
import com.restaurante.salon.repository.PedidoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Reglas de negocio de los pedidos del restaurante.
 */
@Service
public class PedidoService {

    /**
     * El paso siguiente de cada estado en el recorrido del pedido.
     *
     * Cancelar y pagar no están aquí porque no son pasos del recorrido: se
     * puede cancelar desde cualquier estado no pagado, y a pagado solo se
     * llega emitiendo la factura.
     */
    private static final Map<EstadoPedido, EstadoPedido> PASO_SIGUIENTE = Map.of(
            EstadoPedido.ABIERTO, EstadoPedido.EN_COCINA,
            EstadoPedido.EN_COCINA, EstadoPedido.EN_PREPARACION,
            EstadoPedido.EN_PREPARACION, EstadoPedido.SERVIDO);

    private final PedidoRepository pedidoRepository;
    private final MesaService mesaService;
    private final CartaClient cartaClient;

    public PedidoService(PedidoRepository pedidoRepository,
                         MesaService mesaService,
                         CartaClient cartaClient) {
        this.pedidoRepository = pedidoRepository;
        this.mesaService = mesaService;
        this.cartaClient = cartaClient;
    }

    /**
     * Da de alta un pedido y ocupa la mesa.
     * Una mesa RESERVADA sí acepta pedido (transición natural a OCUPADA).
     * Una mesa OCUPADA rechaza un nuevo pedido (HTTP 409).
     */
    @Transactional
    public Pedido crear(CrearPedidoDTO dto) {
        Mesa mesa = mesaService.buscarPorId(dto.mesaId());

        if (mesa.getEstado() == EstadoMesa.OCUPADA) {
            throw new ConflictoException("La mesa " + mesa.getNumero() + " ya está ocupada por otro pedido.");
        }

        mesa.ocupar();
        Pedido pedido = new Pedido(mesa, dto.meseroId(), dto.clienteId(), dto.observaciones());
        return pedidoRepository.save(pedido);
    }

    @Transactional(readOnly = true)
    public List<Pedido> listar(EstadoPedido estado) {
        if (estado != null) {
            return pedidoRepository.findByEstadoConDetalles(estado);
        }
        return pedidoRepository.findAllConDetalles();
    }

    @Transactional(readOnly = true)
    public Pedido buscarPorId(Long id) {
        return pedidoRepository.findByIdConDetalles(id)
                .orElseThrow(() -> new NoEncontradoException("El pedido " + id + " no existe."));
    }

    /**
     * Cambia la nota del pedido.
     *
     * Solo se permite mientras el pedido sigue abierto: en cuanto sale hacia
     * la cocina, lo que diga la nota ya está en manos de quien cocina.
     */
    @Transactional
    public Pedido cambiarNota(Long id, String observaciones) {
        Pedido pedido = buscarPorId(id);

        if (pedido.getEstado() != EstadoPedido.ABIERTO) {
            throw new ConflictoException("Solo se puede cambiar la nota de un pedido abierto.");
        }

        pedido.setObservaciones(observaciones);
        return pedidoRepository.save(pedido);
    }

    /**
     * Agrega una línea de platillo al pedido.
     *
     * El nombre y el precio se le piden a la carta y se guardan como una copia
     * congelada en la línea: si mañana sube el precio de la bandeja paisa, las
     * cuentas ya tomadas siguen diciendo lo que el cliente aceptó pagar.
     */
    @Transactional
    public Pedido agregarPlatillo(Long id, AgregarPlatilloDTO dto) {
        Pedido pedido = buscarPorId(id);

        if (pedido.getEstado() != EstadoPedido.ABIERTO) {
            throw new ConflictoException("Solo se pueden agregar platillos a un pedido abierto.");
        }

        PlatilloRemoto platillo = cartaClient.obtener(dto.platilloId());
        if (!platillo.disponible()) {
            throw new ConflictoException("El platillo " + platillo.nombre() + " está agotado.");
        }

        LineaPedido linea = new LineaPedido(dto.platilloId(), platillo.nombre(),
                                            platillo.precio(), pedido);
        pedido.agregarPlatillo(linea);

        return pedidoRepository.save(pedido);
    }

    /**
     * Quita una sola unidad/línea de platillo del pedido.
     */
    @Transactional
    public void quitarPlatillo(Long pedidoId, Long lineaId) {
        Pedido pedido = buscarPorId(pedidoId);

        if (pedido.getEstado() != EstadoPedido.ABIERTO) {
            throw new ConflictoException("Solo se pueden quitar platillos de un pedido abierto.");
        }

        boolean removido = pedido.quitarPlatillo(lineaId);
        if (!removido) {
            throw new NoEncontradoException("La línea de platillo " + lineaId + " no existe en este pedido.");
        }

        pedidoRepository.save(pedido);
    }

    /**
     * Mueve el pedido al estado siguiente de su recorrido, o lo cancela.
     *
     * Cancelar libera la mesa.
     */
    @Transactional
    public Pedido cambiarEstado(Long id, EstadoPedido nuevoEstado) {
        Pedido pedido = buscarPorId(id);

        if (pedido.getEstado() == EstadoPedido.CANCELADO) {
            throw new ConflictoException("No se puede modificar un pedido cancelado.");
        }
        if (pedido.getEstado() == EstadoPedido.PAGADO) {
            throw new ConflictoException("No se puede modificar un pedido ya pagado.");
        }

        validarElPaso(pedido.getEstado(), nuevoEstado);

        if (nuevoEstado == EstadoPedido.CANCELADO) {
            pedido.cancelar();
        } else {
            pedido.setEstado(nuevoEstado);
        }

        return pedidoRepository.save(pedido);
    }

    /**
     * Comprueba que el pedido pueda pasar de un estado al otro.
     *
     * Sin esto una comanda podría volver atrás, saltarse la cocina o darse por
     * cobrada sin que exista una factura, y lo que muestra cada pantalla
     * dejaría de corresponder con lo que de verdad pasó en el salón.
     */
    private static void validarElPaso(EstadoPedido actual, EstadoPedido nuevo) {
        if (nuevo == EstadoPedido.CANCELADO) {
            return;
        }
        if (nuevo == EstadoPedido.PAGADO) {
            throw new ConflictoException("Un pedido solo pasa a pagado al emitir su factura.");
        }
        if (PASO_SIGUIENTE.get(actual) != nuevo) {
            throw new ConflictoException("No se puede pasar un pedido de " + actual.nombreLegible()
                    + " a " + nuevo.nombreLegible() + ".");
        }
    }

    /**
     * Cierra el pedido y libera su mesa. Requiere que esté pagado.
     */
    @Transactional
    public Pedido cerrar(Pedido pedido) {
        if (pedido.getEstado() == EstadoPedido.CANCELADO) {
            throw new ConflictoException("No se puede cerrar un pedido cancelado.");
        }
        if (pedido.getEstado() == EstadoPedido.PAGADO) {
            throw new ConflictoException("El pedido ya está cerrado.");
        }
        if (!pedido.estaPagado()) {
            throw new ConflictoException("No se puede cerrar el pedido sin un pago registrado.");
        }

        pedido.cerrar();
        return pedidoRepository.save(pedido);
    }
}
