package com.restaurante.clientes.repository;

import com.restaurante.clientes.contador.GeneradorDeIds;

/**
 * Pide el siguiente id de la colección "clientes" al contador.
 *
 * El contador vive en la colección "contadores" (ver GeneradorDeIds). El id lo
 * sigue asignando el servicio, en el único método que crea cada cliente: aquí
 * solo se entrega el número.
 */
class NumeracionDeClientesImpl implements NumeracionDeClientes {

    private final GeneradorDeIds generadorDeIds;

    NumeracionDeClientesImpl(GeneradorDeIds generadorDeIds) {
        this.generadorDeIds = generadorDeIds;
    }

    @Override
    public long siguienteId() {
        return generadorDeIds.siguiente("clientes");
    }
}
