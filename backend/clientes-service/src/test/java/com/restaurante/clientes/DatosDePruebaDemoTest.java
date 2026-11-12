package com.restaurante.clientes;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.ArrayList;

import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.ActiveProfiles;

import com.restaurante.clientes.config.DatosDePrueba;
import com.restaurante.clientes.dto.CrearClienteDTO;
import com.restaurante.clientes.model.Cliente;
import com.restaurante.clientes.model.Reserva;
import com.restaurante.clientes.repository.ClienteRepository;
import com.restaurante.clientes.repository.ReservaRepository;
import com.restaurante.clientes.service.ClienteService;

/**
 * El perfil demo deja clientes y reservas como recién instalados en cada
 * arranque: Ana = 1, Luis = 2, Marcela = 3, y sus tres reservas.
 */
@SpringBootTest
@ActiveProfiles("demo")
@Import(MongoDePrueba.class)
class DatosDePruebaDemoTest {

    @Autowired
    private DatosDePrueba datosDePrueba;

    @Autowired
    private ClienteService clienteService;

    @Autowired
    private ClienteRepository clienteRepository;

    @Autowired
    private ReservaRepository reservaRepository;

    @Autowired
    private MongoTemplate mongo;

    @Test
    void conElPerfilDemoCadaArranqueRecargaLosDatosConLosIdsDesde1() throws Exception {
        clienteService.crear(new CrearClienteDTO("Pedro Gómez", "1012345678", null));
        assertThat(clienteRepository.count()).isEqualTo(4);

        datosDePrueba.run();

        assertThat(clienteRepository.findAll()).extracting(Cliente::getId)
                .containsExactlyInAnyOrder(1L, 2L, 3L);
        assertThat(clienteRepository.findById(3L)).get()
                .extracting(Cliente::getNombre).isEqualTo("Marcela Gómez");
        assertThat(reservaRepository.findAll()).extracting(Reserva::getId)
                .containsExactlyInAnyOrder(1L, 2L, 3L);
        assertThat(reservaRepository.findById(1L)).get()
                .extracting(Reserva::getClienteId).isEqualTo(3L);
    }

    @Test
    void vaciarLasColeccionesConservaElIndiceUnicoDelDocumento() throws Exception {
        datosDePrueba.run();

        boolean hayIndiceUnico = mongo.getCollection("clientes").listIndexes()
                .into(new ArrayList<>()).stream()
                .anyMatch(indice -> Boolean.TRUE.equals(indice.get("unique")));
        assertThat(hayIndiceUnico).isTrue();
    }
}
