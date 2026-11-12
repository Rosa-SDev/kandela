package com.restaurante.clientes.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;


/**
 * Un cliente del restaurante. Es un documento de la colección "clientes".
 *
 * Sus reservas no se guardan aquí dentro: viven en su propia colección y
 * apuntan al cliente por su id (ver Reserva).
 */
@Document("clientes")
public class Cliente {

    /** Se guarda como _id. Es un Long que reparte GeneradorDeIds, no un ObjectId. */
    @Id
    private Long id;

    private String nombre;

    private String documento;

    private String telefono;

    protected Cliente() {
        // constructor vacío que usa Spring Data para leer el documento
    }

    public Cliente(String nombre, String documento, String telefono) {
        this.nombre = nombre;
        this.documento = documento;
        this.telefono = telefono;
    }

    public Long getId() {
        return id;
    }

    /**
     * Fija el id una sola vez, al crear el cliente. Un cliente que ya tiene id
     * no puede recibir otro: cambiarlo equivaldría a otro cliente.
     */
    public void asignarId(Long id) {
        if (this.id != null) {
            throw new IllegalStateException("El cliente ya tiene el id " + this.id + ".");
        }
        this.id = id;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getDocumento() {
        return documento;
    }

    public void setDocumento(String documento) {
        this.documento = documento;
    }

    public String getTelefono() {
        return telefono;
    }

    public void setTelefono(String telefono) {
        this.telefono = telefono;
    }

    @Override
    public String toString() {
        return nombre + " - " + documento;
    }
}