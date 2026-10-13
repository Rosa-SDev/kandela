package com.restaurante.usuarios.config;

import com.restaurante.usuarios.dto.CrearUsuarioDTO;
import com.restaurante.usuarios.model.Rol;
import com.restaurante.usuarios.repository.UsuarioRepository;
import com.restaurante.usuarios.service.UsuarioService;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

/**
 * Inserta los usuarios de demostración de Raíz y Sazón al arrancar, solo si la
 * tabla está vacía. Con H2 en memoria esto se cumple en cada reinicio.
 *
 * El orden es importante: los id se generan en orden de inserción y los demás
 * servicios los referencian (los meseros 2 y 3 aparecen en reservas y pedidos).
 * Se crean con el servicio, no con el repositorio, para que la contraseña se
 * guarde con hash.
 */
@Component
public class CargaUsuariosDemostracion implements CommandLineRunner {

    private static final String PASSWORD_DEMOSTRACION = "kandela123";

    private final UsuarioRepository repositorio;
    private final UsuarioService servicio;

    public CargaUsuariosDemostracion(UsuarioRepository repositorio, UsuarioService servicio) {
        this.repositorio = repositorio;
        this.servicio = servicio;
    }

    @Override
    public void run(String... args) {
        if (repositorio.count() > 0) {
            return;
        }

        servicio.crear(new CrearUsuarioDTO(
                "Laura Méndez", "laura.mendez@raizysazon.co", Rol.ADMINISTRADOR, PASSWORD_DEMOSTRACION));
        servicio.crear(new CrearUsuarioDTO(
                "Carlos Rojas", "carlos.rojas@raizysazon.co", Rol.MESERO, PASSWORD_DEMOSTRACION));
        servicio.crear(new CrearUsuarioDTO(
                "Andrea Pérez", "andrea.perez@raizysazon.co", Rol.MESERO, PASSWORD_DEMOSTRACION));
        servicio.crear(new CrearUsuarioDTO(
                "Jorge Castaño", "jorge.castano@raizysazon.co", Rol.COCINERO, PASSWORD_DEMOSTRACION));
        servicio.crear(new CrearUsuarioDTO(
                "Diana Ríos", "diana.rios@raizysazon.co", Rol.CAJERO, PASSWORD_DEMOSTRACION));
    }
}