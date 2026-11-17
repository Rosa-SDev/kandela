package com.restaurante.usuarios.controller;

import com.restaurante.usuarios.dto.LoginDTO;
import com.restaurante.usuarios.dto.UsuarioDTO;
import com.restaurante.usuarios.service.UsuarioService;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.ExampleObject;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Inicio de sesion de Kandela Admin y Kandela POS.
 *
 * Las anotaciones de io.swagger solo describen la API en Swagger UI
 * (http://localhost:8081/swagger-ui.html); no cambian lo que hace el metodo.
 */
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Autenticación", description = "Inicio de sesión con correo y contraseña")
public class AuthController {

    private final UsuarioService servicio;

    public AuthController(UsuarioService servicio) {
        this.servicio = servicio;
    }

    @PostMapping("/login")
    @Operation(summary = "Iniciar sesión",
               description = "Devuelve el usuario con su rol. El correo no distingue mayúsculas. "
                       + "Un usuario inactivo no puede entrar.")
    @ApiResponse(responseCode = "200", description = "Credenciales correctas: el usuario que inició sesión")
    @ApiResponse(responseCode = "400", description = "Falta el correo o la contraseña, o el JSON está mal formado",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "La contraseña es obligatoria"}""")))
    @ApiResponse(responseCode = "401", description = "Correo o contraseña incorrectos, o usuario inactivo",
                 content = @Content(mediaType = "application/json", examples = @ExampleObject("""
                         {"error": "Correo o contraseña incorrectos."}""")))
    public UsuarioDTO login(@Valid @RequestBody LoginDTO dto) {
        return servicio.autenticar(dto.correo(), dto.password());
    }
}
