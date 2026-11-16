package com.restaurante.clientes.dto;

import java.time.LocalDateTime;

import com.restaurante.clientes.model.AccionDelAgente;
import com.restaurante.clientes.model.DecisionDelAgente;
import com.restaurante.clientes.model.Resena;

/**
 * Una reseña con la decisión del agente, aplanada para la interfaz.
 *
 * sinClasificar es true cuando el agente no respondió: la acción es ABSTAIN y
 * no hay etiqueta ni confianza.
 */
public record ResenaDTO(Long id, String texto, LocalDateTime fecha, Long mesaId, Long pedidoId,
                        AccionDelAgente accion, String etiqueta, Double confianza, Double umbral,
                        String modelo, boolean sinClasificar, boolean revisada) {

    public static ResenaDTO de(Resena r) {
        DecisionDelAgente d = r.getDecision();
        return new ResenaDTO(r.getId(), r.getTexto(), r.getFecha(), r.getMesaId(), r.getPedidoId(),
                d.accion(), d.etiqueta(), d.confianza(), d.umbral(), d.modelo(), d.sinClasificar(),
                r.isRevisada());
    }
}
