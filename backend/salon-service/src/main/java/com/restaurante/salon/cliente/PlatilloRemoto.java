package com.restaurante.salon.cliente;

import java.math.BigDecimal;

/**
 * El platillo tal como lo devuelve la carta.
 *
 * Solo se declaran los campos que el salón necesita; lo demás que venga en la
 * respuesta se ignora, para que la carta pueda agregar datos a su JSON sin
 * romper este servicio.
 */
public record PlatilloRemoto(Long id,
                             String nombre,
                             BigDecimal precio,
                             boolean disponible) {
}
