package com.restaurante.salon.repository;

import com.restaurante.salon.model.Factura;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface FacturaRepository extends MongoRepository<Factura, Long> {

    Optional<Factura> findByPedidoId(Long pedidoId);

    Optional<Factura> findByPedidoIdAndAnuladaFalse(Long pedidoId);

    Optional<Factura> findByNumero(String numero);
}
