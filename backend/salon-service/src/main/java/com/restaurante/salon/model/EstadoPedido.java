package com.restaurante.salon.model;

/**
 * Situación en la que se encuentra un pedido.
 *
 * El recorrido normal es ABIERTO → EN_COCINA → EN_PREPARACION → SERVIDO → PAGADO,
 * y cualquier pedido que no esté pagado se puede CANCELAR.
 *
 * EN_COCINA es el pedido que el mesero ya envió pero que nadie ha empezado a
 * preparar todavía: es lo que alimenta la columna de comandas nuevas del
 * tablero de cocina.
 */
public enum EstadoPedido {
    ABIERTO("Abierto"),
    EN_COCINA("En cocina"),
    EN_PREPARACION("En preparación"),
    SERVIDO("Servido"),
    PAGADO("Pagado"),
    CANCELADO("Cancelado");

    private final String nombreLegible;

    EstadoPedido(String nombreLegible) {
        this.nombreLegible = nombreLegible;
    }

    /**
     * El estado escrito para leerlo dentro de un mensaje de error.
     *
     * No es el texto de las pantallas: cada una llama a los estados como le
     * convenga a quien las usa. Lo que viaja en el JSON sigue siendo el nombre
     * del valor, no este texto.
     */
    public String nombreLegible() {
        return nombreLegible;
    }
}
