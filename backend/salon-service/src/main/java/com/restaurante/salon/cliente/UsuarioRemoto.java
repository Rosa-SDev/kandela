package com.restaurante.salon.cliente;

public record UsuarioRemoto(
        Long id,
        String nombre,
        String correo,
        String rol,
        Boolean activo
) {}
