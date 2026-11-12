package com.restaurante.usuarios.model;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;

/**
 * Persona que usa el sistema. Es abstracta porque no existe un usuario generico:
 * todo usuario es Administrador, Mesero, Cocinero o Cajero.
 *
 * Los cuatro roles viven en una sola coleccion, "usuarios". Los roles no
 * agregan atributos propios; lo unico que los distingue es el campo _class de
 * cada documento, donde Spring guarda el @TypeAlias de la subclase
 * ("ADMINISTRADOR", "MESERO"...). Al leer, Spring mira ese campo y construye la
 * subclase correcta, asi que Rol.de(usuario) sigue funcionando igual.
 */
@Document("usuarios")
public abstract class Usuario {

    /** Se guarda como _id. Es un Long que reparte GeneradorDeIds, no un ObjectId. */
    @Id
    private Long id;

    private String nombre;

    /**
     * Indice unico: MongoDB rechaza un segundo usuario con el mismo correo,
     * aunque dos peticiones lleguen a la vez.
     *
     * La collation con strength 2 compara sin distinguir mayusculas, igual que
     * existsByCorreoIgnoreCase: "Laura@raizysazon.co" y "laura@raizysazon.co"
     * chocan.
     */
    @Indexed(unique = true, collation = "{ 'locale': 'es', 'strength': 2 }")
    private String correo;

    private String passwordHash;

    private boolean activo;

    /**
     * Constructor vacio para Spring Data: arma el objeto y despues rellena los
     * campos con los del documento.
     */
    protected Usuario() { }

    protected Usuario(String nombre, String correo, String passwordHash) {
        this.nombre = nombre;
        this.correo = correo;
        this.passwordHash = passwordHash;
        this.activo = true;
    }

    public Long getId() {
        return id;
    }

    /**
     * Fija el id una sola vez, al crear el usuario. Un usuario que ya tiene id
     * no puede recibir otro: cambiarlo equivaldria a otro usuario.
     */
    public void asignarId(Long id) {
        if (this.id != null) {
            throw new IllegalStateException("El usuario ya tiene el id " + this.id + ".");
        }
        this.id = id;
    }

    public String getNombre() {
        return nombre;
    }

    public void setNombre(String nombre) {
        this.nombre = nombre;
    }

    public String getCorreo() {
        return correo;
    }

    public void setCorreo(String correo) {
        this.correo = correo;
    }

    public String getPasswordHash() {
        return passwordHash;
    }

    public void setPasswordHash(String passwordHash) {
        this.passwordHash = passwordHash;
    }

    public boolean isActivo() {
        return activo;
    }

    public void setActivo(boolean activo) {
        this.activo = activo;
    }
}
