package com.restaurante.clientes.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.restaurante.clientes.dto.ClienteDTO;
import com.restaurante.clientes.dto.CrearClienteDTO;
import com.restaurante.clientes.exception.ConflictoException;
import com.restaurante.clientes.exception.NoEncontradoException;
import com.restaurante.clientes.model.Cliente;
import com.restaurante.clientes.repository.ClienteRepository;
import com.restaurante.clientes.repository.ReservaRepository;

/**
 * Pruebas unitarias de las reglas de los clientes, sin base de datos.
 *
 * Los repositorios son simulaciones de Mockito: cada prueba decide qué
 * responden y después comprueba qué les pidió el servicio. Que las consultas
 * funcionen de verdad contra MongoDB se comprueba en ClienteYReservaIntegracionTest.
 */
@ExtendWith(MockitoExtension.class)
class ClienteServiceTest {

    @Mock
    private ClienteRepository clienteRepository;

    @Mock
    private ReservaRepository reservaRepository;

    @InjectMocks
    private ClienteService servicio;

    private static Cliente guardado(Long id, Cliente cliente) {
        cliente.asignarId(id);
        return cliente;
    }

    private static Cliente ana() {
        return new Cliente("Ana Torres", "1001234567", "3001234567");
    }

    // ---------- crear ----------

    @Test
    void crearAsignaElSiguienteIdEInserta() {
        given(clienteRepository.existsByDocumento("1001234567")).willReturn(false);
        given(clienteRepository.siguienteId()).willReturn(4L);
        given(clienteRepository.insert(any(Cliente.class))).willAnswer(invocacion -> invocacion.getArgument(0));

        ClienteDTO creado = servicio.crear(new CrearClienteDTO("Ana Torres", "1001234567", "3001234567"));

        assertThat(creado.id()).isEqualTo(4L);
        assertThat(creado.nombre()).isEqualTo("Ana Torres");
        verify(clienteRepository, never()).save(any(Cliente.class));
    }

    @Test
    void crearConUnDocumentoRepetidoLanzaConflictoSinGastarUnId() {
        given(clienteRepository.existsByDocumento("1001234567")).willReturn(true);

        assertThatThrownBy(() -> servicio.crear(new CrearClienteDTO("Otra Ana", "1001234567", null)))
                .isInstanceOf(ConflictoException.class)
                .hasMessage("Ya existe un cliente con el documento 1001234567.");

        verify(clienteRepository, never()).siguienteId();
        verify(clienteRepository, never()).insert(any(Cliente.class));
    }

    // ---------- actualizar ----------

    @Test
    void actualizarCambiaLosDatosYGuardaElMismoCliente() {
        Cliente actual = guardado(1L, ana());
        given(clienteRepository.findById(1L)).willReturn(Optional.of(actual));
        given(clienteRepository.findByDocumento("1001234567")).willReturn(Optional.of(actual));
        given(clienteRepository.save(actual)).willReturn(actual);

        ClienteDTO actualizado = servicio.actualizar(1L, new CrearClienteDTO("Ana Torres", "1001234567", "3150000000"));

        assertThat(actualizado.id()).isEqualTo(1L);
        assertThat(actualizado.telefono()).isEqualTo("3150000000");
        verify(clienteRepository).save(actual);
    }

    @Test
    void actualizarConElDocumentoDeOtroClienteLanzaConflictoYNoGuarda() {
        Cliente luis = guardado(2L, new Cliente("Luis Ramírez", "1007654321", null));
        given(clienteRepository.findById(1L)).willReturn(Optional.of(guardado(1L, ana())));
        given(clienteRepository.findByDocumento("1007654321")).willReturn(Optional.of(luis));

        assertThatThrownBy(() -> servicio.actualizar(1L, new CrearClienteDTO("Ana Torres", "1007654321", null)))
                .isInstanceOf(ConflictoException.class)
                .hasMessage("Ya existe otro cliente con el documento 1007654321.");

        verify(clienteRepository, never()).save(any(Cliente.class));
    }

    // ---------- eliminar ----------

    @Test
    void eliminarUnClienteSinReservasLoBorra() {
        Cliente actual = guardado(1L, ana());
        given(clienteRepository.findById(1L)).willReturn(Optional.of(actual));
        given(reservaRepository.existsByClienteId(1L)).willReturn(false);

        servicio.eliminar(1L);

        verify(clienteRepository).delete(actual);
    }

    @Test
    void eliminarUnClienteConReservasLanzaConflictoYNoBorra() {
        given(clienteRepository.findById(1L)).willReturn(Optional.of(guardado(1L, ana())));
        given(reservaRepository.existsByClienteId(1L)).willReturn(true);

        assertThatThrownBy(() -> servicio.eliminar(1L))
                .isInstanceOf(ConflictoException.class)
                .hasMessage("No se puede eliminar el cliente Ana Torres porque tiene reservas asociadas.");

        verify(clienteRepository, never()).delete(any(Cliente.class));
    }

    @Test
    void eliminarUnIdQueNoExisteLanzaNoEncontrado() {
        given(clienteRepository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> servicio.eliminar(99L))
                .isInstanceOf(NoEncontradoException.class)
                .hasMessage("No existe un cliente con id 99.");
    }

    // ---------- listar ----------

    @Test
    void listarConNombreBuscaPorParteDelNombre() {
        given(clienteRepository.findByNombreContainingIgnoreCase("ana")).willReturn(List.of(guardado(1L, ana())));

        assertThat(servicio.listar("ana")).extracting(ClienteDTO::nombre).containsExactly("Ana Torres");
        verify(clienteRepository, never()).findAll();
    }

    @Test
    void listarSinNombreDevuelveTodos() {
        given(clienteRepository.findAll()).willReturn(List.of(guardado(1L, ana())));

        assertThat(servicio.listar("  ")).hasSize(1);
    }
}
