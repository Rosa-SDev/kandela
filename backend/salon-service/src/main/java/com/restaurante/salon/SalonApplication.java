package com.restaurante.salon;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@OpenAPIDefinition(info = @Info(
		title = "Kandela · salon-service",
		version = "3.0",
		description = "Gestiona las mesas, los pedidos con sus platillos y las facturas del salón."))
@SpringBootApplication
public class SalonApplication {

	public static void main(String[] args) {
		SpringApplication.run(SalonApplication.class, args);
	}

}
