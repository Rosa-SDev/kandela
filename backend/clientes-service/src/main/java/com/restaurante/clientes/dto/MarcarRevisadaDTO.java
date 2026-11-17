package com.restaurante.clientes.dto;

import jakarta.validation.constraints.NotNull;

public record MarcarRevisadaDTO(
    @NotNull(message = "Indica si la reseña quedó revisada")
    Boolean revisada
) { }
