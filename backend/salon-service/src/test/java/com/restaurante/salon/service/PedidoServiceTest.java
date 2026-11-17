package com.restaurante.salon.service;

import com.restaurante.salon.cliente.CartaClient;
import com.restaurante.salon.cliente.UsuarioRemoto;
import com.restaurante.salon.cliente.UsuariosClient;
import com.restaurante.salon.contador.GeneradorDeIds;
import com.restaurante.salon.dto.CrearPedidoDTO;
import com.restaurante.salon.exception.ConflictoException;
import com.restaurante.salon.model.EstadoMesa;
import com.restaurante.salon.model.EstadoPedido;
import com.restaurante.salon.model.LineaPedido;
import com.restaurante.salon.model.Mesa;
import com.restaurante.salon.model.MetodoPago;
import com.restaurante.salon.model.Pedido;
import com.restaurante.salon.repository.MesaRepository;
import com.restaurante.salon.repository.PedidoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
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
 * Pruebas unitarias de PedidoService con Mockito, sin base de datos.
 *
 * Comprueban que las operaciones que cambian el estado de varios documentos
 * (abrir, cancelar y cerrar un pedido) guardan explícitamente tanto el pedido
 * como la mesa en sus repositorios, ya que MongoDB no persiste cambios por
 * dirty checking al cerrar la transacción.
 */
@ExtendWith(MockitoExtension.class)
class PedidoServiceTest {

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

    @InjectMocks
    private PedidoService pedidoService;

    @Test
    void crearOcupaLaMesaLaGuardaEInsertaElPedido() {
        Mesa mesa = new Mesa(3L, 3, 4, EstadoMesa.LIBRE);
        given(usuariosClient.obtener(2L)).willReturn(
                new UsuarioRemoto(2L, "Carlos Mesero", "carlos@raizysazon.co", "MESERO", true));
        given(mesaRepository.findById(3L)).willReturn(Optional.of(mesa));
        given(mesaRepository.save(any(Mesa.class))).willAnswer(invocacion -> {
            Mesa guardada = invocacion.getArgument(0);
            assertThat(guardada.getEstado()).isEqualTo(EstadoMesa.OCUPADA);
            return guardada;
        });
        given(generadorDeIds.siguiente("pedidos")).willReturn(10L);
        given(pedidoRepository.insert(any(Pedido.class))).willAnswer(invocacion -> invocacion.getArgument(0));

        Pedido creado = pedidoService.crear(new CrearPedidoDTO(3L, 2L, null, "Junto a la ventana"));

        assertThat(creado.getId()).isEqualTo(10L);
        assertThat(creado.getEstado()).isEqualTo(EstadoPedido.ABIERTO);
        assertThat(mesa.getEstado()).isEqualTo(EstadoMesa.OCUPADA);
        verify(mesaRepository).save(mesa);
        verify(pedidoRepository).insert(creado);
    }

    @Test
    void crearEnMesaOcupadaLanzaConflictoSinGuardarNada() {
        Mesa mesaOcupada = new Mesa(3L, 3, 4, EstadoMesa.OCUPADA);
        given(usuariosClient.obtener(2L)).willReturn(
                new UsuarioRemoto(2L, "Carlos Mesero", "carlos@raizysazon.co", "MESERO", true));
        given(mesaRepository.findById(3L)).willReturn(Optional.of(mesaOcupada));

        assertThatThrownBy(() -> pedidoService.crear(new CrearPedidoDTO(3L, 2L, null, null)))
                .isInstanceOf(ConflictoException.class)
                .hasMessage("La mesa 3 ya está ocupada por otro pedido.");

        verifyNoInteractions(generadorDeIds);
        verify(mesaRepository, never()).save(any(Mesa.class));
        verify(pedidoRepository, never()).insert(any(Pedido.class));
    }

    @Test
    void cancelarUnPedidoGuardaLaMesaLibreYElPedidoCancelado() {
        Mesa mesa = new Mesa(3L, 3, 4, EstadoMesa.OCUPADA);
        Pedido pedido = new Pedido(mesa.getId(), 2L, null, null);
        pedido.asignarId(10L);
        pedido.setEstado(EstadoPedido.EN_PREPARACION);

        given(pedidoRepository.findById(10L)).willReturn(Optional.of(pedido));
        given(mesaRepository.findById(3L)).willReturn(Optional.of(mesa));
        given(mesaRepository.save(any(Mesa.class))).willAnswer(invocacion -> {
            Mesa guardada = invocacion.getArgument(0);
            assertThat(guardada.getEstado()).isEqualTo(EstadoMesa.LIBRE);
            return guardada;
        });
        given(pedidoRepository.save(any(Pedido.class))).willAnswer(invocacion -> {
            Pedido guardado = invocacion.getArgument(0);
            assertThat(guardado.getEstado()).isEqualTo(EstadoPedido.CANCELADO);
            return guardado;
        });

        Pedido cancelado = pedidoService.cambiarEstado(10L, EstadoPedido.CANCELADO);

        assertThat(cancelado.getEstado()).isEqualTo(EstadoPedido.CANCELADO);
        assertThat(mesa.getEstado()).isEqualTo(EstadoMesa.LIBRE);
        verify(mesaRepository).save(mesa);
        verify(pedidoRepository).save(pedido);
    }

    @Test
    void cerrarUnPedidoPagadoGuardaElPedidoPagadoYLaMesaLibre() {
        Mesa mesa = new Mesa(3L, 3, 4, EstadoMesa.OCUPADA);
        Pedido pedido = new Pedido(mesa.getId(), 2L, null, null);
        pedido.asignarId(10L);
        LineaPedido linea = new LineaPedido(3L, "Bandeja paisa", new BigDecimal("38000.00"));
        linea.asignarId(1L);
        pedido.agregarPlatillo(linea);
        pedido.registrarPago(MetodoPago.EFECTIVO, new BigDecimal("41040.00"));

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

        Pedido cerrado = pedidoService.cerrar(pedido);

        assertThat(cerrado.getEstado()).isEqualTo(EstadoPedido.PAGADO);
        assertThat(mesa.getEstado()).isEqualTo(EstadoMesa.LIBRE);
        verify(pedidoRepository).save(pedido);
        verify(mesaRepository).save(mesa);
    }
}
