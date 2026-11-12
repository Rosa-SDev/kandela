package com.restaurante.usuarios.model;

import org.springframework.data.annotation.TypeAlias;

/** En MongoDB su documento lleva _class: "MESERO". */
@TypeAlias("MESERO")
public class Mesero extends Usuario {

    protected Mesero() { }

    public Mesero(String nombre, String correo, String passwordHash) {
        super(nombre, correo, passwordHash);
    }
}