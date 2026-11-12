package com.restaurante.usuarios.model;

import org.springframework.data.annotation.TypeAlias;

/** En MongoDB su documento lleva _class: "CAJERO". */
@TypeAlias("CAJERO")
public class Cajero extends Usuario {

    protected Cajero() { }

    public Cajero(String nombre, String correo, String passwordHash) {
        super(nombre, correo, passwordHash);
    }
}