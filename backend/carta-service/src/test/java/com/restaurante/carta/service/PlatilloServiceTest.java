package com.restaurante.carta.service;

import com.restaurante.carta.contador.GeneradorDeIds;
import com.restaurante.carta.exception.ConflictoException;
import com.restaurante.carta.exception.NoEncontradoException;
import com.restaurante.carta.model.Platillo;
import com.restaurante.carta.repository.PlatilloRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Pruebas unitarias de las reglas de la carta, sin base de datos.
 *
 * El repositorio y el generador de ids son simulaciones de Mockito: cada
 * prueba decide que responden y despues comprueba que les pidio el servicio.
 * Asi se prueban las reglas en milisegundos y sin Docker. Que las consultas
 * funcionen de verdad contra MongoDB se comprueba en PlatilloIntegracionTest.
 */
@ExtendWith(MockitoExtension.class)
class PlatilloServiceTest {

    @Mock
    private PlatilloRepository repositorio;

    @Mock
    private GeneradorDeIds generadorDeIds;

    @InjectMocks
    private PlatilloService servicio;

    private static Platillo bandejaPaisa() {
        return new Platillo("Bandeja paisa", "Chicharrón, fríjoles, arroz, huevo y aguacate",
                            "Fuertes", new BigDecimal("38000"), true);
    }

    private static Platillo guardado(Long id, Platillo platillo) {
        platillo.asignarId(id);
        return platillo;
    }

    // ---------- crear ----------

    @Test
    void crearAsignaElSiguienteIdDelContadorEInserta() {
        given(repositorio.existsByNombreIgnoreCase("Bandeja paisa")).willReturn(false);
        given(generadorDeIds.siguiente("platillos")).willReturn(7L);
        given(repositorio.insert(any(Platillo.class))).willAnswer(invocacion -> invocacion.getArgument(0));

        Platillo creado = servicio.crear(bandejaPaisa());

        assertThat(creado.getId()).isEqualTo(7L);
        assertThat(creado.getPrecio()).isEqualByComparingTo("38000.00");
        verify(repositorio).insert(creado);
        verify(repositorio, never()).save(any(Platillo.class));
    }

    @Test
    void crearConNombreRepetidoLanzaConflictoSinGastarUnId() {
        given(repositorio.existsByNombreIgnoreCase("Bandeja paisa")).willReturn(true);

        assertThatThrownBy(() -> servicio.crear(bandejaPaisa()))
                .isInstanceOf(ConflictoException.class)
                .hasMessage("Ya existe un platillo con el nombre Bandeja paisa.");

        verifyNoInteractions(generadorDeIds);
        verify(repositorio, never()).insert(any(Platillo.class));
    }

    // ---------- buscar ----------

    @Test
    void buscarUnIdQueNoExisteLanzaNoEncontrado() {
        given(repositorio.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> servicio.buscarPorId(99L))
                .isInstanceOf(NoEncontradoException.class)
                .hasMessage("El platillo 99 no existe.");
    }

    // ---------- actualizar ----------

    @Test
    void actualizarCambiaLosDatosYGuardaElMismoPlatillo() {
        Platillo actual = guardado(3L, bandejaPaisa());
        given(repositorio.findById(3L)).willReturn(Optional.of(actual));
        given(repositorio.existsByNombreIgnoreCase("Bandeja paisa especial")).willReturn(false);
        given(repositorio.save(actual)).willReturn(actual);

        Platillo datos = new Platillo("Bandeja paisa especial", "Con chorizo", "Fuertes",
                                      new BigDecimal("42000"), false);
        Platillo actualizado = servicio.actualizar(3L, datos);

        assertThat(actualizado.getId()).isEqualTo(3L);
        assertThat(actualizado.getNombre()).isEqualTo("Bandeja paisa especial");
        assertThat(actualizado.getPrecio()).isEqualByComparingTo("42000.00");
        assertThat(actualizado.isDisponible()).isFalse();
        verifyNoInteractions(generadorDeIds);
    }

    @Test
    void actualizarConElMismoNombreEnOtraCapitalizacionNoLoTomaComoRepetido() {
        Platillo actual = guardado(3L, bandejaPaisa());
        given(repositorio.findById(3L)).willReturn(Optional.of(actual));
        given(repositorio.save(actual)).willReturn(actual);

        Platillo datos = new Platillo("BANDEJA PAISA", "Igual", "Fuertes", new BigDecimal("38000"), true);
        servicio.actualizar(3L, datos);

        verify(repositorio, never()).existsByNombreIgnoreCase(anyString());
        verify(repositorio).save(actual);
    }

    @Test
    void actualizarConElNombreDeOtroPlatilloLanzaConflictoYNoGuarda() {
        given(repositorio.findById(3L)).willReturn(Optional.of(guardado(3L, bandejaPaisa())));
        given(repositorio.existsByNombreIgnoreCase("Ajiaco santafereño")).willReturn(true);

        Platillo datos = new Platillo("Ajiaco santafereño", null, "Sopas", new BigDecimal("28000"), true);

        assertThatThrownBy(() -> servicio.actualizar(3L, datos))
                .isInstanceOf(ConflictoException.class);
        verify(repositorio, never()).save(any(Platillo.class));
    }

    // ---------- eliminar ----------

    @Test
    void eliminarUnPlatilloQueExisteLoBorra() {
        given(repositorio.existsById(3L)).willReturn(true);

        servicio.eliminar(3L);

        verify(repositorio).deleteById(3L);
    }

    @Test
    void eliminarUnIdQueNoExisteLanzaNoEncontradoYNoBorra() {
        given(repositorio.existsById(99L)).willReturn(false);

        assertThatThrownBy(() -> servicio.eliminar(99L))
                .isInstanceOf(NoEncontradoException.class);
        verify(repositorio, never()).deleteById(any());
    }

    // ---------- descuento ----------

    @Test
    void aplicarDescuentoRebajaElPrecioYGuarda() {
        Platillo actual = guardado(3L, bandejaPaisa());
        given(repositorio.findById(3L)).willReturn(Optional.of(actual));
        given(repositorio.save(actual)).willReturn(actual);

        Platillo rebajado = servicio.aplicarDescuento(3L, new BigDecimal("10"));

        assertThat(rebajado.getPrecio()).isEqualByComparingTo("34200.00");
        verify(repositorio).save(actual);
    }

    // ---------- listar: los dos filtros son opcionales, cuatro casos ----------

    @Test
    void listarSinFiltrosDevuelveTodos() {
        given(repositorio.findAll()).willReturn(List.of(bandejaPaisa()));

        assertThat(servicio.listar(null, null)).hasSize(1);
    }

    @Test
    void listarSoloPorCategoria() {
        servicio.listar("Fuertes", null);

        verify(repositorio).findByCategoria("Fuertes");
    }

    @Test
    void listarSoloPorDisponibilidad() {
        servicio.listar(null, true);

        verify(repositorio).findByDisponible(true);
    }

    @Test
    void listarPorCategoriaYDisponibilidad() {
        servicio.listar("Fuertes", false);

        verify(repositorio).findByCategoriaAndDisponible("Fuertes", false);
    }
}
