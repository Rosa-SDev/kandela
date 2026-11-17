package com.restaurante.salon.service;

import com.restaurante.salon.cliente.CartaClient;
import com.restaurante.salon.cliente.UsuarioRemoto;
import com.restaurante.salon.cliente.UsuariosClient;
import com.restaurante.salon.contador.GeneradorDeIds;
import com.restaurante.salon.dto.EmitirFacturaDTO;
import com.restaurante.salon.exception.ConflictoException;
import com.restaurante.salon.model.EstadoMesa;
import com.restaurante.salon.model.EstadoPedido;
import com.restaurante.salon.model.Factura;
import com.restaurante.salon.model.LineaPedido;
import com.restaurante.salon.model.Mesa;
import com.restaurante.salon.model.MetodoPago;
import com.restaurante.salon.model.Pedido;
import com.restaurante.salon.repository.FacturaRepository;
import com.restaurante.salon.repository.MesaRepository;
import com.restaurante.salon.repository.PedidoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Pruebas unitarias de FacturaService con Mockito, sin base de datos.
 *
 * Verifican que emitir una factura guarda los tres documentos afectados:
 * la factura generada, el pedido cerrado en estado PAGADO y la mesa liberada.
 */
@ExtendWith(MockitoExtension.class)
class FacturaServiceTest {

    @Mock
    private FacturaRepository facturaRepository;

    @Mock
    private PedidoRepository pedidoRepository;

    @Mock
    private MesaRepository mesaRepository;

    @Mock
    private GeneradorDeIds generadorDeIds;

    @Mock
    private CartaClient cartaClient;

    @Mock
    private UsuariosClient usuariosClient;

    private FacturaService facturaService;

    @BeforeEach
    void prepararServicios() {
        PedidoService pedidoService = new PedidoService(
                pedidoRepository, mesaRepository, generadorDeIds, cartaClient, usuariosClient);
        facturaService = new FacturaService(
                facturaRepository, pedidoService, generadorDeIds, usuariosClient);
    }

    @Test
    void emitirFacturaGuardaFacturaPedidoPagadoYMesaLibre() {
        Mesa mesa = new Mesa(3L, 3, 4, EstadoMesa.OCUPADA);
        Pedido pedido = pedidoConBandeja(10L, mesa.getId());

        given(usuariosClient.obtener(5L)).willReturn(
                new UsuarioRemoto(5L, "Laura Cajera", "laura@raizysazon.co", "CAJERO", true));
        given(pedidoRepository.findById(10L)).willReturn(Optional.of(pedido));
        given(facturaRepository.findByPedidoIdAndAnuladaFalse(10L)).willReturn(Optional.empty());
        given(generadorDeIds.siguiente("facturas")).willReturn(1L);
        given(facturaRepository.insert(any(Factura.class))).willAnswer(invocacion -> invocacion.getArgument(0));
        given(mesaRepository.findById(3L)).willReturn(Optional.of(mesa));
        given(pedidoRepository.save(any(Pedido.class))).willAnswer(invocacion -> {
            Pedido guardado = invocacion.getArgument(0);
            assertThat(guardado.getEstado()).isEqualTo(EstadoPedido.PAGADO);
            return guardado;
        });
        given(mesaRepository.save(any(Mesa.class))).willAnswer(invocacion -> {
            Mesa guardada = invocacion.getArgument(0);
            assertThat(guardada.getEstado()).isEqualTo(EstadoMesa.LIBRE);
            return guardada;
        });

        Factura factura = facturaService.emitirFactura(
                new EmitirFacturaDTO(10L, 5L, MetodoPago.EFECTIVO, new BigDecimal("42000.00")));

        assertThat(factura.getId()).isEqualTo(1L);
        assertThat(factura.getNumero()).isEqualTo("F-0001");
        assertThat(factura.getSubtotal()).isEqualByComparingTo("38000.00");
        assertThat(factura.getImpuestos()).isEqualByComparingTo("3040.00");
        assertThat(factura.getTotal()).isEqualByComparingTo("41040.00");
        assertThat(pedido.getEstado()).isEqualTo(EstadoPedido.PAGADO);
        assertThat(mesa.getEstado()).isEqualTo(EstadoMesa.LIBRE);

        verify(facturaRepository).insert(factura);
        verify(pedidoRepository).save(pedido);
        verify(mesaRepository).save(mesa);
    }

    @Test
    void emitirFacturaConMontoInsuficienteLanzaConflictoSinGuardarNada() {
        Mesa mesa = new Mesa(3L, 3, 4, EstadoMesa.OCUPADA);
        Pedido pedido = pedidoConBandeja(10L, mesa.getId());

        given(usuariosClient.obtener(5L)).willReturn(
                new UsuarioRemoto(5L, "Laura Cajera", "laura@raizysazon.co", "CAJERO", true));
        given(pedidoRepository.findById(10L)).willReturn(Optional.of(pedido));
        given(facturaRepository.findByPedidoIdAndAnuladaFalse(10L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> facturaService.emitirFactura(
                new EmitirFacturaDTO(10L, 5L, MetodoPago.EFECTIVO, new BigDecimal("40000.00"))))
                .isInstanceOf(ConflictoException.class)
                .hasMessage("El monto no cubre el total de la factura ($41040.00).");

        verifyNoInteractions(generadorDeIds);
        verify(facturaRepository, never()).insert(any(Factura.class));
        verify(pedidoRepository, never()).save(any(Pedido.class));
        verify(mesaRepository, never()).save(any(Mesa.class));
    }

    private static Pedido pedidoConBandeja(Long pedidoId, Long mesaId) {
        Pedido pedido = new Pedido(mesaId, 2L, null, null);
        pedido.asignarId(pedidoId);
        LineaPedido linea = new LineaPedido(3L, "Bandeja paisa", new BigDecimal("38000.00"));
        linea.asignarId(1L);
        pedido.agregarPlatillo(linea);
        return pedido;
    }
}
