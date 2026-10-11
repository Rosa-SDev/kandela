package com.restaurante.salon.cliente;

import com.restaurante.salon.exception.ServicioNoDisponibleException;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientException;

@Component
public class UsuariosClient {

    private static final String USUARIOS_NO_DISPONIBLE = "El servicio de usuarios no está disponible en este momento.";
    private final RestClient cliente;

    public UsuariosClient(@Qualifier("usuariosRestClient") RestClient cliente) {
        this.cliente = cliente;
    }

    public UsuarioRemoto obtener(Long id) {
        try {
            return cliente.get()
                    .uri("/api/usuarios/{id}", id)
                    .retrieve()
                    .body(UsuarioRemoto.class);
        } catch (HttpClientErrorException.NotFound e) {
            return null;
        } catch (RestClientException e) {
            throw new ServicioNoDisponibleException(USUARIOS_NO_DISPONIBLE, e);
        }
    }
}
