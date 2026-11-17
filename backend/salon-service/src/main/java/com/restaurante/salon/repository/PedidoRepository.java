package com.restaurante.salon.repository;

import com.restaurante.salon.model.EstadoPedido;
import com.restaurante.salon.model.Pedido;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface PedidoRepository extends MongoRepository<Pedido, Long> {

    List<Pedido> findByEstado(EstadoPedido estado);

    boolean existsByMesaIdAndEstado(Long mesaId, EstadoPedido estado);
}
