package com.restaurante.clientes.service;

import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import com.restaurante.clientes.cliente.DecisionRemota;
import com.restaurante.clientes.cliente.SentiTriageClient;
import com.restaurante.clientes.dto.CrearResenaDTO;
import com.restaurante.clientes.dto.ResenaDTO;
import com.restaurante.clientes.exception.ConflictoException;
import com.restaurante.clientes.exception.NoEncontradoException;
import com.restaurante.clientes.exception.ServicioNoDisponibleException;
import com.restaurante.clientes.model.AccionDelAgente;
import com.restaurante.clientes.model.DecisionDelAgente;
import com.restaurante.clientes.model.Resena;
import com.restaurante.clientes.repository.ResenaRepository;

/**
 * Reseñas de los clientes y su clasificación con SentiTriage-ES.
 *
 * La regla central: una reseña nunca se pierde ni se da por buena sin que
 * alguien la haya leído. Si el agente no responde, la reseña se guarda igual,
 * con acción ABSTAIN y sin etiqueta, y aparece entre las que requieren una
 * persona. Es la misma regla que sigue el agente cuando su modelo falla.
 */
@Service
public class ResenaService {

    private static final Logger LOG = LoggerFactory.getLogger(ResenaService.class);

    /** Las más recientes primero; a igual fecha, la de id mayor. */
    private static final Sort MAS_RECIENTES_PRIMERO = Sort.by(Sort.Order.desc("fecha"), Sort.Order.desc("_id"));

    private final ResenaRepository resenaRepository;
    private final SentiTriageClient sentiTriageClient;

    public ResenaService(ResenaRepository resenaRepository, SentiTriageClient sentiTriageClient) {
        this.resenaRepository = resenaRepository;
        this.sentiTriageClient = sentiTriageClient;
    }

    /**
     * Guarda la reseña con la decisión del agente.
     *
     * El id se asigna antes de clasificar para enviárselo al agente, que lo
     * devuelve igual. Se guarda con insert, que falla si el id ya existe.
     */
    public ResenaDTO crear(CrearResenaDTO datos) {
        Resena resena = new Resena(datos.texto().trim(), LocalDateTime.now(), datos.mesaId(), datos.pedidoId());
        resena.asignarId(resenaRepository.siguienteId());

        try {
            resena.clasificar(pedirDecision(resena));
        } catch (ServicioNoDisponibleException excepcion) {
            LOG.warn("Reseña {} guardada sin clasificar: {}", resena.getId(), excepcion.getMessage());
            resena.clasificar(DecisionDelAgente.sinRespuesta(LocalDateTime.now()));
        }

        return ResenaDTO.de(resenaRepository.insert(resena));
    }

    /**
     * Sin filtros devuelve todas, de la más reciente a la más antigua.
     *
     * @param accion   solo las que el agente decidió así
     * @param revisada solo las revisadas (true) o las pendientes (false)
     */
    public List<ResenaDTO> listar(AccionDelAgente accion, Boolean revisada) {
        List<Resena> resenas;
        if (accion != null && revisada != null) {
            resenas = resenaRepository.findByDecisionAccionAndRevisada(accion, revisada, MAS_RECIENTES_PRIMERO);
        } else if (accion != null) {
            resenas = resenaRepository.findByDecisionAccion(accion, MAS_RECIENTES_PRIMERO);
        } else if (revisada != null) {
            resenas = resenaRepository.findByRevisada(revisada, MAS_RECIENTES_PRIMERO);
        } else {
            resenas = resenaRepository.findAll(MAS_RECIENTES_PRIMERO);
        }
        return resenas.stream().map(ResenaDTO::de).toList();
    }

    public ResenaDTO buscarPorId(Long id) {
        return ResenaDTO.de(buscarEntidad(id));
    }

    public ResenaDTO marcarRevisada(Long id, boolean revisada) {
        Resena resena = buscarEntidad(id);
        resena.marcarRevisada(revisada);
        return ResenaDTO.de(resenaRepository.save(resena));
    }

    /**
     * Vuelve a pedir la decisión de una reseña que quedó sin clasificar porque
     * el agente no respondió.
     *
     * Aquí sí se avisa si el agente sigue sin responder (503): la reseña ya
     * está guardada y quien lo pidió quiere saber si funcionó.
     */
    public ResenaDTO volverAClasificar(Long id) {
        Resena resena = buscarEntidad(id);
        if (!resena.getDecision().sinClasificar()) {
            throw new ConflictoException("La reseña " + id + " ya está clasificada.");
        }
        resena.clasificar(pedirDecision(resena));
        return ResenaDTO.de(resenaRepository.save(resena));
    }

    /**
     * Le envía la reseña al agente y traduce su respuesta.
     *
     * Junto al texto van la mesa y el pedido, si los hay: el agente los
     * devuelve sin cambios y no los usa para decidir.
     */
    private DecisionDelAgente pedirDecision(Resena resena) {
        Map<String, Object> datos = new LinkedHashMap<>();
        datos.put("origen", "kandela");
        if (resena.getMesaId() != null) {
            datos.put("mesaId", resena.getMesaId());
        }
        if (resena.getPedidoId() != null) {
            datos.put("pedidoId", resena.getPedidoId());
        }

        DecisionRemota respuesta = sentiTriageClient.clasificar(resena.getId(), resena.getTexto(), datos);
        if (respuesta.error() != null) {
            LOG.warn("El agente no pudo clasificar la reseña {}: {}", resena.getId(), respuesta.error());
        }
        return new DecisionDelAgente(accion(respuesta.action()), respuesta.label(), respuesta.confidence(),
                respuesta.threshold(), respuesta.model(), LocalDateTime.now());
    }

    /** Una acción que Kandela no conoce se trata como ABSTAIN: que la lea una persona. */
    private static AccionDelAgente accion(String accion) {
        try {
            return AccionDelAgente.valueOf(accion);
        } catch (IllegalArgumentException | NullPointerException excepcion) {
            return AccionDelAgente.ABSTAIN;
        }
    }

    private Resena buscarEntidad(Long id) {
        return resenaRepository.findById(id)
                .orElseThrow(() -> new NoEncontradoException("No existe una reseña con id " + id + "."));
    }
}
