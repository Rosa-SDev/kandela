package com.restaurante.salon.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.MongoDatabaseFactory;
import org.springframework.data.mongodb.MongoTransactionManager;

/**
 * Habilita las transacciones de varios documentos en MongoDB.
 *
 * Spring Data MongoDB no registra un gestor de transacciones por su cuenta
 * porque exige que MongoDB corra como replica set. Al declarar este bean,
 * los métodos anotados con @Transactional agrupan sus lecturas y escrituras
 * en una sola transacción: o se guardan todos los documentos (por ejemplo,
 * el pedido y la mesa ocupada), o no se guarda ninguno.
 */
@Configuration
public class MongoConfig {

    @Bean
    public MongoTransactionManager transactionManager(MongoDatabaseFactory dbFactory) {
        return new MongoTransactionManager(dbFactory);
    }
}
