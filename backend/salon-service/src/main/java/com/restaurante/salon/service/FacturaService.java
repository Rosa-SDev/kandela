package com.restaurante.salon.service;

import com.restaurante.salon.dto.EmitirFacturaDTO;
import com.restaurante.salon.exception.ConflictoException;
import com.restaurante.salon.exception.NoEncontradoException;
import com.restaurante.salon.model.EstadoPedido;
import com.restaurante.salon.model.Factura;
import com.restaurante.salon.model.Pedido;
import com.restaurante.salon.repository.FacturaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

/**
 * Reglas de negocio para la emisión y anulación de facturas.
 */
@Service
public class FacturaService {

    private final FacturaRepository facturaRepository;
    private final PedidoService pedidoService;
    private final com.restaurante.salon.cliente.UsuariosClient usuariosClient;

    public FacturaService(FacturaRepository facturaRepository, 
                          PedidoService pedidoService,
                          com.restaurante.salon.cliente.UsuariosClient usuariosClient) {
        this.facturaRepository = facturaRepository;
        this.pedidoService = pedidoService;
        this.usuariosClient = usuariosClient;
    }

    /**
     * Emite la factura y orquesta el cobro del pedido.
     *
     * Orden de ejecución:
     * 1. Validar: pedido no cancelado, con platillos, sin factura previa vigente.
     * 2. Crear la factura y llamar a emitir() para calcular impuestos y total.
     * 3. Comprobar que el monto entregado cubra el total CON impuestos.
     * 4. Guardar factura, registrar pago y cerrar el pedido (libera la mesa).
     */
    @Transactional
    public Factura emitirFactura(EmitirFacturaDTO dto) {
        com.restaurante.salon.cliente.UsuarioRemoto cajero = usuariosClient.obtener(dto.cajeroId());
        if (cajero == null) {
            throw new NoEncontradoException("El usuario " + dto.cajeroId() + " no existe.");
        }
        if (!"CAJERO".equals(cajero.rol())) {
            throw new ConflictoException(cajero.nombre() + " no es cajero.");
        }
        if (!Boolean.TRUE.equals(cajero.activo())) {
            throw new ConflictoException(cajero.nombre() + " está inactivo.");
        }

        Pedido pedido = pedidoService.buscarPorId(dto.pedidoId());

        if (pedido.getEstado() == EstadoPedido.CANCELADO) {
            throw new ConflictoException("No se puede facturar un pedido cancelado.");
        }
        if (pedido.getPlatillos().isEmpty()) {
            throw new ConflictoException("No se puede facturar un pedido sin platillos.");
        }

        Optional<Factura> vigente = facturaRepository.findByPedidoIdAndAnuladaFalse(pedido.getId());
        if (vigente.isPresent()) {
            throw new ConflictoException("El pedido " + pedido.getId()
                    + " ya tiene la factura " + vigente.get().getNumero() + ".");
        }

        long consecutivo = facturaRepository.findMaxId() + 1;
        String numero = String.format("F-%04d", consecutivo);

        Factura factura = new Factura(numero, pedido, dto.cajeroId());
        factura.emitir();

        if (dto.monto().compareTo(factura.getTotal()) < 0) {
            throw new ConflictoException("El monto no cubre el total de la factura ($"
                    + factura.getTotal() + ").");
        }

        factura = facturaRepository.save(factura);

        pedido.registrarPago(dto.metodoPago(), dto.monto());
        if (pedido.getEstado() != EstadoPedido.PAGADO) {
            pedidoService.cerrar(pedido);
        }

        return factura;
    }

    @Transactional(readOnly = true)
    public List<Factura> listar() {
        return facturaRepository.findAllConPedido();
    }

    @Transactional(readOnly = true)
    public Factura buscarPorId(Long id) {
        return facturaRepository.findByIdConPedido(id)
                .orElseThrow(() -> new NoEncontradoException("La factura " + id + " no existe."));
    }

    /**
     * Anula contablemente la factura sin eliminarla ni cancelar el pedido.
     */
    @Transactional
    public Factura anularFactura(Long id) {
        Factura factura = buscarPorId(id);

        if (factura.isAnulada()) {
            throw new ConflictoException("La factura " + factura.getNumero() + " ya está anulada.");
        }

        factura.anular();
        return facturaRepository.save(factura);
    }
}
