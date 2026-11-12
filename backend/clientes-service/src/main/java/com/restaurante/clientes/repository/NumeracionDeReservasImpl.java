package com.restaurante.clientes.repository;

import com.restaurante.clientes.contador.GeneradorDeIds;

/**
 * Pide el siguiente id de la colección "reservas" al contador.
 *
 * El contador vive en la colección "contadores" (ver GeneradorDeIds). El id lo
 * sigue asignando el servicio, en el único método que crea cada reserva: aquí
 * solo se entrega el número.
 */
class NumeracionDeReservasImpl implements NumeracionDeReservas {

    private final GeneradorDeIds generadorDeIds;

    NumeracionDeReservasImpl(GeneradorDeIds generadorDeIds) {
        this.generadorDeIds = generadorDeIds;
    }

    @Override
    public long siguienteId() {
        return generadorDeIds.siguiente("reservas");
    }
}
