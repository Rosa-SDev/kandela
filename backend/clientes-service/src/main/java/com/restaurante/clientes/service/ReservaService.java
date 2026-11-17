package com.restaurante.clientes.service;

import java.time.LocalDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Service;

import com.restaurante.clientes.cliente.MesaRemota;
import com.restaurante.clientes.cliente.SalonClient;
import com.restaurante.clientes.dto.CrearReservaDTO;
import com.restaurante.clientes.dto.ReservaDTO;
import com.restaurante.clientes.exception.NoEncontradoException;
import com.restaurante.clientes.model.Cliente;
import com.restaurante.clientes.model.EstadoReserva;
import com.restaurante.clientes.model.Reserva;
import com.restaurante.clientes.repository.ClienteRepository;
import com.restaurante.clientes.repository.ReservaRepository;
import com.restaurante.clientes.exception.ConflictoException;

@Service
public class ReservaService {

    private final ReservaRepository reservaRepository;
    private final ClienteRepository clienteRepository;
    private final SalonClient salonClient;

    public ReservaService(ReservaRepository reservaRepository, ClienteRepository clienteRepository,
            SalonClient salonClient) {
        this.reservaRepository = reservaRepository;
        this.clienteRepository = clienteRepository;
        this.salonClient = salonClient;
    }

    /**
     * La reserva solo guarda el id del cliente, pero la respuesta lleva también
     * su nombre. En lugar de consultar el cliente de cada reserva (una consulta
     * por fila), se juntan los ids distintos y se traen todos los clientes con
     * un solo findAllById.
     */
    public List<ReservaDTO> listar(EstadoReserva estado) {
        List<Reserva> reservas = (estado == null)
                ? reservaRepository.findAll()
                : reservaRepository.findByEstado(estado);

        Set<Long> idsDeClientes = reservas.stream()
                .map(Reserva::getClienteId)
                .collect(Collectors.toSet());
        Map<Long, String> nombres = clienteRepository.findAllById(idsDeClientes).stream()
                .collect(Collectors.toMap(Cliente::getId, Cliente::getNombre));

        return reservas.stream()
                .map(reserva -> ReservaDTO.de(reserva, nombres.get(reserva.getClienteId())))
                .toList();
    }

    public ReservaDTO buscarPorId(Long id) {
        return aDTO(buscarEntidad(id));
    }

    public ReservaDTO crear(CrearReservaDTO datos) {
        Cliente cliente = clienteRepository.findById(datos.clienteId())
                .orElseThrow(() -> new NoEncontradoException(
                        "No existe un cliente con id " + datos.clienteId() + "."));

        // Se compara por minutos: el formulario original solo maneja "dd/MM/yyyy
        // HH:mm",
        // así que comparar por segundos rechazaría reservas válidas por medio minuto.
        if (datos.fechaHora().truncatedTo(ChronoUnit.MINUTES)
                .isBefore(LocalDateTime.now().truncatedTo(ChronoUnit.MINUTES))) {
            throw new IllegalArgumentException("No se puede reservar para una fecha que ya pasó.");
        }

        if (datos.mesaId() != null) {
            validarCapacidad(datos.mesaId(), datos.numPersonas());
        }

        Reserva reserva = new Reserva(datos.fechaHora(), datos.numPersonas(), cliente.getId(),
                datos.mesaId(), datos.meseroId());
        return ReservaDTO.de(registrar(reserva), cliente.getNombre());
    }

    /**
     * Es el único sitio que guarda reservas nuevas, y por eso el único que
     * asigna ids. Lo usan crear, después de validar la petición, y los datos de
     * demostración, que ya vienen correctos y no deben depender de que el salón
     * esté encendido al arrancar.
     *
     * Se guarda con insert y no con save: insert falla si el id ya existe,
     * mientras que save reemplazaría en silencio la reserva que tuviera ese id.
     */
    public Reserva registrar(Reserva reserva) {
        reserva.asignarId(reservaRepository.siguienteId());
        return reservaRepository.insert(reserva);
    }

    public ReservaDTO cambiarEstado(Long id, EstadoReserva nuevoEstado) {
        Reserva reserva = buscarEntidad(id);
        EstadoReserva actual = reserva.getEstado();

        boolean transicionValida = switch (nuevoEstado) {
            case CONFIRMADA -> actual == EstadoReserva.PENDIENTE;
            case CANCELADA -> actual == EstadoReserva.PENDIENTE || actual == EstadoReserva.CONFIRMADA;
            case CUMPLIDA -> actual == EstadoReserva.CONFIRMADA;
            case PENDIENTE -> false;
        };

        if (!transicionValida) {
            throw new ConflictoException(
                    "No se puede pasar una reserva de " + actual + " a " + nuevoEstado + ".");
        }

        if (nuevoEstado == EstadoReserva.CONFIRMADA) {
            reserva.confirmar();
        } else if (nuevoEstado == EstadoReserva.CANCELADA) {
            reserva.cancelar();
        } else {
            reserva.setEstado(nuevoEstado);
        }

        return aDTO(reservaRepository.save(reserva));
    }

    public void eliminar(Long id) {
        reservaRepository.delete(buscarEntidad(id));
    }

    /**
     * Consulta la mesa en el salón y comprueba que le quepan las personas.
     *
     * Si la mesa no existe, SalonClient ya lanza el 404; si el salón no
     * responde, lanza el 503. Aquí solo queda el 409 de capacidad.
     */
    private void validarCapacidad(Long mesaId, int numPersonas) {
        MesaRemota mesa = salonClient.obtenerMesa(mesaId);
        if (numPersonas > mesa.capacidad()) {
            throw new ConflictoException("La mesa " + mesa.numero() + " no alcanza para " + numPersonas
                    + " personas. Su capacidad es de " + mesa.capacidad() + ".");
        }
    }

    /** Una sola reserva: su cliente se consulta por id para poner el nombre. */
    private ReservaDTO aDTO(Reserva reserva) {
        String nombre = clienteRepository.findById(reserva.getClienteId())
                .map(Cliente::getNombre)
                .orElse(null);
        return ReservaDTO.de(reserva, nombre);
    }

    private Reserva buscarEntidad(Long id) {
        return reservaRepository.findById(id)
                .orElseThrow(() -> new NoEncontradoException("No existe una reserva con id " + id + "."));
    }
}