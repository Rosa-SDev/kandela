package com.restaurante.salon;

import com.restaurante.salon.model.EstadoPedido;
import com.restaurante.salon.model.LineaPedido;
import com.restaurante.salon.model.Mesa;
import com.restaurante.salon.model.Pedido;
import com.restaurante.salon.repository.MesaRepository;
import com.restaurante.salon.repository.PedidoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;

/**
 * Carga las mesas y los pedidos en curso de demostración de Raíz y Sazón.
 *
 * Las mesas se guardan en orden de número para que id == numero. Los id de
 * platillo (Arepa = 1 ... Limonada = 6) y de mesero (2 y 3) coinciden con los
 * datos de carta-service y de usuarios-service. La mesa 3 queda libre para la
 * demostración en vivo. No se cargan facturas: la primera que se emita debe
 * ser F-0001.
 */
@Component
public class DatosDeDemostracion implements CommandLineRunner {

    private static final Logger LOG = LoggerFactory.getLogger(DatosDeDemostracion.class);

    private final MesaRepository mesaRepository;
    private final PedidoRepository pedidoRepository;

    public DatosDeDemostracion(MesaRepository mesaRepository, PedidoRepository pedidoRepository) {
        this.mesaRepository = mesaRepository;
        this.pedidoRepository = pedidoRepository;
    }

    @Override
    public void run(String... args) {
        if (mesaRepository.count() > 0) {
            return;
        }

        List<Mesa> mesas = mesaRepository.saveAll(List.of(
                new Mesa(1, 2),
                new Mesa(2, 4),
                new Mesa(3, 4),
                new Mesa(4, 6),
                new Mesa(5, 8),
                new Mesa(6, 2),
                new Mesa(7, 4)));

        Mesa mesa1 = mesas.get(0);
        Mesa mesa2 = mesas.get(1);
        Mesa mesa5 = mesas.get(4);

        // Mesa 1, mesero 2: Ajiaco y Arepa de choclo.
        Pedido pedidoMesa1 = new Pedido(mesa1, 2L, null, null);
        pedidoMesa1.setEstado(EstadoPedido.EN_PREPARACION);
        agregar(pedidoMesa1, 2L, "Ajiaco santafereño", "28000.00", 1);
        agregar(pedidoMesa1, 1L, "Arepa de choclo", "9000.00", 1);

        // Mesa 2, mesero 3: dos Bandejas y una Sobrebarriga.
        Pedido pedidoMesa2 = new Pedido(mesa2, 3L, null, "Una bandeja sin aguacate.");
        pedidoMesa2.setEstado(EstadoPedido.EN_PREPARACION);
        agregar(pedidoMesa2, 3L, "Bandeja paisa", "38000.00", 2);
        agregar(pedidoMesa2, 4L, "Sobrebarriga al horno", "36000.00", 1);

        // Mesa 5, mesero 3: tres Bandejas y dos Postres de natas, recién enviado a cocina.
        Pedido pedidoMesa5 = new Pedido(mesa5, 3L, null,
                "Alergia a mariscos. Sin contaminación cruzada en plancha.");
        pedidoMesa5.setEstado(EstadoPedido.EN_COCINA);
        agregar(pedidoMesa5, 3L, "Bandeja paisa", "38000.00", 3);
        agregar(pedidoMesa5, 5L, "Postre de natas", "12000.00", 2);

        mesa1.ocupar();
        mesa2.ocupar();
        mesa5.ocupar();
        mesaRepository.saveAll(List.of(mesa1, mesa2, mesa5));

        pedidoRepository.saveAll(List.of(pedidoMesa1, pedidoMesa2, pedidoMesa5));

        LOG.info("Cargadas {} mesas y {} pedidos de demostración.",
                mesaRepository.count(), pedidoRepository.count());
    }

    /** Agrega una línea por unidad, con el nombre y el precio congelados como en un pedido real. */
    private static void agregar(Pedido pedido, Long platilloId, String nombre, String precio, int unidades) {
        for (int i = 0; i < unidades; i++) {
            pedido.agregarPlatillo(new LineaPedido(platilloId, nombre, new BigDecimal(precio), pedido));
        }
    }
}