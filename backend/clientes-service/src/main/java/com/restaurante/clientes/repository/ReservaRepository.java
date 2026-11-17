package com.restaurante.clientes.repository;

import java.util.List;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.restaurante.clientes.model.EstadoReserva;
import com.restaurante.clientes.model.Reserva;

/**
 * Acceso a la colección "reservas".
 *
 * existsByClienteId busca por el campo clienteId de la reserva: así se sabe,
 * sin traer las reservas, si un cliente todavía tiene alguna.
 */
public interface ReservaRepository extends MongoRepository<Reserva, Long>, NumeracionDeReservas {

    List<Reserva> findByEstado(EstadoReserva estado);

    boolean existsByClienteId(Long clienteId);
}
