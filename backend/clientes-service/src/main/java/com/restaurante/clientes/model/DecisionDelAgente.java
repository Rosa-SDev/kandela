package com.restaurante.clientes.model;

import java.time.LocalDateTime;

/**
 * La decisión de SentiTriage-ES sobre una reseña, tal como se guarda.
 *
 * Va embebida en la reseña: nace cuando se clasifica, no tiene vida propia y
 * siempre se lee junto con el texto. No necesita colección ni id.
 *
 * Si el agente no respondió, la reseña no se pierde ni se da por buena: queda
 * con acción ABSTAIN y sin etiqueta, para que la lea una persona. Ese caso se
 * reconoce porque la etiqueta es null (ver {@link #sinClasificar()}).
 *
 * @param accion    ABSTAIN, QUEUE o PASS
 * @param etiqueta  clase más probable según el agente (negative, neutral o
 *                  positive); null si no hubo predicción
 * @param confianza confianza calibrada del agente, entre 0 y 1; null si no hubo
 *                  predicción
 * @param umbral    umbral τ con el que decidió el agente; null si no respondió
 * @param modelo    nombre del modelo que clasificó; null si no respondió
 * @param fecha     cuándo se tomó la decisión
 */
public record DecisionDelAgente(AccionDelAgente accion, String etiqueta, Double confianza,
                                Double umbral, String modelo, LocalDateTime fecha) {

    /** La decisión que se guarda cuando el agente no pudo clasificar la reseña. */
    public static DecisionDelAgente sinRespuesta(LocalDateTime fecha) {
        return new DecisionDelAgente(AccionDelAgente.ABSTAIN, null, null, null, null, fecha);
    }

    public boolean sinClasificar() {
        return etiqueta == null;
    }
}
