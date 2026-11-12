package com.restaurante.salon.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Mesa física del restaurante. Es un documento de la colección "mesas".
 *
 * Su estado cambia por tres caminos: al abrirse un pedido (ocupar), al
 * cerrarse o cancelarse (liberar) y al confirmarse una reserva (setEstado con
 * RESERVADA).
 */
@Document("mesas")
public class Mesa {

    /** Se guarda como _id. Es un Long que reparte GeneradorDeIds, no un ObjectId. */
    @Id
    private Long id;

    private int numero;

    private int capacidad;

    private EstadoMesa estado;

    protected Mesa() {
    }

    public Mesa(int numero, int capacidad) {
        this(null, numero, capacidad, EstadoMesa.LIBRE);
    }

    public Mesa(Long id, int numero, int capacidad, EstadoMesa estado) {
        this.id = id;
        this.numero = numero;
        this.capacidad = capacidad;
        this.estado = estado != null ? estado : EstadoMesa.LIBRE;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    /**
     * Fija el id una sola vez, al crear la mesa.
     */
    public void asignarId(Long id) {
        if (this.id != null) {
            throw new IllegalStateException("La mesa ya tiene el id " + this.id + ".");
        }
        this.id = id;
    }

    public int getNumero() {
        return numero;
    }

    public void setNumero(int numero) {
        this.numero = numero;
    }

    public int getCapacidad() {
        return capacidad;
    }

    public void setCapacidad(int capacidad) {
        this.capacidad = capacidad;
    }

    public EstadoMesa getEstado() {
        return estado;
    }

    public void setEstado(EstadoMesa estado) {
        this.estado = estado;
    }

    public void ocupar() {
        this.estado = EstadoMesa.OCUPADA;
    }

    public void liberar() {
        this.estado = EstadoMesa.LIBRE;
    }

    @Override
    public String toString() {
        return "Mesa " + numero + " (" + capacidad + " personas - " + estado + ")";
    }
}
