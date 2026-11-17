package com.restaurante.carta;

import com.restaurante.carta.contador.GeneradorDeIds;
import com.restaurante.carta.model.Platillo;
import com.restaurante.carta.repository.PlatilloRepository;
import com.restaurante.carta.service.PlatilloService;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

/**
 * Carga la carta de demostración de Raíz y Sazón al arrancar el servicio.
 *
 * CommandLineRunner es una interfaz de un solo metodo que Spring ejecuta una
 * vez, justo despues de terminar de arrancar el contexto.
 *
 * Los platillos se crean con PlatilloService.crear, el mismo camino que usa la
 * API: asi reciben su id del contador igual que cualquier otro platillo.
 *
 * El orden importa: los id se reparten en orden de creacion y salon-service
 * los referencia en los pedidos de demostracion (Arepa = 1 ... Limonada = 6).
 *
 * Los precios se construyen con new BigDecimal("38000.00"), desde texto: un
 * double no representa exactamente los decimales y arrastraria error.
 */
@Component
public class DatosDeDemostracion implements CommandLineRunner {

    private static final Logger LOG = LoggerFactory.getLogger(DatosDeDemostracion.class);

    /** Con este perfil activo, cada arranque deja la carta como recien instalada. */
    static final String PERFIL_DEMO = "demo";

    private final PlatilloService servicio;
    private final PlatilloRepository repositorio;
    private final GeneradorDeIds generadorDeIds;
    private final Environment entorno;

    public DatosDeDemostracion(PlatilloService servicio, PlatilloRepository repositorio,
                               GeneradorDeIds generadorDeIds, Environment entorno) {
        this.servicio = servicio;
        this.repositorio = repositorio;
        this.generadorDeIds = generadorDeIds;
        this.entorno = entorno;
    }

    /**
     * Con el perfil demo: vacia "platillos" y "contadores" y recarga los seis.
     * Al vaciar los contadores, los ids vuelven a empezar en 1, que es lo que
     * esperan los pedidos de demostracion de salon-service.
     *
     * Se vacian las colecciones en lugar de borrar la base: borrarla eliminaria
     * tambien el indice unico del nombre, que Spring crea al arrancar, antes de
     * que se ejecute esta clase.
     *
     * Sin el perfil: solo carga si la coleccion esta vacia. MongoDB conserva los
     * datos entre arranques y, sin esta guarda, cada reinicio intentaria crear
     * los seis otra vez.
     */
    @Override
    public void run(String... args) {
        if (entorno.matchesProfiles(PERFIL_DEMO)) {
            repositorio.deleteAll();
            generadorDeIds.reiniciar();
            LOG.info("Perfil demo: carta vaciada y contadores reiniciados.");
        } else if (repositorio.count() > 0) {
            return;
        }

        cargarCarta();
    }

    private void cargarCarta() {
        List.of(
                new Platillo("Arepa de choclo",
                             "Maíz tierno asado con queso campesino",
                             "Entradas", new BigDecimal("9000.00"), true),
                new Platillo("Ajiaco santafereño",
                             "Pollo, tres papas, mazorca, alcaparras y crema",
                             "Sopas", new BigDecimal("28000.00"), true),
                new Platillo("Bandeja paisa",
                             "Chicharrón, fríjoles, arroz, huevo y aguacate",
                             "Fuertes", new BigDecimal("38000.00"), true),
                new Platillo("Sobrebarriga al horno",
                             "Hogao criollo, papa chorreada y yuca",
                             "Fuertes", new BigDecimal("36000.00"), true),
                new Platillo("Postre de natas",
                             "Natas en almíbar de panela",
                             "Postres", new BigDecimal("12000.00"), true),
                new Platillo("Limonada de coco",
                             "Limón, crema de coco y hielo",
                             "Bebidas", new BigDecimal("11000.00"), false))
            .forEach(servicio::crear);

        LOG.info("Cargados {} platillos de demostración.", repositorio.count());
    }
}
