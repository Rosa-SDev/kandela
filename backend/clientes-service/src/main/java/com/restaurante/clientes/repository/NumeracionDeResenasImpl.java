package com.restaurante.clientes.repository;

import com.restaurante.clientes.contador.GeneradorDeIds;

/**
 * Pide el siguiente id de la colección "resenas" al contador.
 */
class NumeracionDeResenasImpl implements NumeracionDeResenas {

    private final GeneradorDeIds generadorDeIds;

    NumeracionDeResenasImpl(GeneradorDeIds generadorDeIds) {
        this.generadorDeIds = generadorDeIds;
    }

    @Override
    public long siguienteId() {
        return generadorDeIds.siguiente("resenas");
    }
}
