import { useCallback, useEffect, useState } from 'react';
import type { MesaDTO, PedidoDTO, ReservaDTO } from '@compartido/api/tipos';
import type { ErrorKandela } from '@compartido/api/errores';
import { Aviso } from '../componentes/Aviso';
import { Boton } from '../componentes/Boton';
import { Estado } from '../componentes/Estado';
import { Filtros } from '../componentes/Filtros';
import { Titulo } from '../componentes/Titulo';
import { Comanda } from '../objetos/Comanda';
import { hora } from '../objetos/estadoPedido';
import { Mesa } from '../objetos/Mesa';
import { esErrorKandela, get } from '../nucleo/api';
import { estadoDeMesa, type ClaveDeMesa } from './estadoDeMesa';

type Filtro = 'todas' | ClaveDeMesa;

function comoError(error: unknown): ErrorKandela {
  if (esErrorKandela(error)) {
    return error;
  }
  return { status: null, titulo: 'No se pudo completar la solicitud.', texto: '', campos: {} };
}

/**
 * El plano del salón: todas las mesas con lo que está pasando en cada una.
 *
 * Las tres consultas salen a la vez y se resuelven por separado. Las mesas y
 * los pedidos son el plano; sin ellos no hay nada que pintar. Las reservas
 * solo añaden una marca, así que si el servicio de clientes no responde el
 * mesero sigue trabajando y se le avisa de lo que no se pudo traer.
 */
export function Plano() {
  const [mesas, setMesas] = useState<MesaDTO[]>([]);
  const [pedidos, setPedidos] = useState<PedidoDTO[]>([]);
  const [reservas, setReservas] = useState<ReservaDTO[]>([]);
  const [errorDelPlano, setErrorDelPlano] = useState<ErrorKandela | null>(null);
  const [errorDeReservas, setErrorDeReservas] = useState<ErrorKandela | null>(null);
  const [cargando, setCargando] = useState(true);
  // El día con el que se comparan las reservas es el de la consulta, no el del
  // primer render: así, al reintentar, una pantalla abierta desde ayer se pone al día.
  const [hoy, setHoy] = useState(() => new Date());
  const [filtro, setFiltro] = useState<Filtro>('todas');
  const [seleccionada, setSeleccionada] = useState<number | null>(null);

  // Nada de setState antes del await: dentro de un efecto eso encadena renders.
  const cargar = useCallback(async () => {
    const [deMesas, dePedidos, deReservas] = await Promise.allSettled([
      get<MesaDTO[]>('/mesas'),
      get<PedidoDTO[]>('/pedidos'),
      get<ReservaDTO[]>('/reservas'),
    ]);

    setHoy(new Date());

    if (deMesas.status === 'rejected' || dePedidos.status === 'rejected') {
      const fallo = deMesas.status === 'rejected' ? deMesas.reason : (dePedidos as PromiseRejectedResult).reason;
      setErrorDelPlano(comoError(fallo));
      setMesas([]);
      setPedidos([]);
      setReservas([]);
      setCargando(false);
      return;
    }

    setErrorDelPlano(null);
    setMesas(deMesas.value);
    setPedidos(dePedidos.value);

    if (deReservas.status === 'rejected') {
      setErrorDeReservas(comoError(deReservas.reason));
      setReservas([]);
    } else {
      setErrorDeReservas(null);
      setReservas(deReservas.value);
    }

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
    setErrorDelPlano(null);
    setErrorDeReservas(null);
    void cargar();
  }

  const conEstado = mesas.map((mesa) => ({ mesa, estado: estadoDeMesa(mesa, pedidos, reservas, hoy) }));
  const cuantas = (clave: ClaveDeMesa) => conEstado.filter((fila) => fila.estado.clave === clave).length;
  const elegida = conEstado.find((fila) => fila.mesa.id === seleccionada) ?? null;

  if (errorDelPlano) {
    return (
      <div className="salon-plano">
        <section className="salon-mapa" aria-label="Plano del salón">
          <div className="sh-cab">
            <Titulo texto="Salón" />
          </div>
          <Aviso
            tono="err"
            titulo={errorDelPlano.titulo}
            texto={errorDelPlano.texto}
            accion={<Boton texto="Reintentar" variante="tinta" onClick={reintentar} />}
          />
        </section>
      </div>
    );
  }

  return (
    <div className="salon-plano">
      <section className="salon-mapa" aria-label="Plano del salón">
        <div className="sh-cab">
          <Titulo texto="Salón" par={cargando ? undefined : `${cuantas('ocupada')} ocupadas`} />
          <Filtros
            items={[
              ['todas', 'Todas', conEstado.length],
              ['libre', 'Libres', cuantas('libre')],
              ['ocupada', 'Ocupadas', cuantas('ocupada')],
              ['reservada', 'Reservadas', cuantas('reservada')],
            ]}
            activo={filtro}
            onCambiar={(id) => setFiltro(id as Filtro)}
          />
        </div>

        {errorDeReservas ? (
          <Aviso
            tono="err"
            titulo={errorDeReservas.titulo}
            texto="El plano se muestra sin las mesas reservadas."
          />
        ) : null}

        <div className="salon-mapa__grid">
          {conEstado.map(({ mesa, estado }) => (
            <Mesa
              key={mesa.id}
              mesa={mesa}
              estado={estado}
              seleccionada={mesa.id === seleccionada}
              filtrada={filtro !== 'todas' && estado.clave !== filtro}
              onSeleccionar={() => setSeleccionada(mesa.id)}
            />
          ))}
        </div>
      </section>

      <aside className="salon-detalle" aria-label="Detalle de la mesa">
        {elegida ? <DetalleDeMesa mesa={elegida.mesa} estado={elegida.estado} /> : null}
      </aside>
    </div>
  );
}

type DetalleProps = { mesa: MesaDTO; estado: ReturnType<typeof estadoDeMesa> };

/** Lo que se ve al tocar una mesa: la comanda si hay pedido, o quién la reservó. */
function DetalleDeMesa({ mesa, estado }: DetalleProps) {
  return (
    <>
      <Titulo texto={`Mesa ${mesa.numero}`} par={`${mesa.capacidad} personas`} nivel={2} />

      {estado.clave === 'ocupada' ? <Comanda pedido={estado.pedido} variante="lectura" /> : null}

      {estado.clave === 'reservada' ? (
        <>
          <div className="salon-detalle__estado">
            <Estado glifo="▲" texto={`Reservada · ${hora(estado.reserva.fechaHora)}`} />
          </div>
          <p>
            {estado.reserva.clienteNombre} · {estado.reserva.numPersonas} personas
          </p>
        </>
      ) : null}

      {estado.clave === 'libre' ? (
        <>
          <div className="salon-detalle__estado">
            <Estado glifo="○" texto="Libre" />
          </div>
          <p>Sin pedido abierto.</p>
        </>
      ) : null}
    </>
  );
}
