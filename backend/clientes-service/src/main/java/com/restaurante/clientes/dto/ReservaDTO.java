package com.restaurante.clientes.dto;

import java.time.LocalDateTime;

import com.restaurante.clientes.model.EstadoReserva;
import com.restaurante.clientes.model.Reserva;

public record ReservaDTO(Long id, LocalDateTime fechaHora, Integer numPersonas,
                          EstadoReserva estado, Long clienteId, String clienteNombre,
                          Long mesaId, Long meseroId) {

    /**
     * El nombre del cliente no está en la reserva, que solo guarda su id: lo
     * pasa quien arma la respuesta, que ya consultó los clientes.
     */
    public static ReservaDTO de(Reserva r, String clienteNombre) {
        return new ReservaDTO(r.getId(), r.getFechaHora(), r.getNumPersonas(), r.getEstado(),
                r.getClienteId(), clienteNombre, r.getMesaId(), r.getMeseroId());
    }
}