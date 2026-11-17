package com.restaurante.usuarios.service;

import com.restaurante.usuarios.contador.GeneradorDeIds;
import com.restaurante.usuarios.dto.CrearUsuarioDTO;
import com.restaurante.usuarios.dto.ActualizarUsuarioDTO;
import com.restaurante.usuarios.dto.UsuarioDTO;
import com.restaurante.usuarios.exception.ConflictoException;
import com.restaurante.usuarios.exception.CredencialesInvalidasException;
import com.restaurante.usuarios.exception.NoEncontradoException;
import com.restaurante.usuarios.model.*;
import com.restaurante.usuarios.repository.UsuarioRepository;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;

@Service
public class UsuarioService {

    /** Nombre del contador de GeneradorDeIds que numera los usuarios. */
    static final String COLECCION = "usuarios";

    private final UsuarioRepository repositorio;
    private final GeneradorDeIds generadorDeIds;

    public UsuarioService(UsuarioRepository repositorio, GeneradorDeIds generadorDeIds) {
        this.repositorio = repositorio;
        this.generadorDeIds = generadorDeIds;
    }

    /**
     * Es el unico sitio que crea usuarios, tambien para los datos de
     * demostracion, y por eso el unico que asigna ids.
     *
     * El id se pide despues de comprobar el correo, para no gastar un numero en
     * un usuario que se va a rechazar. Se guarda con insert y no con save:
     * insert falla si el id ya existe, mientras que save reemplazaria en
     * silencio al usuario que tuviera ese id.
     */
    public UsuarioDTO crear(CrearUsuarioDTO dto) {
        if (repositorio.existsByCorreoIgnoreCase(dto.correo())) {
            throw new ConflictoException("Ya existe un usuario con ese correo.");
        }
        Usuario usuario = construirPorRol(dto.rol(), dto.nombre(), dto.correo(), hash(dto.password()));
        usuario.asignarId(generadorDeIds.siguiente(COLECCION));
        return UsuarioDTO.de(repositorio.insert(usuario));
    }

    public List<UsuarioDTO> listar(Rol rol) {
        return repositorio.findAll().stream()
                .filter(usuario -> rol == null || Rol.de(usuario) == rol)
                .map(UsuarioDTO::de)
                .toList();
    }

    public UsuarioDTO buscarPorId(Long id) {
        return UsuarioDTO.de(buscarEntidad(id));
    }

        /**
     * Actualiza nombre y correo. La contraseña es opcional: si no viene (o viene
     * vacía) se conserva el hash actual; si viene, se guarda su nuevo hash. El
     * rol no se puede cambiar por esta vía: el rol es la subclase guardada en
     * _class, y el contrato no pide esa operación.
     *
     * MongoDB no guarda solo lo que se modifica: el cambio queda en la base
     * porque termina en save(), que reemplaza el documento completo.
     */
    public UsuarioDTO actualizar(Long id, ActualizarUsuarioDTO dto) {
        Usuario usuario = buscarEntidad(id);

        repositorio.findByCorreoIgnoreCase(dto.correo())
                .filter(otro -> !otro.getId().equals(id))
                .ifPresent(otro -> {
                    throw new ConflictoException("Ya existe otro usuario con ese correo.");
                });

        usuario.setNombre(dto.nombre());
        usuario.setCorreo(dto.correo());
        if (dto.password() != null && !dto.password().isBlank()) {
            usuario.setPasswordHash(hash(dto.password()));
        }
        return UsuarioDTO.de(repositorio.save(usuario));
    }

    public void eliminar(Long id) {
        if (!repositorio.existsById(id)) {
            throw new NoEncontradoException("El usuario " + id + " no existe.");
        }
        repositorio.deleteById(id);
    }

    /**
     * Mismo mensaje para correo inexistente, clave incorrecta y usuario
     * inactivo: distinguirlos revelaría qué correos están registrados.
     */
    public UsuarioDTO autenticar(String correo, String password) {
        Usuario usuario = repositorio.findByCorreoIgnoreCase(correo)
                .orElseThrow(() -> new CredencialesInvalidasException("Correo o contraseña incorrectos."));

        if (!usuario.isActivo() || !usuario.getPasswordHash().equals(hash(password))) {
            throw new CredencialesInvalidasException("Correo o contraseña incorrectos.");
        }
        return UsuarioDTO.de(usuario);
    }

    private Usuario buscarEntidad(Long id) {
        return repositorio.findById(id)
                .orElseThrow(() -> new NoEncontradoException("El usuario " + id + " no existe."));
    }

    private Usuario construirPorRol(Rol rol, String nombre, String correo, String passwordHash) {
        return switch (rol) {
            case ADMINISTRADOR -> new Administrador(nombre, correo, passwordHash);
            case MESERO -> new Mesero(nombre, correo, passwordHash);
            case COCINERO -> new Cocinero(nombre, correo, passwordHash);
            case CAJERO -> new Cajero(nombre, correo, passwordHash);
        };
    }

    /**
     * SHA-256 en hexadecimal. Sin salt: es un prototipo academico y asi se
     * declara. Copiado tal cual de ControllerUsuario.java.
     */
    public static String hash(String texto) {
        String entrada = (texto == null) ? "" : texto;
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] resumen = md.digest(entrada.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(resumen);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 no disponible en esta JVM", e);
        }
    }
}
