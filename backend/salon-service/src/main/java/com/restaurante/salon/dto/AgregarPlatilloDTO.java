package com.restaurante.salon.dto;

import jakarta.validation.constraints.NotNull;

/**
 * Lo que entra al agregar un platillo al pedido.
 *
 * Solo viaja el identificador. El nombre, el precio y la disponibilidad los
 * pide este servicio a la carta, que es la dueña de ese dato: si el precio
 * llegara desde el navegador se podría manipular, y consultar la carta no
 * tendría ningún sentido.
 */
public record AgregarPlatilloDTO(

        @NotNull(message = "El ID del platillo es obligatorio")
        Long platilloId) {
}
