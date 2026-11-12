package com.restaurante.salon.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;

/**
 * Factura de un pedido. Es un documento de la colección "facturas".
 *
 * Aquí viven los impuestos: Pedido.calcularTotal() devuelve el consumo limpio
 * y esta clase le aplica el impuesto al consumo (8 %) y congela las tres cifras.
 */
@Document("facturas")
public class Factura {

    /** Impuesto al consumo del 8 %. Constante con dos decimales. */
    public static final BigDecimal IMPUESTO_CONSUMO = new BigDecimal("0.08");

    /** Todos los importes se guardan con dos decimales. */
    private static final int DECIMALES = 2;

    @Id
    private Long id;

    private String numero;

    private LocalDateTime fecha;

    private BigDecimal subtotal;

    private BigDecimal impuestos;

    private BigDecimal total;

    private boolean anulada;

    private Long pedidoId;

    private Long cajeroId; // Referencia a usuarios-service

    protected Factura() {
    }

    public Factura(String numero, Long pedidoId, Long cajeroId) {
        this.numero = numero;
        this.pedidoId = pedidoId;
        this.cajeroId = cajeroId;
        this.subtotal = BigDecimal.ZERO.setScale(DECIMALES);
        this.impuestos = BigDecimal.ZERO.setScale(DECIMALES);
        this.total = BigDecimal.ZERO.setScale(DECIMALES);
        this.anulada = false;
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void asignarId(Long id) {
        if (this.id != null) {
            throw new IllegalStateException("La factura ya tiene el id " + this.id + ".");
        }
        this.id = id;
    }

    public String getNumero() {
        return numero;
    }

    public void setNumero(String numero) {
        this.numero = numero;
    }

    public LocalDateTime getFecha() {
        return fecha;
    }

    public BigDecimal getSubtotal() {
        return subtotal;
    }

    public BigDecimal getImpuestos() {
        return impuestos;
    }

    public BigDecimal getTotal() {
        return total;
    }

    public boolean isAnulada() {
        return anulada;
    }

    public Long getPedidoId() {
        return pedidoId;
    }

    public void setPedidoId(Long pedidoId) {
        this.pedidoId = pedidoId;
    }

    public Long getCajeroId() {
        return cajeroId;
    }

    public void setCajeroId(Long cajeroId) {
        this.cajeroId = cajeroId;
    }

    /**
     * Congela las tres cifras y la fecha a partir del pedido facturado.
     *
     * Subtotal llega en escala 2 desde Pedido.calcularTotal().
     * Los impuestos se multiplican y redondean a 2 decimales con HALF_UP.
     * Total es la suma exacta de subtotal + impuestos ya redondeados.
     */
    public void emitir(Pedido pedido) {
        this.fecha = LocalDateTime.now();
        this.subtotal = pedido.calcularTotal();
        this.impuestos = subtotal.multiply(IMPUESTO_CONSUMO)
                                 .setScale(DECIMALES, RoundingMode.HALF_UP);
        this.total = subtotal.add(impuestos);
    }

    /**
     * Marca la factura como anulada sin poner los importes en cero,
     * para preservar el registro histórico de lo facturado.
     */
    public void anular() {
        this.anulada = true;
    }

    @Override
    public String toString() {
        return "Factura " + numero
                + " - subtotal $" + subtotal
                + " - impuestos $" + impuestos
                + " - total $" + total
                + (anulada ? " - ANULADA" : "");
    }
}
