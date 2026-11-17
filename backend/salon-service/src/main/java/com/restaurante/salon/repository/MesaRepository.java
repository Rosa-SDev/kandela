package com.restaurante.salon.repository;

import com.restaurante.salon.model.EstadoMesa;
import com.restaurante.salon.model.Mesa;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface MesaRepository extends MongoRepository<Mesa, Long> {

    List<Mesa> findByEstado(EstadoMesa estado);

    boolean existsByNumero(int numero);

    boolean existsByNumeroAndIdNot(int numero, Long id);

    Optional<Mesa> findByNumero(int numero);
}
