package com.restaurante.clientes.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

/**
 * Lo que envía el formulario público de reseñas.
 *
 * La mesa y el pedido son opcionales: los trae la dirección del QR cuando la
 * reseña sale de una mesa o de una factura. El límite de 2.000 caracteres es el
 * mismo que acepta el agente.
 */
public record CrearResenaDTO(
    @NotBlank(message = "Escribe tu comentario")
    @Size(max = 2000, message = "El comentario puede tener hasta 2.000 caracteres")
    String texto,

    @Positive(message = "La mesa no es válida")
    Long mesaId,

    @Positive(message = "El pedido no es válido")
    Long pedidoId
) { }
