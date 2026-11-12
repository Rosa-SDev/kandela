package com.restaurante.clientes.config;

import java.time.LocalDate;
import java.time.LocalDateTime;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Component;

import com.restaurante.clientes.contador.GeneradorDeIds;
import com.restaurante.clientes.dto.ClienteDTO;
import com.restaurante.clientes.dto.CrearClienteDTO;
import com.restaurante.clientes.model.Reserva;
import com.restaurante.clientes.repository.ClienteRepository;
import com.restaurante.clientes.repository.ReservaRepository;
import com.restaurante.clientes.service.ClienteService;
import com.restaurante.clientes.service.ReservaService;

/**
 * Carga los clientes y las reservas de demostración de Raíz y Sazón.
 *
 * Sin perfil, solo carga si no hay clientes: MongoDB conserva los datos entre
 * arranques y, sin esta guarda, cada reinicio intentaría crearlos otra vez.
 * Con el perfil demo, vacía las colecciones y recarga los datos de ejemplo.
 *
 * Se crean con los servicios, el mismo camino que usa la API, para que reciban
 * su id del contador. El orden importa: Ana = 1, Luis = 2, Marcela = 3.
 *
 * Las reservas son relativas a la fecha de arranque y todas respetan la
 * capacidad de su mesa (mesa 4 = 6 personas, mesa 2 = 4, mesa 1 = 2). Los id
 * de mesa y de mesero coinciden con los datos de salon-service y de
 * usuarios-service. Se registran sin consultar al salón, que puede no estar
 * encendido todavía.
 */
@Component
public class DatosDePrueba implements CommandLineRunner {

    private static final Logger LOG = LoggerFactory.getLogger(DatosDePrueba.class);

    /** Con este perfil activo, cada arranque deja clientes y reservas como recién instalados. */
    static final String PERFIL_DEMO = "demo";

    private final ClienteRepository clienteRepository;
    private final ReservaRepository reservaRepository;
    private final ClienteService clienteService;
    private final ReservaService reservaService;
    private final GeneradorDeIds generadorDeIds;
    private final Environment entorno;

    public DatosDePrueba(ClienteRepository clienteRepository, ReservaRepository reservaRepository,
                         ClienteService clienteService, ReservaService reservaService,
                         GeneradorDeIds generadorDeIds, Environment entorno) {
        this.clienteRepository = clienteRepository;
        this.reservaRepository = reservaRepository;
        this.clienteService = clienteService;
        this.reservaService = reservaService;
        this.generadorDeIds = generadorDeIds;
        this.entorno = entorno;
    }

    /**
     * Con el perfil demo: vacía "reservas", "clientes" y "contadores" antes de
     * cargar. Al vaciar los contadores, los ids vuelven a empezar en 1.
     *
     * Se vacían las colecciones en lugar de borrar la base: borrarla eliminaría
     * también el índice único del documento, que Spring crea al arrancar, antes
     * de que se ejecute esta clase.
     */
    @Override
    public void run(String... args) {
        if (entorno.matchesProfiles(PERFIL_DEMO)) {
            reservaRepository.deleteAll();
            clienteRepository.deleteAll();
            generadorDeIds.reiniciar();
            LOG.info("Perfil demo: clientes y reservas vaciados, contadores reiniciados.");
        } else if (clienteRepository.count() > 0) {
            return;
        }

        cargarDatos();
    }

    private void cargarDatos() {
        ClienteDTO ana = clienteService.crear(new CrearClienteDTO("Ana Torres", "1001234567", "3001234567"));
        ClienteDTO luis = clienteService.crear(new CrearClienteDTO("Luis Ramírez", "1007654321", "3007654321"));
        ClienteDTO marcela = clienteService.crear(new CrearClienteDTO("Marcela Gómez", "1009988776", "3009988776"));

        // Marcela: hoy 19:00, 6 personas, mesa 4, mesero 2, confirmada.
        Reserva deMarcela = new Reserva(aLas(0, 19, 0), 6, marcela.id(), 4L, 2L);
        deMarcela.confirmar();
        reservaService.registrar(deMarcela);

        // Ana: mañana 19:00, 4 personas, mesa 2, mesero 3, pendiente.
        reservaService.registrar(new Reserva(aLas(1, 19, 0), 4, ana.id(), 2L, 3L));

        // Luis: pasado mañana 20:30, 2 personas, mesa 1, mesero 2, pendiente.
        reservaService.registrar(new Reserva(aLas(2, 20, 30), 2, luis.id(), 1L, 2L));

        LOG.info("Cargados {} clientes y {} reservas de demostración.",
                clienteRepository.count(), reservaRepository.count());
    }

    /** Fecha y hora a partir de hoy: {@code dias} días adelante, a la hora y minuto dados. */
    private static LocalDateTime aLas(int dias, int hora, int minuto) {
        return LocalDate.now().plusDays(dias).atTime(hora, minuto);
    }
}
