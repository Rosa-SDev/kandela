package com.restaurante.clientes.config;

import java.time.LocalDate;
import java.time.LocalDateTime;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import com.restaurante.clientes.model.Cliente;
import com.restaurante.clientes.model.Reserva;
import com.restaurante.clientes.repository.ClienteRepository;
import com.restaurante.clientes.repository.ReservaRepository;

/**
 * Carga los clientes y las reservas de demostración de Raíz y Sazón.
 *
 * Las reservas son relativas a la fecha de arranque y todas respetan la
 * capacidad de su mesa (mesa 4 = 6 personas, mesa 2 = 4, mesa 1 = 2). Los id
 * de mesa y de mesero coinciden con los datos de salon-service y de
 * usuarios-service.
 */
@Component
public class DatosDePrueba implements CommandLineRunner {

    private final ClienteRepository clienteRepository;
    private final ReservaRepository reservaRepository;

    public DatosDePrueba(ClienteRepository clienteRepository, ReservaRepository reservaRepository) {
        this.clienteRepository = clienteRepository;
        this.reservaRepository = reservaRepository;
    }

    @Override
    public void run(String... args) {
        if (clienteRepository.count() > 0) {
            return;
        }

        Cliente ana = clienteRepository.save(new Cliente("Ana Torres", "1001234567", "3001234567"));
        Cliente luis = clienteRepository.save(new Cliente("Luis Ramírez", "1007654321", "3007654321"));
        Cliente marcela = clienteRepository.save(new Cliente("Marcela Gómez", "1009988776", "3009988776"));

        // Marcela: hoy 19:00, 6 personas, mesa 4, mesero 2, confirmada.
        Reserva deMarcela = new Reserva(aLas(0, 19, 0), 6, marcela, 4L, 2L);
        deMarcela.confirmar();
        reservaRepository.save(deMarcela);

        // Ana: mañana 19:00, 4 personas, mesa 2, mesero 3, pendiente.
        reservaRepository.save(new Reserva(aLas(1, 19, 0), 4, ana, 2L, 3L));

        // Luis: pasado mañana 20:30, 2 personas, mesa 1, mesero 2, pendiente.
        reservaRepository.save(new Reserva(aLas(2, 20, 30), 2, luis, 1L, 2L));
    }

    /** Fecha y hora a partir de hoy: {@code dias} días adelante, a la hora y minuto dados. */
    private static LocalDateTime aLas(int dias, int hora, int minuto) {
        return LocalDate.now().plusDays(dias).atTime(hora, minuto);
    }
}