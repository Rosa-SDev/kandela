import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
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
import { comoErrorKandela, get, post } from '../nucleo/api';
import { useSesion } from '../nucleo/sesion';
import { estadoDeMesa, type ClaveDeMesa } from './estadoDeMesa';

type Filtro = 'todas' | ClaveDeMesa;

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
  const [abriendo, setAbriendo] = useState(false);
  const [errorDeApertura, setErrorDeApertura] = useState<ErrorKandela | null>(null);
  const { usuario } = useSesion();
  const navegar = useNavigate();

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
      setErrorDelPlano(comoErrorKandela(fallo));
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
      setErrorDeReservas(comoErrorKandela(deReservas.reason));
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

  /** Al cambiar de mesa, el error de la anterior deja de tener sentido. */
  function seleccionar(mesa: MesaDTO) {
    setSeleccionada(mesa.id);
    setErrorDeApertura(null);
  }

  /**
   * Abre un pedido en esa mesa a nombre de quien tiene la sesión.
   *
   * Mientras la petición está en camino el botón queda bloqueado: dos toques
   * seguidos abrirían dos pedidos en la misma mesa, y el segundo chocaría con
   * el primero.
   */
  async function abrirPedido(mesa: MesaDTO) {
    if (abriendo || !usuario) {
      return;
    }
    setAbriendo(true);
    setErrorDeApertura(null);
    try {
      const creado = await post<PedidoDTO>('/pedidos', { mesaId: mesa.id, meseroId: usuario.id });
      navegar(`/salon/pedido/${creado.id}`);
    } catch (error) {
      setErrorDeApertura(comoErrorKandela(error));
    } finally {
      setAbriendo(false);
    }
  }

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
              onSeleccionar={seleccionar}
            />
          ))}
        </div>
      </section>

      <aside className="salon-detalle" aria-label="Detalle de la mesa">
        {elegida ? (
          <DetalleDeMesa
            mesa={elegida.mesa}
            estado={elegida.estado}
            abriendo={abriendo}
            error={errorDeApertura}
            onAbrirPedido={abrirPedido}
            onTomarPedido={(pedido) => navegar(`/salon/pedido/${pedido.id}`)}
          />
        ) : null}
      </aside>
    </div>
  );
}

interface DetalleProps {
  mesa: MesaDTO;
  estado: ReturnType<typeof estadoDeMesa>;
  abriendo: boolean;
  error: ErrorKandela | null;
  onAbrirPedido: (mesa: MesaDTO) => void;
  onTomarPedido: (pedido: PedidoDTO) => void;
}

/**
 * Lo que se ve al tocar una mesa: la comanda si hay pedido, o quién la reservó.
 *
 * Una mesa reservada también acepta un pedido —el cliente llegó— pero el botón
 * va en tinta y no en ladrillo: abrirlo ahí es una decisión más deliberada que
 * sentar a alguien en una mesa libre.
 */
function DetalleDeMesa({ mesa, estado, abriendo, error, onAbrirPedido, onTomarPedido }: DetalleProps) {
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

      {error ? <Aviso tono="err" titulo={error.titulo} texto={error.texto} /> : null}

      {estado.clave !== 'ocupada' ? (
        <Boton
          texto="Abrir pedido"
          variante={estado.clave === 'libre' ? 'calor' : 'tinta'}
          ancho
          disabled={abriendo}
          onClick={() => onAbrirPedido(mesa)}
        />
      ) : null}

      {estado.clave === 'ocupada' ? (
        <Boton
          texto={estado.pedido.estado === 'ABIERTO' ? 'Tomar pedido' : 'Ver comanda'}
          variante={estado.pedido.estado === 'ABIERTO' ? 'calor' : 'tinta'}
          ancho
          onClick={() => onTomarPedido(estado.pedido)}
        />
      ) : null}
    </>
  );
}
