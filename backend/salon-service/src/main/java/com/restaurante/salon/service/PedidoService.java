package com.restaurante.salon.service;

import com.restaurante.salon.cliente.CartaClient;
import com.restaurante.salon.cliente.PlatilloRemoto;
import com.restaurante.salon.cliente.UsuarioRemoto;
import com.restaurante.salon.cliente.UsuariosClient;
import com.restaurante.salon.contador.GeneradorDeIds;
import com.restaurante.salon.dto.AgregarPlatilloDTO;
import com.restaurante.salon.dto.CrearPedidoDTO;
import com.restaurante.salon.exception.ConflictoException;
import com.restaurante.salon.exception.NoEncontradoException;
import com.restaurante.salon.model.EstadoMesa;
import com.restaurante.salon.model.EstadoPedido;
import com.restaurante.salon.model.LineaPedido;
import com.restaurante.salon.model.Mesa;
import com.restaurante.salon.model.Pedido;
import com.restaurante.salon.repository.MesaRepository;
import com.restaurante.salon.repository.PedidoRepository;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Reglas de negocio de los pedidos del restaurante.
 */
@Service
public class PedidoService {

    static final String COLECCION_PEDIDOS = "pedidos";
    static final String COLECCION_LINEAS = "lineas";

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
    private final MesaRepository mesaRepository;
    private final GeneradorDeIds generadorDeIds;
    private final CartaClient cartaClient;
    private final UsuariosClient usuariosClient;

    public PedidoService(PedidoRepository pedidoRepository,
                         MesaRepository mesaRepository,
                         GeneradorDeIds generadorDeIds,
                         CartaClient cartaClient,
                         UsuariosClient usuariosClient) {
        this.pedidoRepository = pedidoRepository;
        this.mesaRepository = mesaRepository;
        this.generadorDeIds = generadorDeIds;
        this.cartaClient = cartaClient;
        this.usuariosClient = usuariosClient;
    }

    /**
     * Da de alta un pedido y ocupa la mesa.
     * Una mesa RESERVADA sí acepta pedido (transición natural a OCUPADA).
     * Una mesa OCUPADA rechaza un nuevo pedido (HTTP 409).
     */
    public Pedido crear(CrearPedidoDTO dto) {
        UsuarioRemoto mesero = usuariosClient.obtener(dto.meseroId());
        if (mesero == null) {
            throw new NoEncontradoException("El usuario " + dto.meseroId() + " no existe.");
        }
        if (!"MESERO".equals(mesero.rol())) {
            throw new ConflictoException(mesero.nombre() + " no es mesero.");
        }
        if (!Boolean.TRUE.equals(mesero.activo())) {
            throw new ConflictoException(mesero.nombre() + " está inactivo.");
        }

        Mesa mesa = buscarMesa(dto.mesaId());

        if (mesa.getEstado() == EstadoMesa.OCUPADA) {
            throw new ConflictoException("La mesa " + mesa.getNumero() + " ya está ocupada por otro pedido.");
        }

        mesa.ocupar();
        mesaRepository.save(mesa);

        Pedido pedido = new Pedido(mesa.getId(), dto.meseroId(), dto.clienteId(), dto.observaciones());
        pedido.asignarId(generadorDeIds.siguiente(COLECCION_PEDIDOS));
        return pedidoRepository.insert(pedido);
    }

    public List<Pedido> listar(EstadoPedido estado) {
        if (estado != null) {
            return pedidoRepository.findByEstado(estado);
        }
        return pedidoRepository.findAll();
    }

    public Pedido buscarPorId(Long id) {
        return pedidoRepository.findById(id)
                .orElseThrow(() -> new NoEncontradoException("El pedido " + id + " no existe."));
    }

    /**
     * Devuelve el número de la mesa asociada a un pedido.
     */
    public Integer numeroDeMesa(Long mesaId) {
        if (mesaId == null) {
            return null;
        }
        return mesaRepository.findById(mesaId)
                .map(Mesa::getNumero)
                .orElse(null);
    }

    /**
     * Carga en una sola consulta los números de las mesas de una lista de pedidos.
     */
    public Map<Long, Integer> numerosDeMesa(List<Pedido> pedidos) {
        Set<Long> mesaIds = pedidos.stream()
                .map(Pedido::getMesaId)
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        if (mesaIds.isEmpty()) {
            return Map.of();
        }
        return mesaRepository.findAllById(mesaIds).stream()
                .collect(Collectors.toMap(Mesa::getId, Mesa::getNumero));
    }

    /**
     * Cambia la nota del pedido.
     *
     * Solo se permite mientras el pedido sigue abierto: en cuanto sale hacia
     * la cocina, lo que diga la nota ya está en manos de quien cocina.
     */
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
    public Pedido agregarPlatillo(Long id, AgregarPlatilloDTO dto) {
        Pedido pedido = buscarPorId(id);

        if (pedido.getEstado() != EstadoPedido.ABIERTO) {
            throw new ConflictoException("Solo se pueden agregar platillos a un pedido abierto.");
        }

        PlatilloRemoto platillo = cartaClient.obtener(dto.platilloId());
        if (!platillo.disponible()) {
            throw new ConflictoException("El platillo " + platillo.nombre() + " está agotado.");
        }

        LineaPedido linea = new LineaPedido(dto.platilloId(), platillo.nombre(), platillo.precio());
        linea.asignarId(generadorDeIds.siguiente(COLECCION_LINEAS));
        pedido.agregarPlatillo(linea);

        return pedidoRepository.save(pedido);
    }

    /**
     * Quita una sola unidad/línea de platillo del pedido.
     */
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
     * Cancelar libera la mesa y la guarda explícitamente en MongoDB.
     */
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
            liberarMesa(pedido.getMesaId());
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
     * Cierra el pedido y libera su mesa explícitamente en MongoDB. Requiere que esté pagado.
     */
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
        Pedido guardado = pedidoRepository.save(pedido);
        liberarMesa(pedido.getMesaId());
        return guardado;
    }

    private Mesa buscarMesa(Long mesaId) {
        return mesaRepository.findById(mesaId)
                .orElseThrow(() -> new NoEncontradoException("La mesa " + mesaId + " no existe."));
    }

    private void liberarMesa(Long mesaId) {
        if (mesaId == null) {
            return;
        }
        Mesa mesa = buscarMesa(mesaId);
        mesa.liberar();
        mesaRepository.save(mesa);
    }
}
