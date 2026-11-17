package com.restaurante.clientes;

import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.context.annotation.Bean;
import org.testcontainers.mongodb.MongoDBContainer;

/**
 * MongoDB de usar y tirar para las pruebas que necesitan la base de datos.
 *
 * Testcontainers arranca un contenedor mongo:8 en un puerto libre, y
 * @ServiceConnection le pasa a Spring su direccion en lugar de la de
 * application.yml. Asi las pruebas nunca tocan el MongoDB de desarrollo.
 *
 * Se importa con @Import(MongoDePrueba.class). Spring reutiliza el mismo
 * contenedor en todas las clases de prueba que comparten configuracion.
 */
@TestConfiguration(proxyBeanMethods = false)
public class MongoDePrueba {

    @Bean
    @ServiceConnection
    MongoDBContainer contenedorMongo() {
        return new MongoDBContainer("mongo:8");
    }
}
