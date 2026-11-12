package com.restaurante.usuarios.model;

import org.springframework.data.annotation.TypeAlias;

/** En MongoDB su documento lleva _class: "ADMINISTRADOR". */
@TypeAlias("ADMINISTRADOR")
public class Administrador extends Usuario {

    protected Administrador() { }

    public Administrador(String nombre, String correo, String passwordHash) {
        super(nombre, correo, passwordHash);
    }
}