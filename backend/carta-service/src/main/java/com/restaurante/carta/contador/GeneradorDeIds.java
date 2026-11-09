package com.restaurante.carta.contador;

import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoOperations;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Component;

import static org.springframework.data.mongodb.core.query.Criteria.where;

/**
 * Entrega ids numericos consecutivos (1, 2, 3...) para una coleccion.
 *
 * MongoDB genera por su cuenta ObjectId, no numeros. Los ids de la API son Long
 * y no deben cambiar, asi que se llevan en la coleccion "contadores".
 *
 * Toda la operacion es una sola instruccion atomica de MongoDB (findAndModify):
 * busca el contador, le suma 1 y devuelve el valor nuevo, todo de una vez. Dos
 * peticiones simultaneas nunca reciben el mismo numero. Con upsert, la primera
 * vez crea el contador, de modo que el primer id es 1.
 */
@Component
public class GeneradorDeIds {

    private final MongoOperations mongo;

    public GeneradorDeIds(MongoOperations mongo) {
        this.mongo = mongo;
    }

    public long siguiente(String coleccion) {
        Contador contador = mongo.findAndModify(
                Query.query(where("_id").is(coleccion)),
                new Update().inc("valor", 1),
                FindAndModifyOptions.options().returnNew(true).upsert(true),
                Contador.class);
        return contador.getValor();
    }

    /**
     * Vacia la coleccion "contadores": el siguiente id de cada coleccion vuelve
     * a ser 1. Solo lo usan los datos de demostracion, al recargar desde cero.
     */
    public void reiniciar() {
        mongo.remove(new Query(), Contador.class);
    }
}
