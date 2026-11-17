package com.restaurante.clientes.repository;

/**
 * Le agrega al repositorio de clientes la forma de pedir el siguiente id.
 *
 * Spring Data junta este método con los de MongoRepository: lo implementa
 * NumeracionDeClientesImpl, que Spring encuentra por el nombre (el de la interfaz
 * más «Impl»).
 */
public interface NumeracionDeClientes {

    /** El id que le toca al siguiente cliente: 1, 2, 3... */
    long siguienteId();
}
