package com.restaurante.salon;

import com.restaurante.salon.model.EstadoMesa;
import com.restaurante.salon.model.Factura;
import com.restaurante.salon.model.Mesa;
import com.restaurante.salon.model.Pedido;
import com.restaurante.salon.repository.FacturaRepository;
import com.restaurante.salon.repository.MesaRepository;
import com.restaurante.salon.repository.PedidoRepository;
import com.restaurante.salon.service.MesaService;
import org.bson.Document;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.test.context.ActiveProfiles;

import java.util.ArrayList;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Comprueba que el perfil demo deja el salón como recién instalado: 7 mesas
 * con ids 1 a 7, 3 pedidos iniciales, ninguna factura y los contadores
 * reiniciados sin perder los índices únicos.
 */
@SpringBootTest
@ActiveProfiles("demo")
@Import(MongoDePrueba.class)
class DatosDeDemostracionDemoTest {

    @Autowired
    private DatosDeDemostracion datosDeDemostracion;

    @Autowired
    private MesaService mesaService;

    @Autowired
    private MesaRepository mesaRepository;

    @Autowired
    private PedidoRepository pedidoRepository;

    @Autowired
    private FacturaRepository facturaRepository;

    @Autowired
    private MongoTemplate mongo;

    @Test
    void conElPerfilDemoCadaArranqueRecargaMesasYPedidosDesdeElIdUno() {
        mesaService.crear(new Mesa(99, 6));
        Factura extra = new Factura("F-0099", 1L, 5L);
        extra.asignarId(99L);
        facturaRepository.insert(extra);
        assertThat(mesaRepository.count()).isEqualTo(8);
        assertThat(facturaRepository.count()).isEqualTo(1);

        datosDeDemostracion.run();

        assertThat(mesaRepository.count()).isEqualTo(7);
        assertThat(mesaRepository.findAll()).extracting(Mesa::getId)
                .containsExactlyInAnyOrder(1L, 2L, 3L, 4L, 5L, 6L, 7L);
        assertThat(mesaRepository.findById(3L)).get()
                .extracting(Mesa::getEstado).isEqualTo(EstadoMesa.LIBRE);
        assertThat(mesaRepository.findById(1L)).get()
                .extracting(Mesa::getEstado).isEqualTo(EstadoMesa.OCUPADA);

        assertThat(pedidoRepository.count()).isEqualTo(3);
        assertThat(pedidoRepository.findAll()).extracting(Pedido::getId)
                .containsExactlyInAnyOrder(1L, 2L, 3L);
        assertThat(facturaRepository.count()).isZero();

        Document contadorMesas = mongo.getCollection("contadores").find(new Document("_id", "mesas")).first();
        Document contadorPedidos = mongo.getCollection("contadores").find(new Document("_id", "pedidos")).first();
        Document contadorLineas = mongo.getCollection("contadores").find(new Document("_id", "lineas")).first();
        Document contadorFacturas = mongo.getCollection("contadores").find(new Document("_id", "facturas")).first();

        assertThat(contadorMesas.get("valor")).isEqualTo(7L);
        assertThat(contadorPedidos.get("valor")).isEqualTo(3L);
        assertThat(contadorLineas.get("valor")).isEqualTo(10L);
        assertThat(contadorFacturas).isNull();
    }

    @Test
    void vaciarLasColeccionesConservaLosIndicesUnicosDeMesaYFactura() {
        datosDeDemostracion.run();

        boolean indiceUnicoMesa = mongo.getCollection("mesas").listIndexes()
                .into(new ArrayList<>()).stream()
                .anyMatch(indice -> Boolean.TRUE.equals(indice.get("unique")));
        boolean indiceUnicoFactura = mongo.getCollection("facturas").listIndexes()
                .into(new ArrayList<>()).stream()
                .anyMatch(indice -> Boolean.TRUE.equals(indice.get("unique")));

        assertThat(indiceUnicoMesa).isTrue();
        assertThat(indiceUnicoFactura).isTrue();
    }
}
