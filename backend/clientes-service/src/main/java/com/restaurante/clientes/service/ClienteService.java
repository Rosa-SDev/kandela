package com.restaurante.clientes.service;

import java.util.List;

import org.springframework.stereotype.Service;

import com.restaurante.clientes.dto.ClienteDTO;
import com.restaurante.clientes.dto.CrearClienteDTO;
import com.restaurante.clientes.exception.ConflictoException;
import com.restaurante.clientes.exception.NoEncontradoException;
import com.restaurante.clientes.model.Cliente;
import com.restaurante.clientes.repository.ClienteRepository;
import com.restaurante.clientes.repository.ReservaRepository;

@Service
public class ClienteService {

    private final ClienteRepository clienteRepository;
    private final ReservaRepository reservaRepository;

    public ClienteService(ClienteRepository clienteRepository, ReservaRepository reservaRepository) {
        this.clienteRepository = clienteRepository;
        this.reservaRepository = reservaRepository;
    }

    public List<ClienteDTO> listar(String nombre) {
        List<Cliente> clientes = (nombre == null || nombre.isBlank())
                ? clienteRepository.findAll()
                : clienteRepository.findByNombreContainingIgnoreCase(nombre);
        return clientes.stream().map(ClienteDTO::de).toList();
    }

    public ClienteDTO buscarPorId(Long id) {
        return ClienteDTO.de(buscarEntidad(id));
    }

    /**
     * Es el único sitio que crea clientes, también para los datos de
     * demostración, y por eso el único que asigna ids.
     *
     * El id se pide después de comprobar el documento, para no gastar un número
     * en un cliente que se va a rechazar. Se guarda con insert y no con save:
     * insert falla si el id ya existe, mientras que save reemplazaría en
     * silencio al cliente que tuviera ese id.
     */
    public ClienteDTO crear(CrearClienteDTO datos) {
        if (clienteRepository.existsByDocumento(datos.documento())) {
            throw new ConflictoException(
                "Ya existe un cliente con el documento " + datos.documento() + ".");
        }
        Cliente cliente = new Cliente(datos.nombre(), datos.documento(), datos.telefono());
        cliente.asignarId(clienteRepository.siguienteId());
        return ClienteDTO.de(clienteRepository.insert(cliente));
    }

    public ClienteDTO actualizar(Long id, CrearClienteDTO datos) {
        Cliente cliente = buscarEntidad(id);

        clienteRepository.findByDocumento(datos.documento())
                .filter(otro -> !otro.getId().equals(id))
                .ifPresent(otro -> {
                    throw new ConflictoException(
                        "Ya existe otro cliente con el documento " + datos.documento() + ".");
                });

        cliente.setNombre(datos.nombre());
        cliente.setDocumento(datos.documento());
        cliente.setTelefono(datos.telefono());
        // MongoDB no guarda solo lo que cambió: save reemplaza el documento completo.
        return ClienteDTO.de(clienteRepository.save(cliente));
    }

    public void eliminar(Long id) {
        Cliente cliente = buscarEntidad(id);
        if (reservaRepository.existsByClienteId(id)) {
            throw new ConflictoException(
                "No se puede eliminar el cliente " + cliente.getNombre() + " porque tiene reservas asociadas.");
        }
        clienteRepository.delete(cliente);
    }

    private Cliente buscarEntidad(Long id) {
        return clienteRepository.findById(id)
                .orElseThrow(() -> new NoEncontradoException("No existe un cliente con id " + id + "."));
    }
}