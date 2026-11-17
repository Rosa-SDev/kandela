package com.restaurante.clientes.model;

import java.time.LocalDateTime;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Comentario que deja un cliente del restaurante, por ejemplo desde el QR de su
 * mesa o de su factura.
 *
 * mesaId y pedidoId son solo identificadores (Long), opcionales: la reseña
 * llega desde un formulario público que puede saber la mesa o el pedido, o
 * ninguno de los dos. La mesa y el pedido viven en salon-service.
 *
 * La decisión del agente va embebida (ver DecisionDelAgente). Que la reseña ya
 * se revisó es un dato propio del restaurante, no del agente: por eso va aparte.
 */
@Document("resenas")
public class Resena {

    /** Se guarda como _id. Es un Long que reparte GeneradorDeIds, no un ObjectId. */
    @Id
    private Long id;

    private String texto;

    private LocalDateTime fecha;

    private Long mesaId;
    private Long pedidoId;

    private DecisionDelAgente decision;

    private boolean revisada;

    protected Resena() {
        // constructor vacío que usa Spring Data para leer el documento
    }

    public Resena(String texto, LocalDateTime fecha, Long mesaId, Long pedidoId) {
        this.texto = texto;
        this.fecha = fecha;
        this.mesaId = mesaId;
        this.pedidoId = pedidoId;
    }

    public Long getId() {
        return id;
    }

    public void asignarId(Long id) {
        this.id = id;
    }

    public String getTexto() {
        return texto;
    }

    public LocalDateTime getFecha() {
        return fecha;
    }

    public Long getMesaId() {
        return mesaId;
    }

    public Long getPedidoId() {
        return pedidoId;
    }

    public DecisionDelAgente getDecision() {
        return decision;
    }

    public void clasificar(DecisionDelAgente decision) {
        this.decision = decision;
    }

    public boolean isRevisada() {
        return revisada;
    }

    public void marcarRevisada(boolean revisada) {
        this.revisada = revisada;
    }
}
