package com.restaurante.clientes;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

/**
 * Comprueba que el servicio arranca completo contra un MongoDB real.
 */
@SpringBootTest
@Import(MongoDePrueba.class)
class ClientesApplicationTests {

	@Test
	void contextLoads() {
	}

}
