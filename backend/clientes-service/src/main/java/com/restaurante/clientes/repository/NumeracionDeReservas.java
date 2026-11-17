package com.restaurante.clientes.repository;

/**
 * Le agrega al repositorio de reservas la forma de pedir el siguiente id.
 *
 * Spring Data junta este método con los de MongoRepository: lo implementa
 * NumeracionDeReservasImpl, que Spring encuentra por el nombre (el de la interfaz
 * más «Impl»).
 */
public interface NumeracionDeReservas {

    /** El id que le toca a la siguiente reserva: 1, 2, 3... */
    long siguienteId();
}
