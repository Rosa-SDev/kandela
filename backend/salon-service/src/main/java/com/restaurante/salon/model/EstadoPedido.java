package com.restaurante.salon.model;

/**
 * Situación en la que se encuentra un pedido.
 *
 * El recorrido normal es ABIERTO → EN_COCINA → EN_PREPARACION → SERVIDO → PAGADO,
 * y cualquier pedido que no esté pagado se puede CANCELAR.
 *
 * EN_COCINA es el pedido que el mesero ya envió pero que nadie ha empezado a
 * preparar todavía: es lo que alimenta la columna de comandas nuevas del
 * tablero de cocina.
 */
public enum EstadoPedido {
    ABIERTO,
    EN_COCINA,
    EN_PREPARACION,
    SERVIDO,
    PAGADO,
    CANCELADO
}
