package com.restaurante.clientes.model;

import java.time.LocalDateTime;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/**
 * Reserva de una mesa a nombre de un cliente.
 *
 * clienteId, mesaId y meseroId son solo el identificador (Long), no el objeto.
 * Mesa vive en salon-service y Mesero en usuarios-service, cada uno con su
 * propia base de datos. El cliente sí vive en este servicio, pero tampoco se
 * guarda dentro de la reserva: un cliente acumula reservas sin límite y tiene
 * vida propia, y si cambia su teléfono el cambio debe verse en todas sus
 * reservas. Por eso la reserva apunta al cliente por su id y el nombre se
 * busca al armar la respuesta (ver ReservaService).
 *
 * Por lo mismo, confirmar()/cancelar() aquí solo cambian el estado propio de
 * la reserva — el original también tocaba el estado de la Mesa, pero eso ya
 * no es posible sin el objeto real. La mesa y su capacidad se validan al
 * crear la reserva, consultando al salón (ver ReservaService).
 */
@Entity
@Table(name = "reservas")
public class Reserva {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private LocalDateTime fechaHora;

    private int numPersonas;

    @Enumerated(EnumType.STRING)
    private EstadoReserva estado;

    private Long clienteId;

    private Long mesaId;
    private Long meseroId;

    protected Reserva() {
        // constructor vacío que exige JPA
    }

    public Reserva(LocalDateTime fechaHora, int numPersonas, Long clienteId,
                    Long mesaId, Long meseroId) {
        this.fechaHora = fechaHora;
        this.numPersonas = numPersonas;
        this.clienteId = clienteId;
        this.mesaId = mesaId;
        this.meseroId = meseroId;
        this.estado = EstadoReserva.PENDIENTE;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LocalDateTime getFechaHora() {
        return fechaHora;
    }

    public void setFechaHora(LocalDateTime fechaHora) {
        this.fechaHora = fechaHora;
    }

    public int getNumPersonas() {
        return numPersonas;
    }

    public void setNumPersonas(int numPersonas) {
        this.numPersonas = numPersonas;
    }

    public EstadoReserva getEstado() {
        return estado;
    }

    public void setEstado(EstadoReserva estado) {
        this.estado = estado;
    }

    public Long getClienteId() {
        return clienteId;
    }

    public void setClienteId(Long clienteId) {
        this.clienteId = clienteId;
    }

    public Long getMesaId() {
        return mesaId;
    }

    public void setMesaId(Long mesaId) {
        this.mesaId = mesaId;
    }

    public Long getMeseroId() {
        return meseroId;
    }

    public void setMeseroId(Long meseroId) {
        this.meseroId = meseroId;
    }

    public void confirmar() {
        this.estado = EstadoReserva.CONFIRMADA;
    }

    // TODO Avance 2: comprobar que la mesa no esté ya ocupada al confirmar
    // (requiere consultar salon-service; fuera de alcance del Avance 1)
    public void cancelar() {
        this.estado = EstadoReserva.CANCELADA;
    }

    @Override
    public String toString() {
        return "Reserva #" + id
                + " - " + estado
                + " - cliente " + clienteId
                + " - mesa " + mesaId
                + " - " + numPersonas + " personas"
                + " - " + fechaHora;
    }
}