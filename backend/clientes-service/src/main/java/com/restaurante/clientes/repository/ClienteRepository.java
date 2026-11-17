package com.restaurante.clientes.repository;

import java.util.List;
import java.util.Optional;

import org.springframework.data.mongodb.repository.MongoRepository;

import com.restaurante.clientes.model.Cliente;

/**
 * Acceso a la colección "clientes".
 *
 * De MongoRepository se heredan insert, save, findById, findAllById, findAll y
 * delete. De NumeracionDeClientes, siguienteId. Los demás métodos se traducen
 * a consultas de MongoDB a partir de su propio nombre.
 */
public interface ClienteRepository extends MongoRepository<Cliente, Long>, NumeracionDeClientes {

    Optional<Cliente> findByDocumento(String documento);

    boolean existsByDocumento(String documento);

    List<Cliente> findByNombreContainingIgnoreCase(String nombre);
}
