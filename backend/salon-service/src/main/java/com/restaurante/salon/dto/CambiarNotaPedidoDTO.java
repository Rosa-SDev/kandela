package com.restaurante.salon.dto;

/**
 * Lo que entra al cambiar la nota de un pedido (PATCH /api/pedidos/{id}).
 *
 * La nota no es obligatoria: enviarla vacía o sin valor la deja limpia, porque
 * el mesero tiene que poder deshacer una nota escrita por error.
 */
public record CambiarNotaPedidoDTO(String observaciones) {
}
