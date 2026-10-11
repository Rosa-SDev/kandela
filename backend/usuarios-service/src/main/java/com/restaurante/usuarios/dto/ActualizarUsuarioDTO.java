package com.restaurante.usuarios.dto;

import com.restaurante.usuarios.validation.CorreoValido;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

/**
 * Lo que llega para editar un usuario. El rol no viaja: no se puede cambiar.
 *
 * La contraseña es opcional: si viene vacía o no viene, se conserva la actual.
 * Si viene con texto, debe tener al menos 6 caracteres.
 */
public record ActualizarUsuarioDTO(

        @NotBlank(message = "El nombre es obligatorio")
        String nombre,

        @NotBlank(message = "El correo es obligatorio")
        @CorreoValido
        String correo,

        @Pattern(regexp = "^$|.{6,}", message = "La contraseña debe tener al menos 6 caracteres")
        String password

) { }