package com.restaurante.salon.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

/**
 * Lo que entra al crear un pedido (POST /api/pedidos).
 * Todos los tipos son Wrappers / Objetos.
 */
public record CrearPedidoDTO(

        @NotNull(message = "El ID de la mesa es obligatorio")
        Long mesaId,

        @NotNull(message = "El ID del mesero es obligatorio")
        Long meseroId,

        Long clienteId,

        @Size(max = 255, message = "La nota no puede tener más de 255 caracteres.")
        String observaciones) {
}
