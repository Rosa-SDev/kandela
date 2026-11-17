package com.restaurante.usuarios.config;

import com.restaurante.usuarios.contador.GeneradorDeIds;
import com.restaurante.usuarios.dto.CrearUsuarioDTO;
import com.restaurante.usuarios.model.Rol;
import com.restaurante.usuarios.repository.UsuarioRepository;
import com.restaurante.usuarios.service.UsuarioService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

/**
 * Inserta los usuarios de demostración de Raíz y Sazón al arrancar.
 *
 * Sin perfil, solo carga si la colección está vacía. MongoDB conserva los datos
 * entre arranques: sin esta guarda, cada reinicio intentaría crear los cinco
 * otra vez. Con el perfil demo, vacía la colección y recarga los cinco.
 *
 * El orden es importante: los id se generan en orden de inserción y los demás
 * servicios los referencian (los meseros 2 y 3 aparecen en reservas y pedidos).
 * Se crean con el servicio, no con el repositorio, para que la contraseña se
 * guarde con hash.
 */
@Component
public class CargaUsuariosDemostracion implements CommandLineRunner {

    private static final Logger LOG = LoggerFactory.getLogger(CargaUsuariosDemostracion.class);

    /** Con este perfil activo, cada arranque deja los usuarios como recién instalados. */
    static final String PERFIL_DEMO = "demo";

    private static final String PASSWORD_DEMOSTRACION = "kandela123";

    private final UsuarioRepository repositorio;
    private final UsuarioService servicio;
    private final GeneradorDeIds generadorDeIds;
    private final Environment entorno;

    public CargaUsuariosDemostracion(UsuarioRepository repositorio, UsuarioService servicio,
                                     GeneradorDeIds generadorDeIds, Environment entorno) {
        this.repositorio = repositorio;
        this.servicio = servicio;
        this.generadorDeIds = generadorDeIds;
        this.entorno = entorno;
    }

    /**
     * Con el perfil demo: vacía "usuarios" y "contadores" antes de cargar. Al
     * vaciar los contadores, los ids vuelven a empezar en 1, que es lo que
     * esperan las reservas y los pedidos de demostración.
     *
     * Se vacían las colecciones en lugar de borrar la base: borrarla eliminaría
     * también el índice único del correo, que Spring crea al arrancar, antes de
     * que se ejecute esta clase.
     */
    @Override
    public void run(String... args) {
        if (entorno.matchesProfiles(PERFIL_DEMO)) {
            repositorio.deleteAll();
            generadorDeIds.reiniciar();
            LOG.info("Perfil demo: usuarios vaciados y contadores reiniciados.");
        } else if (repositorio.count() > 0) {
            return;
        }

        cargarUsuarios();
    }

    private void cargarUsuarios() {
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

        LOG.info("Cargados {} usuarios de demostración.", repositorio.count());
    }
}
