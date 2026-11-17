package com.restaurante.clientes.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyIterable;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.restaurante.clientes.cliente.MesaRemota;
import com.restaurante.clientes.cliente.SalonClient;
import com.restaurante.clientes.dto.CrearReservaDTO;
import com.restaurante.clientes.dto.ReservaDTO;
import com.restaurante.clientes.exception.ConflictoException;
import com.restaurante.clientes.exception.NoEncontradoException;
import com.restaurante.clientes.model.Cliente;
import com.restaurante.clientes.model.EstadoReserva;
import com.restaurante.clientes.model.Reserva;
import com.restaurante.clientes.repository.ClienteRepository;
import com.restaurante.clientes.repository.ReservaRepository;

/**
 * Pruebas unitarias de las reglas de las reservas, sin base de datos ni salón.
 *
 * Los repositorios y el cliente del salón son simulaciones de Mockito.
 */
@ExtendWith(MockitoExtension.class)
class ReservaServiceTest {

    @Mock
    private ReservaRepository reservaRepository;

    @Mock
    private ClienteRepository clienteRepository;

    @Mock
    private SalonClient salonClient;

    @InjectMocks
    private ReservaService servicio;

    private static Cliente cliente(Long id, String nombre, String documento) {
        Cliente cliente = new Cliente(nombre, documento, null);
        cliente.asignarId(id);
        return cliente;
    }

    private static Reserva reserva(Long id, Long clienteId, EstadoReserva estado) {
        Reserva reserva = new Reserva(LocalDateTime.now().plusDays(1), 2, clienteId, null, null);
        reserva.setEstado(estado);
        reserva.asignarId(id);
        return reserva;
    }

    private static LocalDateTime manana() {
        return LocalDateTime.now().plusDays(1).withHour(19).withMinute(0).withSecond(0).withNano(0);
    }

    // ---------- listar ----------

    @Test
    void listarTraeLosClientesDeTodasLasReservasConUnSoloFindAllById() {
        given(reservaRepository.findAll()).willReturn(List.of(
                reserva(1L, 3L, EstadoReserva.CONFIRMADA),
                reserva(2L, 1L, EstadoReserva.PENDIENTE),
                reserva(3L, 1L, EstadoReserva.PENDIENTE)));
        given(clienteRepository.findAllById(anyIterable())).willReturn(List.of(
                cliente(1L, "Ana Torres", "1001234567"),
                cliente(3L, "Marcela Gómez", "1009988776")));

        List<ReservaDTO> reservas = servicio.listar(null);

        assertThat(reservas).extracting(ReservaDTO::clienteNombre)
                .containsExactly("Marcela Gómez", "Ana Torres", "Ana Torres");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Iterable<Long>> ids = ArgumentCaptor.forClass(Iterable.class);
        verify(clienteRepository, times(1)).findAllById(ids.capture());
        assertThat(ids.getValue()).containsExactlyInAnyOrder(1L, 3L);
        verify(clienteRepository, never()).findById(any());
    }

    @Test
    void listarPorEstadoUsaElFiltroDelRepositorio() {
        given(reservaRepository.findByEstado(EstadoReserva.PENDIENTE)).willReturn(List.of());
        given(clienteRepository.findAllById(Set.of())).willReturn(List.of());

        assertThat(servicio.listar(EstadoReserva.PENDIENTE)).isEmpty();
        verify(reservaRepository, never()).findAll();
    }

    // ---------- crear ----------

    @Test
    void crearAsignaElSiguienteIdDelContadorEInserta() {
        given(clienteRepository.findById(1L)).willReturn(Optional.of(cliente(1L, "Ana Torres", "1001234567")));
        given(salonClient.obtenerMesa(2L)).willReturn(new MesaRemota(2L, 2, 4));
        given(reservaRepository.siguienteId()).willReturn(8L);
        given(reservaRepository.insert(any(Reserva.class))).willAnswer(invocacion -> invocacion.getArgument(0));

        ReservaDTO creada = servicio.crear(new CrearReservaDTO(manana(), 4, 1L, 2L, 3L));

        assertThat(creada.id()).isEqualTo(8L);
        assertThat(creada.estado()).isEqualTo(EstadoReserva.PENDIENTE);
        assertThat(creada.clienteId()).isEqualTo(1L);
        assertThat(creada.clienteNombre()).isEqualTo("Ana Torres");
        verify(reservaRepository, never()).save(any(Reserva.class));
    }

    @Test
    void crearParaUnClienteQueNoExisteLanzaNoEncontradoSinConsultarAlSalon() {
        given(clienteRepository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> servicio.crear(new CrearReservaDTO(manana(), 2, 99L, 2L, null)))
                .isInstanceOf(NoEncontradoException.class)
                .hasMessage("No existe un cliente con id 99.");

        verifyNoInteractions(salonClient);
        verify(reservaRepository, never()).insert(any(Reserva.class));
    }

    @Test
    void crearParaUnaFechaQueYaPasoSeRechaza() {
        given(clienteRepository.findById(1L)).willReturn(Optional.of(cliente(1L, "Ana Torres", "1001234567")));

        assertThatThrownBy(() -> servicio.crear(
                new CrearReservaDTO(LocalDateTime.now().minusDays(1), 2, 1L, null, null)))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("No se puede reservar para una fecha que ya pasó.");

        verify(reservaRepository, never()).siguienteId();
    }

    @Test
    void crearConUnaMesaQueNoAlcanzaLanzaConflictoSinGastarUnId() {
        given(clienteRepository.findById(1L)).willReturn(Optional.of(cliente(1L, "Ana Torres", "1001234567")));
        given(salonClient.obtenerMesa(2L)).willReturn(new MesaRemota(2L, 2, 4));

        assertThatThrownBy(() -> servicio.crear(new CrearReservaDTO(manana(), 6, 1L, 2L, null)))
                .isInstanceOf(ConflictoException.class)
                .hasMessage("La mesa 2 no alcanza para 6 personas. Su capacidad es de 4.");

        verify(reservaRepository, never()).siguienteId();
        verify(reservaRepository, never()).insert(any(Reserva.class));
    }

    // ---------- cambiar estado ----------

    @Test
    void confirmarUnaReservaPendienteLaGuarda() {
        Reserva pendiente = reserva(2L, 1L, EstadoReserva.PENDIENTE);
        given(reservaRepository.findById(2L)).willReturn(Optional.of(pendiente));
        given(reservaRepository.save(pendiente)).willReturn(pendiente);
        given(clienteRepository.findById(1L)).willReturn(Optional.of(cliente(1L, "Ana Torres", "1001234567")));

        ReservaDTO confirmada = servicio.cambiarEstado(2L, EstadoReserva.CONFIRMADA);

        assertThat(confirmada.estado()).isEqualTo(EstadoReserva.CONFIRMADA);
        assertThat(confirmada.clienteNombre()).isEqualTo("Ana Torres");
        verify(reservaRepository).save(pendiente);
    }

    @Test
    void unaReservaCanceladaNoSePuedeConfirmar() {
        given(reservaRepository.findById(2L)).willReturn(Optional.of(reserva(2L, 1L, EstadoReserva.CANCELADA)));

        assertThatThrownBy(() -> servicio.cambiarEstado(2L, EstadoReserva.CONFIRMADA))
                .isInstanceOf(ConflictoException.class)
                .hasMessage("No se puede pasar una reserva de CANCELADA a CONFIRMADA.");

        verify(reservaRepository, never()).save(any(Reserva.class));
    }

    // ---------- eliminar ----------

    @Test
    void eliminarUnaReservaQueNoExisteLanzaNoEncontrado() {
        given(reservaRepository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> servicio.eliminar(99L))
                .isInstanceOf(NoEncontradoException.class)
                .hasMessage("No existe una reserva con id 99.");
    }
}
