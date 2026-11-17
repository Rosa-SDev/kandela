package com.restaurante.usuarios.repository;

import com.restaurante.usuarios.model.Usuario;
import org.springframework.data.mongodb.repository.MongoRepository;

import java.util.Optional;

/**
 * Acceso a la coleccion "usuarios".
 *
 * Un solo repositorio para los cuatro roles: devuelve Usuario, y cada documento
 * vuelve como su subclase (Mesero, Cajero...) gracias al _class que guarda.
 *
 * Los dos metodos se traducen a consultas de MongoDB a partir de su nombre.
 * IgnoreCase se convierte en una expresion regular sin distinguir mayusculas.
 */
public interface UsuarioRepository extends MongoRepository<Usuario, Long> {

    Optional<Usuario> findByCorreoIgnoreCase(String correo);

    boolean existsByCorreoIgnoreCase(String correo);
}
