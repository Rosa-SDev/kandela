package com.restaurante.salon.dto;

import jakarta.validation.constraints.Size;

/**
 * Lo que entra al cambiar la nota de un pedido (PATCH /api/pedidos/{id}).
 *
 * La nota no es obligatoria: enviarla vacía o sin valor la deja limpia, porque
 * el mesero tiene que poder deshacer una nota escrita por error.
 *
 * El límite es el de la columna donde se guarda. Sin él, una nota más larga se
 * rechazaría en la base de datos y el mesero vería un error sin explicación en
 * vez del aviso debajo del campo.
 */
public record CambiarNotaPedidoDTO(

        @Size(max = 255, message = "La nota no puede tener más de 255 caracteres.")
        String observaciones) {
}
