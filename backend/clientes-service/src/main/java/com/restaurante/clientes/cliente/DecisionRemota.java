package com.restaurante.clientes.cliente;

/**
 * Lo que responde SentiTriage-ES en POST /classify, con los nombres de su API.
 *
 * Solo se leen los campos que usa Kandela; el resto de la respuesta
 * (probabilidades, latencia...) se ignora.
 *
 * Si el modelo falló por dentro, el agente responde action = ABSTAIN, label y
 * confidence en null y un campo error: nunca da una reseña por buena sin
 * predicción.
 */
public record DecisionRemota(String action, String label, Double confidence, Double threshold,
                             String model, String error) {
}
