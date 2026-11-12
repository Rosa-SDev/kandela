package com.restaurante.salon.model;

import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * Línea de un pedido que guarda una copia congelada de los datos del platillo.
 *
 * Va embebida dentro del documento Pedido (no tiene colección propia): una
 * línea nunca se consulta sola, siempre entra y sale como parte del pedido.
 * Conserva un id numérico del contador "lineas" porque DELETE
 * /api/pedidos/{id}/platillos/{lineaId} la identifica por ese número.
 *
 * Desnormalización deliberada: se copian nombre y precioUnitario para que
 * aumentos futuros en la carta no alteren facturas históricas ya emitidas.
 */
public class LineaPedido {

    private static final int DECIMALES = 2;

    private Long id;

    private Long platilloId; // Referencia al microservicio carta-service

    private String nombre; // Copia congelada

    private BigDecimal precioUnitario; // Copia congelada

    protected LineaPedido() {
    }

    public LineaPedido(Long platilloId, String nombre, BigDecimal precioUnitario) {
        this.platilloId = platilloId;
        this.nombre = nombre;
        this.precioUnitario = precioUnitario != null
                ? precioUnitario.setScale(DECIMALES, RoundingMode.HALF_UP)
                : BigDecimal.ZERO.setScale(DECIMALES);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public void asignarId(Long id) {
        if (this.id != null) {
            throw new IllegalStateException("La línea ya tiene el id " + this.id + ".");
        }
        this.id = id;
    }

    public Long getPlatilloId() {
        return platilloId;
    }

    public void setPlatilloId(Long platilloId) {
        this.platilloId = platilloId;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public BigDecimal getPrecioUnitario() {
        return precioUnitario;
    }

    public void setPrecioUnitario(BigDecimal precioUnitario) {
        this.precioUnitario = precioUnitario;
    }
}
