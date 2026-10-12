import { useCallback, useEffect, useState } from 'react';
import type { MesaDTO, ReservaDTO } from '@compartido/api/tipos';
import type { ErrorKandela } from '@compartido/api/errores';
import { Aviso } from '../componentes/Aviso';
import { Boton } from '../componentes/Boton';
import { Titulo } from '../componentes/Titulo';
import { FilaReserva } from '../objetos/FilaReserva';
import { esReservaVigente } from '../objetos/estadoReserva';
import { comoErrorKandela, get } from '../nucleo/api';

/** De identificador de mesa a número de mesa, que es lo que se lee en la fila. */
function numerosDeMesa(mesas: MesaDTO[]): Map<number, number> {
  return new Map(mesas.map((mesa) => [mesa.id, mesa.numero]));
}

/**
 * Las reservas del restaurante, de la más próxima a la más lejana.
 *
 * No se filtran por fecha: el mesero necesita ver la de esta noche y también
 * la del jueves. Las cumplidas y las canceladas se quedan en la lista pero
 * atenuadas, y el paréntesis del título solo cuenta las que siguen en pie.
 *
 * Las mesas se consultan aparte porque la reserva guarda el identificador de
 * la mesa y no su número, que es el que está pintado en el salón. Si el salón
 * no responde, las reservas se siguen viendo: solo falta ese número.
 */
export function Reservas() {
  const [reservas, setReservas] = useState<ReservaDTO[]>([]);
  const [mesas, setMesas] = useState<MesaDTO[]>([]);
  const [error, setError] = useState<ErrorKandela | null>(null);
  const [cargando, setCargando] = useState(true);

  // Nada de setState antes del await: dentro de un efecto eso encadena renders.
  const cargar = useCallback(async () => {
    const [deReservas, deMesas] = await Promise.allSettled([
      get<ReservaDTO[]>('/reservas'),
      get<MesaDTO[]>('/mesas'),
    ]);

    if (deReservas.status === 'rejected') {
      setError(comoErrorKandela(deReservas.reason));
      setReservas([]);
    } else {
      setError(null);
      setReservas(deReservas.value);
    }

    setMesas(deMesas.status === 'fulfilled' ? deMesas.value : []);
    setCargando(false);
  }, []);

  useEffect(() => {
    // Pedir los datos al entrar es justo para lo que sirve un efecto. El aviso
    // del analizador es por los setState de cargar, que ocurren después del
    // await y no encadenan un render de más.
    // oxlint-disable-next-line react/set-state-in-effect
    void cargar();
  }, [cargar]);

  function reintentar() {
    setCargando(true);
    setError(null);
    void cargar();
  }

  const numeros = numerosDeMesa(mesas);
  const enOrden = [...reservas].sort((una, otra) => una.fechaHora.localeCompare(otra.fechaHora));
  const vigentes = enOrden.filter((reserva) => esReservaVigente(reserva.estado)).length;

  return (
    <section className="salon-sec" aria-label="Reservas">
      <div className="sh-cab">
        <Titulo texto="Reservas" par={cargando || error ? undefined : `${vigentes} vigentes`} />
      </div>

      {error ? (
        <Aviso
          tono="err"
          titulo={error.titulo}
          texto={error.texto}
          accion={<Boton texto="Reintentar" variante="tinta" onClick={reintentar} />}
        />
      ) : null}

      {!cargando && !error && enOrden.length === 0 ? (
        <p className="salon-vacio">
          Sin reservas <span>(por ahora)</span>
        </p>
      ) : null}

      {enOrden.length > 0 ? (
        <div>
          {enOrden.map((reserva) => (
            <FilaReserva
              key={reserva.id}
              reserva={reserva}
              mesaNumero={reserva.mesaId != null ? numeros.get(reserva.mesaId) : null}
            />
          ))}
        </div>
      ) : null}
    </section>
  );
}
