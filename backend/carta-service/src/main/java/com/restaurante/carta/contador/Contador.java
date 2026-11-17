package com.restaurante.carta.contador;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Un documento de la coleccion "contadores": el ultimo id numerico entregado
 * para una coleccion.
 *
 * El _id del documento es el nombre de la coleccion a la que numera (por
 * ejemplo, "platillos"), asi que hay un solo contador por coleccion.
 */
@Document("contadores")
public class Contador {

    @Id
    private String id;

    private long valor;

    /** Constructor vacio que usa Spring Data para leer el documento. */
    protected Contador() {
    }

    public String getId() {
        return id;
    }

    public long getValor() {
        return valor;
    }
}
