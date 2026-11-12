package com.restaurante.usuarios.service;

import com.restaurante.usuarios.contador.GeneradorDeIds;
import com.restaurante.usuarios.dto.ActualizarUsuarioDTO;
import com.restaurante.usuarios.dto.CrearUsuarioDTO;
import com.restaurante.usuarios.dto.UsuarioDTO;
import com.restaurante.usuarios.exception.ConflictoException;
import com.restaurante.usuarios.exception.CredencialesInvalidasException;
import com.restaurante.usuarios.exception.NoEncontradoException;
import com.restaurante.usuarios.model.Cajero;
import com.restaurante.usuarios.model.Mesero;
import com.restaurante.usuarios.model.Rol;
import com.restaurante.usuarios.model.Usuario;
import com.restaurante.usuarios.repository.UsuarioRepository;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Pruebas unitarias de las reglas de los usuarios, sin base de datos.
 *
 * El repositorio y el generador de ids son simulaciones de Mockito: cada prueba
 * decide que responden y despues comprueba que les pidio el servicio. Que las
 * consultas funcionen de verdad contra MongoDB se comprueba en
 * UsuarioIntegracionTest.
 */
@ExtendWith(MockitoExtension.class)
class UsuarioServiceTest {

    @Mock
    private UsuarioRepository repositorio;

    @Mock
    private GeneradorDeIds generadorDeIds;

    @InjectMocks
    private UsuarioService servicio;

    private static Usuario guardado(Long id, Usuario usuario) {
        usuario.asignarId(id);
        return usuario;
    }

    private static Mesero carlos() {
        return new Mesero("Carlos Rojas", "carlos.rojas@raizysazon.co", UsuarioService.hash("kandela123"));
    }

    // ---------- crear ----------

    @Test
    void crearAsignaElSiguienteIdGuardaElHashEInserta() {
        given(repositorio.existsByCorreoIgnoreCase("carlos.rojas@raizysazon.co")).willReturn(false);
        given(generadorDeIds.siguiente("usuarios")).willReturn(6L);
        given(repositorio.insert(any(Usuario.class))).willAnswer(invocacion -> invocacion.getArgument(0));

        UsuarioDTO creado = servicio.crear(new CrearUsuarioDTO(
                "Carlos Rojas", "carlos.rojas@raizysazon.co", Rol.MESERO, "kandela123"));

        assertThat(creado.id()).isEqualTo(6L);
        assertThat(creado.rol()).isEqualTo(Rol.MESERO);
        assertThat(creado.activo()).isTrue();

        ArgumentCaptor<Usuario> insertado = ArgumentCaptor.forClass(Usuario.class);
        verify(repositorio).insert(insertado.capture());
        assertThat(insertado.getValue()).isInstanceOf(Mesero.class);
        assertThat(insertado.getValue().getPasswordHash())
                .isEqualTo(UsuarioService.hash("kandela123"))
                .isNotEqualTo("kandela123");
        verify(repositorio, never()).save(any(Usuario.class));
    }

    @Test
    void crearConUnCorreoRepetidoLanzaConflictoSinGastarUnId() {
        given(repositorio.existsByCorreoIgnoreCase("CARLOS.ROJAS@raizysazon.co")).willReturn(true);

        assertThatThrownBy(() -> servicio.crear(new CrearUsuarioDTO(
                "Otro Carlos", "CARLOS.ROJAS@raizysazon.co", Rol.CAJERO, "kandela123")))
                .isInstanceOf(ConflictoException.class)
                .hasMessage("Ya existe un usuario con ese correo.");

        verifyNoInteractions(generadorDeIds);
        verify(repositorio, never()).insert(any(Usuario.class));
    }

    // ---------- actualizar ----------

    @Test
    void actualizarSinContrasenaConservaElHashActual() {
        Usuario actual = guardado(2L, carlos());
        String hashAnterior = actual.getPasswordHash();
        given(repositorio.findById(2L)).willReturn(Optional.of(actual));
        given(repositorio.findByCorreoIgnoreCase("carlos.r@raizysazon.co")).willReturn(Optional.empty());
        given(repositorio.save(actual)).willReturn(actual);

        UsuarioDTO actualizado = servicio.actualizar(2L,
                new ActualizarUsuarioDTO("Carlos Andrés Rojas", "carlos.r@raizysazon.co", ""));

        assertThat(actualizado.nombre()).isEqualTo("Carlos Andrés Rojas");
        assertThat(actualizado.correo()).isEqualTo("carlos.r@raizysazon.co");
        assertThat(actual.getPasswordHash()).isEqualTo(hashAnterior);
        verify(repositorio).save(actual);
    }

    @Test
    void actualizarConContrasenaGuardaElHashNuevo() {
        Usuario actual = guardado(2L, carlos());
        given(repositorio.findById(2L)).willReturn(Optional.of(actual));
        given(repositorio.findByCorreoIgnoreCase("carlos.rojas@raizysazon.co")).willReturn(Optional.of(actual));
        given(repositorio.save(actual)).willReturn(actual);

        servicio.actualizar(2L, new ActualizarUsuarioDTO("Carlos Rojas", "carlos.rojas@raizysazon.co", "nueva123"));

        assertThat(actual.getPasswordHash()).isEqualTo(UsuarioService.hash("nueva123"));
    }

    @Test
    void actualizarConElCorreoDeOtroUsuarioLanzaConflictoYNoGuarda() {
        Usuario otro = guardado(5L, new Cajero("Diana Ríos", "diana.rios@raizysazon.co", "x"));
        given(repositorio.findById(2L)).willReturn(Optional.of(guardado(2L, carlos())));
        given(repositorio.findByCorreoIgnoreCase("diana.rios@raizysazon.co")).willReturn(Optional.of(otro));

        assertThatThrownBy(() -> servicio.actualizar(2L,
                new ActualizarUsuarioDTO("Carlos Rojas", "diana.rios@raizysazon.co", null)))
                .isInstanceOf(ConflictoException.class)
                .hasMessage("Ya existe otro usuario con ese correo.");

        verify(repositorio, never()).save(any(Usuario.class));
    }

    @Test
    void actualizarUnIdQueNoExisteLanzaNoEncontrado() {
        given(repositorio.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> servicio.actualizar(99L,
                new ActualizarUsuarioDTO("Nadie", "nadie@raizysazon.co", null)))
                .isInstanceOf(NoEncontradoException.class)
                .hasMessage("El usuario 99 no existe.");
    }

    // ---------- eliminar ----------

    @Test
    void eliminarUnUsuarioQueExisteLoBorra() {
        given(repositorio.existsById(2L)).willReturn(true);

        servicio.eliminar(2L);

        verify(repositorio).deleteById(2L);
    }

    @Test
    void eliminarUnIdQueNoExisteLanzaNoEncontradoYNoBorra() {
        given(repositorio.existsById(99L)).willReturn(false);

        assertThatThrownBy(() -> servicio.eliminar(99L))
                .isInstanceOf(NoEncontradoException.class);

        verify(repositorio, never()).deleteById(any());
    }

    // ---------- listar ----------

    @Test
    void listarPorRolDevuelveSoloLosDeEseRol() {
        given(repositorio.findAll()).willReturn(List.of(
                guardado(2L, carlos()),
                guardado(5L, new Cajero("Diana Ríos", "diana.rios@raizysazon.co", "x")),
                guardado(3L, new Mesero("Andrea Pérez", "andrea.perez@raizysazon.co", "x"))));

        assertThat(servicio.listar(Rol.MESERO))
                .extracting(UsuarioDTO::id)
                .containsExactly(2L, 3L);
        assertThat(servicio.listar(Rol.COCINERO)).isEmpty();
        assertThat(servicio.listar(null)).hasSize(3);
    }

    // ---------- autenticar ----------

    @Test
    void autenticarConLaContrasenaCorrectaDevuelveElUsuario() {
        given(repositorio.findByCorreoIgnoreCase("carlos.rojas@raizysazon.co"))
                .willReturn(Optional.of(guardado(2L, carlos())));

        UsuarioDTO usuario = servicio.autenticar("carlos.rojas@raizysazon.co", "kandela123");

        assertThat(usuario.id()).isEqualTo(2L);
        assertThat(usuario.rol()).isEqualTo(Rol.MESERO);
    }

    @Test
    void autenticarConLaContrasenaIncorrectaLanzaCredencialesInvalidas() {
        given(repositorio.findByCorreoIgnoreCase("carlos.rojas@raizysazon.co"))
                .willReturn(Optional.of(guardado(2L, carlos())));

        assertThatThrownBy(() -> servicio.autenticar("carlos.rojas@raizysazon.co", "otra"))
                .isInstanceOf(CredencialesInvalidasException.class)
                .hasMessage("Correo o contraseña incorrectos.");
    }
}
