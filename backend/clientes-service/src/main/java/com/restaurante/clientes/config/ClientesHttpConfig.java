package com.restaurante.clientes.config;

import java.time.Duration;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.web.client.RestClient;

/**
 * Clientes HTTP con los que este servicio consulta a los demás.
 *
 * La URL base sale de la configuración, para que ninguna dirección quede
 * escrita dentro del código. Las llamadas van directas al otro servicio y no a
 * través del gateway: el gateway es la puerta de entrada de las interfaces de
 * usuario, y entre servicios no aporta nada.
 */
@Configuration
public class ClientesHttpConfig {

    /**
     * Tiempo máximo para conectar y para leer la respuesta.
     *
     * Sin un límite, un salón caído dejaría colgada la creación de la reserva.
     * Con dos segundos se responde rápido que el salón no está disponible.
     */
    private static final Duration ESPERA_MAXIMA = Duration.ofSeconds(2);

    @Bean
    public RestClient salonRestClient(@Value("${servicios.salon.url}") String urlDelSalon) {
        SimpleClientHttpRequestFactory fabrica = new SimpleClientHttpRequestFactory();
        fabrica.setConnectTimeout(ESPERA_MAXIMA);
        fabrica.setReadTimeout(ESPERA_MAXIMA);

        return RestClient.builder()
                .baseUrl(urlDelSalon)
                .requestFactory(fabrica)
                .build();
    }

    /**
     * Cliente de SentiTriage-ES, el agente que clasifica las reseñas.
     *
     * Conectar debe ser igual de rápido que con el salón, pero leer la
     * respuesta puede tardar más: el agente carga su modelo de lenguaje con la
     * primera petición, y esa primera respuesta tarda varios segundos. Por eso
     * la espera de lectura sale de la configuración.
     */
    @Bean
    public RestClient sentiTriageRestClient(@Value("${servicios.sentitriage.url}") String urlDelAgente,
                                            @Value("${servicios.sentitriage.espera-maxima}") Duration esperaDeLectura) {
        SimpleClientHttpRequestFactory fabrica = new SimpleClientHttpRequestFactory();
        fabrica.setConnectTimeout(ESPERA_MAXIMA);
        fabrica.setReadTimeout(esperaDeLectura);

        return RestClient.builder()
                .baseUrl(urlDelAgente)
                .requestFactory(fabrica)
                .build();
    }
}
