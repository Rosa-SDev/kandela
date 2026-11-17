package com.restaurante.carta.repository;

import com.restaurante.carta.model.Platillo;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.List;

/**
 * Acceso a datos de la carta.
 *
 * No se escribe implementacion: Spring la genera al arrancar. De MongoRepository
 * se heredan insert, save, findById, findAll, deleteById y existsById.
 *
 * Los metodos de abajo se traducen a consultas de MongoDB a partir de su propio
 * nombre, que debe coincidir con los campos de Platillo.
 */
public interface PlatilloRepository extends MongoRepository<Platillo, Long> {

    List<Platillo> findByCategoria(String categoria);

    List<Platillo> findByDisponible(boolean disponible);

    List<Platillo> findByCategoriaAndDisponible(String categoria, boolean disponible);

    boolean existsByNombreIgnoreCase(String nombre);
}
