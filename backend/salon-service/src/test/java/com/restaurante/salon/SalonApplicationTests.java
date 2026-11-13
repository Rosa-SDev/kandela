package com.restaurante.salon;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;

@SpringBootTest
@Import(MongoDePrueba.class)
class SalonApplicationTests {

	@Test
	void contextLoads() {
	}

}
