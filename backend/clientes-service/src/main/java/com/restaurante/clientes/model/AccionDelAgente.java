package com.restaurante.clientes.model;

/**
 * Lo que decide SentiTriage-ES sobre una reseña.
 *
 * Los nombres son los mismos que devuelve el agente, porque son identificadores
 * de su API y no textos para mostrar:
 * <ul>
 *   <li>ABSTAIN: el agente no está seguro; la reseña la lee una persona.</li>
 *   <li>QUEUE: el agente está seguro de que es negativa; es una queja.</li>
 *   <li>PASS: el agente está seguro de que no es negativa; se almacena.</li>
 * </ul>
 */
public enum AccionDelAgente {
    ABSTAIN,
    QUEUE,
    PASS
}
