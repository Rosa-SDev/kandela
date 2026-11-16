package com.restaurante.clientes.repository;

/**
 * Le agrega al repositorio de reseñas la forma de pedir el siguiente id.
 *
 * Lo implementa NumeracionDeResenasImpl, que Spring encuentra por el nombre.
 */
public interface NumeracionDeResenas {

    /** El id que le toca a la siguiente reseña: 1, 2, 3... */
    long siguienteId();
}
