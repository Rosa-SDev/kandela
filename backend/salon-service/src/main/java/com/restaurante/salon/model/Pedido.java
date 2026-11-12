package com.restaurante.salon.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Pedido de una mesa. Es un documento de la colección "pedidos".
 *
 * Las líneas (LineaPedido) van embebidas dentro del mismo documento con
 * repetición (dos hamburguesas = dos elementos en la lista). La cantidad solo
 * existe en la vista.
 *
 * La mesa se referencia por su identificador (mesaId) porque es una entidad
 * independiente que sobrevive al pedido.
 *
 * El total calculado es el consumo SIN impuestos. Los impuestos y el total
 * definitivo son responsabilidad de Factura.
 */
@Document("pedidos")
public class Pedido {

    private static final int DECIMALES = 2;

    @Id
    private Long id;

    private LocalDateTime fechaHora;

    private EstadoPedido estado;

    private String observaciones;

    private MetodoPago metodoPago;

    private BigDecimal montoPagado;

    private LocalDateTime fechaPago;

    private Long mesaId;

    private Long meseroId; // Referencia a usuarios-service

    private Long cocineroId; // Referencia a usuarios-service

    private Long clienteId; // Referencia a clientes-service, puede ser null

    private List<LineaPedido> platillos = new ArrayList<>();

    protected Pedido() {
    }

    public Pedido(Long mesaId, Long meseroId, Long clienteId, String observaciones) {
        this.mesaId = mesaId;
        this.meseroId = meseroId;
        this.clienteId = clienteId;
        this.observaciones = observaciones;
        this.fechaHora = LocalDateTime.now();
        this.estado = EstadoPedido.ABIERTO;
        this.platillos = new ArrayList<>();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void asignarId(Long id) {
        if (this.id != null) {
            throw new IllegalStateException("El pedido ya tiene el id " + this.id + ".");
        }
        this.id = id;
    }

    public LocalDateTime getFechaHora() {
        return fechaHora;
    }

    public void setFechaHora(LocalDateTime fechaHora) {
        this.fechaHora = fechaHora;
    }

    public EstadoPedido getEstado() {
        return estado;
    }

    public void setEstado(EstadoPedido estado) {
        this.estado = estado;
    }

    public String getObservaciones() {
        return observaciones;
    }

    public void setObservaciones(String observaciones) {
        this.observaciones = observaciones;
    }

    public MetodoPago getMetodoPago() {
        return metodoPago;
    }

    public BigDecimal getMontoPagado() {
        return montoPagado;
    }

    public LocalDateTime getFechaPago() {
        return fechaPago;
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

    public Long getCocineroId() {
        return cocineroId;
    }

    public void setCocineroId(Long cocineroId) {
        this.cocineroId = cocineroId;
    }

    public Long getClienteId() {
        return clienteId;
    }

    public void setClienteId(Long clienteId) {
        this.clienteId = clienteId;
    }

    public List<LineaPedido> getPlatillos() {
        return platillos;
    }

    /** Agrega una línea de platillo embebida en el pedido. */
    public void agregarPlatillo(LineaPedido linea) {
        platillos.add(linea);
    }

    /** Quita una línea específica por su ID. */
    public boolean quitarPlatillo(Long lineaId) {
        return platillos.removeIf(l -> l.getId() != null && l.getId().equals(lineaId));
    }

    /**
     * Suma de los precios de los platillos, SIN impuestos.
     * Siempre devuelve con escala 2 y RoundingMode.HALF_UP (nunca null).
     */
    public BigDecimal calcularTotal() {
        BigDecimal total = BigDecimal.ZERO;
        for (LineaPedido pl : platillos) {
            total = total.add(pl.getPrecioUnitario());
        }
        return total.setScale(DECIMALES, RoundingMode.HALF_UP);
    }

    /**
     * Registra el pago en el pedido.
     */
    public void registrarPago(MetodoPago met, BigDecimal monto) {
        this.metodoPago = met;
        this.montoPagado = monto != null ? monto.setScale(DECIMALES, RoundingMode.HALF_UP) : null;
        this.fechaPago = LocalDateTime.now();
    }

    /**
     * Verdadero cuando hay un pago registrado que cubre al menos el consumo sin impuestos.
     */
    public boolean estaPagado() {
        if (metodoPago == null || montoPagado == null) {
            return false;
        }
        return montoPagado.compareTo(calcularTotal()) >= 0;
    }

    /**
     * Cierra el pedido marcándolo como pagado.
     */
    public void cerrar() {
        this.estado = EstadoPedido.PAGADO;
    }

    /**
     * Cancela el pedido.
     */
    public void cancelar() {
        this.estado = EstadoPedido.CANCELADO;
    }

    @Override
    public String toString() {
        return "Pedido #" + id
                + " - " + estado
                + " - mesa " + (mesaId != null ? mesaId : "-")
                + " - " + platillos.size() + " platillos"
                + " - $" + calcularTotal();
    }
}
