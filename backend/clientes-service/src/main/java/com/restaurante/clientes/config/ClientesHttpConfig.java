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
 * «Clientes» aquí son los clientes HTTP, no los clientes del restaurante: el
 * nombre es el mismo en los tres servicios que llaman a otro, para que quien
 * abra cualquiera de ellos encuentre esta clase en el mismo sitio.
 *
 * Hay un bean por servicio remoto, cada uno con la URL base de ese servicio
 * tomada de la configuración, para que ninguna dirección quede escrita dentro
 * del código. Agregar otro servicio es añadir un bean de tres líneas que
 * reutilice clienteHacia.
 *
 * Las llamadas van directas al otro servicio y no a través del gateway: el
 * gateway es la puerta de entrada de las interfaces de usuario, y entre
 * servicios no aporta nada.
 */
@Configuration
public class ClientesHttpConfig {

    /**
     * Tiempo máximo para conectar y para leer la respuesta.
     *
     * Sin un límite, un servicio caído dejaría colgada la petición de quien
     * registra la reserva hasta que el navegador se rindiera. Con dos segundos
     * se responde rápido que el otro servicio no está disponible.
     */
    private static final Duration ESPERA_MAXIMA = Duration.ofSeconds(2);

    @Bean
    public RestClient salonRestClient(@Value("${servicios.salon.url}") String urlDeSalon) {
        return clienteHacia(urlDeSalon);
    }

    /** Arma un cliente apuntado a la raíz de otro servicio, con los tiempos de espera ya puestos. */
    private static RestClient clienteHacia(String urlBase) {
        SimpleClientHttpRequestFactory fabrica = new SimpleClientHttpRequestFactory();
        fabrica.setConnectTimeout(ESPERA_MAXIMA);
        fabrica.setReadTimeout(ESPERA_MAXIMA);

        return RestClient.builder()
                .baseUrl(urlBase)
                .requestFactory(fabrica)
                .build();
    }
}
