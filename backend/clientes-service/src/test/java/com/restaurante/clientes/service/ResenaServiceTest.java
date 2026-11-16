package com.restaurante.clientes.service;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.BDDMockito.given;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import com.restaurante.clientes.cliente.DecisionRemota;
import com.restaurante.clientes.cliente.SentiTriageClient;
import com.restaurante.clientes.dto.CrearResenaDTO;
import com.restaurante.clientes.dto.ResenaDTO;
import com.restaurante.clientes.exception.ConflictoException;
import com.restaurante.clientes.exception.NoEncontradoException;
import com.restaurante.clientes.exception.ServicioNoDisponibleException;
import com.restaurante.clientes.model.AccionDelAgente;
import com.restaurante.clientes.model.DecisionDelAgente;
import com.restaurante.clientes.model.Resena;
import com.restaurante.clientes.repository.ResenaRepository;

/**
 * Pruebas unitarias de las reseñas, sin base de datos ni agente.
 *
 * El repositorio y el cliente de SentiTriage-ES son simulaciones de Mockito.
 */
@ExtendWith(MockitoExtension.class)
class ResenaServiceTest {

    private static final String QUEJA = "La sopa llegó fría y nadie nos atendió.";

    @Mock
    private ResenaRepository resenaRepository;

    @Mock
    private SentiTriageClient sentiTriageClient;

    @InjectMocks
    private ResenaService servicio;

    private static DecisionRemota queja() {
        return new DecisionRemota("QUEUE", "negative", 0.84, 0.5933, "beto-sentitriage", null);
    }

    private void prepararInsercion(long id) {
        given(resenaRepository.siguienteId()).willReturn(id);
        given(resenaRepository.insert(any(Resena.class))).willAnswer(invocacion -> invocacion.getArgument(0));
    }

    private static Resena guardada(long id, DecisionDelAgente decision) {
        Resena resena = new Resena(QUEJA, LocalDateTime.now(), 4L, null);
        resena.asignarId(id);
        resena.clasificar(decision);
        return resena;
    }

    // ---------- crear ----------

    @Test
    void crearGuardaLaResenaConLaDecisionDelAgente() {
        prepararInsercion(5L);
        given(sentiTriageClient.clasificar(eq(5L), eq(QUEJA), anyMap())).willReturn(queja());

        ResenaDTO creada = servicio.crear(new CrearResenaDTO("  " + QUEJA + "  ", 4L, 12L));

        assertThat(creada.id()).isEqualTo(5L);
        assertThat(creada.texto()).isEqualTo(QUEJA);
        assertThat(creada.accion()).isEqualTo(AccionDelAgente.QUEUE);
        assertThat(creada.etiqueta()).isEqualTo("negative");
        assertThat(creada.confianza()).isEqualTo(0.84);
        assertThat(creada.sinClasificar()).isFalse();
        assertThat(creada.revisada()).isFalse();
        verify(resenaRepository, never()).save(any(Resena.class));
    }

    @Test
    void alAgenteLeLleganLaMesaYElPedidoComoDatos() {
        prepararInsercion(1L);
        given(sentiTriageClient.clasificar(eq(1L), eq(QUEJA), anyMap())).willReturn(queja());

        servicio.crear(new CrearResenaDTO(QUEJA, 4L, 12L));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> datos = ArgumentCaptor.forClass(Map.class);
        verify(sentiTriageClient).clasificar(eq(1L), eq(QUEJA), datos.capture());
        assertThat(datos.getValue())
                .containsEntry("origen", "kandela")
                .containsEntry("mesaId", 4L)
                .containsEntry("pedidoId", 12L);
    }

    @Test
    void siElAgenteNoRespondeLaResenaSeGuardaIgualParaQueLaLeaUnaPersona() {
        prepararInsercion(2L);
        given(sentiTriageClient.clasificar(eq(2L), eq(QUEJA), anyMap()))
                .willThrow(new ServicioNoDisponibleException("El agente de reseñas no está disponible en este momento."));

        ResenaDTO creada = servicio.crear(new CrearResenaDTO(QUEJA, null, null));

        assertThat(creada.id()).isEqualTo(2L);
        assertThat(creada.accion()).isEqualTo(AccionDelAgente.ABSTAIN);
        assertThat(creada.sinClasificar()).isTrue();
        assertThat(creada.etiqueta()).isNull();
        assertThat(creada.confianza()).isNull();
        verify(resenaRepository).insert(any(Resena.class));
    }

    @Test
    void unaAccionQueKandelaNoConoceSeTrataComoAbstencion() {
        prepararInsercion(3L);
        given(sentiTriageClient.clasificar(eq(3L), eq(QUEJA), anyMap()))
                .willReturn(new DecisionRemota("ALERT", "negative", 0.9, 0.5933, "beto-sentitriage", null));

        assertThat(servicio.crear(new CrearResenaDTO(QUEJA, null, null)).accion())
                .isEqualTo(AccionDelAgente.ABSTAIN);
    }

    // ---------- revisar y volver a clasificar ----------

    @Test
    void marcarRevisadaGuardaLaMarca() {
        given(resenaRepository.findById(1L)).willReturn(Optional.of(guardada(1L, new DecisionDelAgente(
                AccionDelAgente.QUEUE, "negative", 0.84, 0.5933, "beto-sentitriage", LocalDateTime.now()))));
        given(resenaRepository.save(any(Resena.class))).willAnswer(invocacion -> invocacion.getArgument(0));

        assertThat(servicio.marcarRevisada(1L, true).revisada()).isTrue();
    }

    @Test
    void unaResenaSinClasificarSePuedeVolverAClasificar() {
        given(resenaRepository.findById(2L))
                .willReturn(Optional.of(guardada(2L, DecisionDelAgente.sinRespuesta(LocalDateTime.now()))));
        given(sentiTriageClient.clasificar(eq(2L), eq(QUEJA), anyMap())).willReturn(queja());
        given(resenaRepository.save(any(Resena.class))).willAnswer(invocacion -> invocacion.getArgument(0));

        ResenaDTO clasificada = servicio.volverAClasificar(2L);

        assertThat(clasificada.accion()).isEqualTo(AccionDelAgente.QUEUE);
        assertThat(clasificada.sinClasificar()).isFalse();
    }

    @Test
    void unaResenaYaClasificadaNoSeVuelveAClasificar() {
        given(resenaRepository.findById(1L)).willReturn(Optional.of(guardada(1L, new DecisionDelAgente(
                AccionDelAgente.PASS, "positive", 0.88, 0.5933, "beto-sentitriage", LocalDateTime.now()))));

        assertThatThrownBy(() -> servicio.volverAClasificar(1L))
                .isInstanceOf(ConflictoException.class)
                .hasMessage("La reseña 1 ya está clasificada.");
        verifyNoInteractions(sentiTriageClient);
    }

    @Test
    void buscarUnaResenaQueNoExisteLanzaNoEncontrado() {
        given(resenaRepository.findById(99L)).willReturn(Optional.empty());

        assertThatThrownBy(() -> servicio.buscarPorId(99L))
                .isInstanceOf(NoEncontradoException.class)
                .hasMessage("No existe una reseña con id 99.");
    }
}
