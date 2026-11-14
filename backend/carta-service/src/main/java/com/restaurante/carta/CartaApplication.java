package com.restaurante.carta;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@OpenAPIDefinition(info = @Info(
		title = "Kandela · carta-service",
		version = "3.0",
		description = "Gestiona los platillos de la carta: precios, disponibilidad y descuentos."))
@SpringBootApplication
public class CartaApplication {

	public static void main(String[] args) {
		SpringApplication.run(CartaApplication.class, args);
	}

}
