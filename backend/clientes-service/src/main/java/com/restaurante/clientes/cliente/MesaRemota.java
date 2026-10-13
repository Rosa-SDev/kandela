package com.restaurante.clientes.cliente;

/**
 * La mesa tal como la devuelve el salón.
 *
 * Solo se declaran los campos que las reservas necesitan; lo demás que venga en
 * la respuesta se ignora, para que el salón pueda agregar datos a su JSON sin
 * romper este servicio.
 */
public record MesaRemota(Long id,
                         Integer numero,
                         Integer capacidad) {
}
