package com.restaurante.clientes.repository;

import java.util.List;

import org.springframework.data.domain.Sort;
import org.springframework.data.mongodb.repository.MongoRepository;

import com.restaurante.clientes.model.AccionDelAgente;
import com.restaurante.clientes.model.Resena;

/**
 * Acceso a la colección "resenas".
 *
 * findByDecisionAccion busca dentro del documento embebido: Spring Data arma
 * la consulta sobre el campo "decision.accion".
 */
public interface ResenaRepository extends MongoRepository<Resena, Long>, NumeracionDeResenas {

    List<Resena> findByDecisionAccion(AccionDelAgente accion, Sort orden);

    List<Resena> findByRevisada(boolean revisada, Sort orden);

    List<Resena> findByDecisionAccionAndRevisada(AccionDelAgente accion, boolean revisada, Sort orden);
}
