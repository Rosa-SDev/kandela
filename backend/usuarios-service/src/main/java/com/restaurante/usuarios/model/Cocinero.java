package com.restaurante.usuarios.model;

import org.springframework.data.annotation.TypeAlias;

/** En MongoDB su documento lleva _class: "COCINERO". */
@TypeAlias("COCINERO")
public class Cocinero extends Usuario {

    protected Cocinero() { }

    public Cocinero(String nombre, String correo, String passwordHash) {
        super(nombre, correo, passwordHash);
    }
}