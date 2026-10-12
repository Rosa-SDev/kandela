import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MesaDTO, PedidoDTO, ReservaDTO } from '@compartido/api/tipos';
import { SesionProveedor } from '../nucleo/sesion';
import { Plano } from './Plano';

const MESAS: MesaDTO[] = [
  { id: 1, numero: 1, capacidad: 2, estado: 'LIBRE' },
  { id: 3, numero: 3, capacidad: 4, estado: 'LIBRE' },
  { id: 4, numero: 4, capacidad: 6, estado: 'LIBRE' },
];

const PEDIDO_EN_COCINA: PedidoDTO = {
  id: 7,
  fechaHora: '2026-10-11T16:55:00',
  estado: 'EN_COCINA',
  observaciones: null,
  metodoPago: null,
  montoPagado: null,
  fechaPago: null,
  mesaId: 1,
  mesaNumero: 1,
  meseroId: 2,
  cocineroId: null,
  clienteId: null,
  platillos: [{ id: 1, platilloId: 3, nombre: 'Bandeja paisa', precioUnitario: 38000 }],
  total: 38000,
};

/** Una reserva de hoy a las 19:00, escrita como la manda el backend. */
function reservaDeHoy(): ReservaDTO {
  const hoy = new Date();
  const dos = (n: number) => String(n).padStart(2, '0');
  return {
    id: 1,
    fechaHora: `${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}-${dos(hoy.getDate())}T19:00:00`,
    numPersonas: 6,
    estado: 'CONFIRMADA',
    clienteId: 3,
    clienteNombre: 'Marcela Gómez',
    mesaId: 4,
    meseroId: 2,
  };
}

const MESERO = {
  id: 2,
  nombre: 'Carlos Rojas',
  correo: 'carlos.rojas@raizysazon.co',
  rol: 'MESERO',
  activo: true,
};

/** Señuelo de la toma de pedido, para comprobar a dónde navega el plano. */
function TomaSenuelo() {
  const { id } = useParams();
  return <p>Toma del pedido {id}</p>;
}

/** El plano necesita la sesión, para abrir pedidos a nombre del mesero, y el enrutador. */
function pintarPlano() {
  sessionStorage.setItem('kandela.sesion', JSON.stringify(MESERO));
  return render(
    <MemoryRouter initialEntries={['/salon']}>
      <SesionProveedor>
        <Routes>
          <Route path="/salon" element={<Plano />} />
          <Route path="/salon/pedido/:id" element={<TomaSenuelo />} />
        </Routes>
      </SesionProveedor>
    </MemoryRouter>,
  );
}

/** Los cuerpos enviados a una ruta, ya convertidos desde JSON. */
function cuerposEnviadosA(ruta: string): unknown[] {
  const llamadas = (fetch as unknown as { mock: { calls: [string, RequestInit?][] } }).mock.calls;
  return llamadas
    .filter(([url, opciones]) => url === ruta && opciones?.method === 'POST')
    .map(([, opciones]) => JSON.parse(String(opciones?.body)));
}

const PEDIDO_ABIERTO: PedidoDTO = {
  ...PEDIDO_EN_COCINA,
  id: 12,
  estado: 'ABIERTO',
  mesaId: 3,
  mesaNumero: 3,
};

interface Respuestas {
  mesas?: () => Response | Promise<Response>;
  pedidos?: () => Response | Promise<Response>;
  reservas?: () => Response | Promise<Response>;
  crearPedido?: () => Response | Promise<Response>;
}

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status });
}

/** Responde según la ruta pedida, para poder tumbar una sola de las tres. */
function simularBackend(respuestas: Respuestas) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, opciones?: RequestInit) => {
      if (url === '/api/pedidos' && opciones?.method === 'POST') {
        return Promise.resolve((respuestas.crearPedido ?? (() => json({ id: 99 }, 201)))());
      }
      if (url.startsWith('/api/mesas')) return Promise.resolve((respuestas.mesas ?? (() => json(MESAS)))());
      if (url.startsWith('/api/pedidos'))
        return Promise.resolve((respuestas.pedidos ?? (() => json([PEDIDO_EN_COCINA])))());
      if (url.startsWith('/api/reservas'))
        return Promise.resolve((respuestas.reservas ?? (() => json([reservaDeHoy()])))());
      throw new Error(`Ruta no simulada: ${url}`);
    }),
  );
}

describe('Plano', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('pinta cada mesa con el estado que le corresponde', async () => {
    simularBackend({});
    pintarPlano();

    expect(await screen.findByLabelText('Mesa 1: ocupada, en cocina')).toBeInTheDocument();
    expect(screen.getByLabelText('Mesa 3: libre')).toBeInTheDocument();
    expect(screen.getByLabelText('Mesa 4: reservada a las 19:00')).toBeInTheDocument();
  });

  it('cuenta las mesas de cada filtro', async () => {
    simularBackend({});
    pintarPlano();

    expect(await screen.findByText('Todas (3)')).toBeInTheDocument();
    expect(screen.getByText('Libres (1)')).toBeInTheDocument();
    expect(screen.getByText('Ocupadas (1)')).toBeInTheDocument();
    expect(screen.getByText('Reservadas (1)')).toBeInTheDocument();
  });

  it('las tres consultas salen a la vez', async () => {
    simularBackend({});
    pintarPlano();

    await screen.findByLabelText('Mesa 3: libre');
    const pedidas = (fetch as unknown as { mock: { calls: string[][] } }).mock.calls.map((c) => c[0]);
    expect(pedidas).toEqual(
      expect.arrayContaining(['/api/mesas', '/api/pedidos', '/api/reservas']),
    );
  });

  it('si fallan las reservas se pintan las mesas y aparece el aviso', async () => {
    simularBackend({
      reservas: () => json({ error: 'El salón no está disponible en este momento.' }, 503),
    });
    pintarPlano();

    expect(await screen.findByText('El salón no está disponible en este momento.')).toBeInTheDocument();
    expect(screen.getByText('El plano se muestra sin las mesas reservadas.')).toBeInTheDocument();

    // Las mesas siguen ahí, y la que tenía reserva se ve libre.
    expect(screen.getByLabelText('Mesa 1: ocupada, en cocina')).toBeInTheDocument();
    expect(screen.getByLabelText('Mesa 4: libre')).toBeInTheDocument();
    expect(screen.getByText('Reservadas (0)')).toBeInTheDocument();
  });

  it('si fallan las mesas no se pinta el plano y se avisa del error', async () => {
    // Lo que responde el gateway cuando no alcanza a salon-service: no es un
    // error de Kandela, así que la interfaz pone su propio mensaje.
    simularBackend({
      mesas: () =>
        json(
          { timestamp: '2026-10-11T20:52:58.972Z', status: 500, error: 'Internal Server Error', path: '/api/mesas' },
          500,
        ),
    });
    pintarPlano();

    expect(await screen.findByText('El servicio no está disponible en este momento.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Mesa 3: libre')).not.toBeInTheDocument();
    expect(screen.queryByText(/Todas \(/)).not.toBeInTheDocument();
  });

  it('reintentar vuelve a pedir el plano', async () => {
    let primeraVez = true;
    simularBackend({
      mesas: () => {
        if (primeraVez) {
          primeraVez = false;
          return json({ timestamp: '2026-10-11T20:52:58.972Z', status: 500, error: 'Internal Server Error', path: '/api/mesas' }, 500);
        }
        return json(MESAS);
      },
    });
    pintarPlano();

    fireEvent.click(await screen.findByText('Reintentar'));

    expect(await screen.findByLabelText('Mesa 3: libre')).toBeInTheDocument();
  });

  it('al tocar una mesa libre el detalle dice que no tiene pedido', async () => {
    simularBackend({});
    pintarPlano();

    fireEvent.click(await screen.findByLabelText('Mesa 3: libre'));

    expect(screen.getByRole('heading', { name: /Mesa 3/ })).toHaveTextContent('(4 personas)');
    expect(screen.getByText('Sin pedido abierto.')).toBeInTheDocument();
  });

  it('al tocar una mesa reservada el detalle dice quien, a que hora y cuantos', async () => {
    simularBackend({});
    pintarPlano();

    fireEvent.click(await screen.findByLabelText('Mesa 4: reservada a las 19:00'));

    // La hora también se lee en la mesa del plano: aquí se mira solo el panel.
    const detalle = within(screen.getByLabelText('Detalle de la mesa'));
    expect(detalle.getByText('Reservada · 19:00')).toBeInTheDocument();
    expect(detalle.getByText('Marcela Gómez · 6 personas')).toBeInTheDocument();
  });

  it('al tocar una mesa ocupada el detalle muestra su comanda', async () => {
    simularBackend({});
    pintarPlano();

    fireEvent.click(await screen.findByLabelText('Mesa 1: ocupada, en cocina'));

    await waitFor(() => expect(screen.getByText('1 platillo · sin impuestos')).toBeInTheDocument());
    expect(screen.getAllByText('Bandeja paisa').length).toBeGreaterThan(0);
  });

  it('abrir un pedido manda la mesa elegida y el mesero en sesion', async () => {
    simularBackend({});
    pintarPlano();

    const libre = MESAS[1];
    fireEvent.click(await screen.findByLabelText(`Mesa ${libre.numero}: libre`));
    fireEvent.click(screen.getByText('Abrir pedido'));

    await waitFor(() => expect(cuerposEnviadosA('/api/pedidos')).toHaveLength(1));
    expect(cuerposEnviadosA('/api/pedidos')[0]).toEqual({
      mesaId: libre.id,
      meseroId: MESERO.id,
    });
  });

  it('al abrir el pedido se entra a tomarlo', async () => {
    simularBackend({ crearPedido: () => json({ ...PEDIDO_ABIERTO, id: 99 }, 201) });
    pintarPlano();

    fireEvent.click(await screen.findByLabelText('Mesa 3: libre'));
    fireEvent.click(screen.getByText('Abrir pedido'));

    expect(await screen.findByText('Toma del pedido 99')).toBeInTheDocument();
  });

  it('una mesa con el pedido abierto ofrece tomarlo', async () => {
    simularBackend({ pedidos: () => json([PEDIDO_EN_COCINA, PEDIDO_ABIERTO]) });
    pintarPlano();

    fireEvent.click(await screen.findByLabelText('Mesa 3: ocupada, sin enviar a cocina'));
    fireEvent.click(screen.getByText('Tomar pedido'));

    expect(await screen.findByText('Toma del pedido 12')).toBeInTheDocument();
  });

  it('una mesa con el pedido ya enviado ofrece ver la comanda', async () => {
    simularBackend({});
    pintarPlano();

    fireEvent.click(await screen.findByLabelText('Mesa 1: ocupada, en cocina'));

    expect(screen.queryByText('Tomar pedido')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Ver comanda'));

    expect(await screen.findByText('Toma del pedido 7')).toBeInTheDocument();
  });

  it('una mesa reservada tambien se puede abrir', async () => {
    simularBackend({});
    pintarPlano();

    fireEvent.click(await screen.findByLabelText('Mesa 4: reservada a las 19:00'));
    fireEvent.click(screen.getByText('Abrir pedido'));

    await waitFor(() => expect(cuerposEnviadosA('/api/pedidos')).toHaveLength(1));
    expect(cuerposEnviadosA('/api/pedidos')[0]).toMatchObject({ mesaId: 4 });
  });

  it('una mesa ocupada no ofrece abrir pedido', async () => {
    simularBackend({});
    pintarPlano();

    fireEvent.click(await screen.findByLabelText('Mesa 1: ocupada, en cocina'));

    expect(screen.queryByText('Abrir pedido')).not.toBeInTheDocument();
  });

  it('dos toques seguidos no abren dos pedidos', async () => {
    let soltar: (r: Response) => void = () => {};
    simularBackend({
      crearPedido: () =>
        new Promise<Response>((resolver) => {
          soltar = resolver;
        }),
    });
    pintarPlano();

    fireEvent.click(await screen.findByLabelText('Mesa 3: libre'));
    const boton = screen.getByText('Abrir pedido');
    fireEvent.click(boton);
    await waitFor(() => expect(boton).toBeDisabled());
    fireEvent.click(boton);

    soltar(json({ id: 99 }, 201));
    await waitFor(() => expect(cuerposEnviadosA('/api/pedidos')).toHaveLength(1));
  });

  it('si la mesa ya esta ocupada se muestra el conflicto del servidor', async () => {
    simularBackend({
      crearPedido: () => json({ error: 'La mesa 3 ya está ocupada por otro pedido.' }, 409),
    });
    pintarPlano();

    fireEvent.click(await screen.findByLabelText('Mesa 3: libre'));
    fireEvent.click(screen.getByText('Abrir pedido'));

    expect(
      await screen.findByText('La mesa 3 ya está ocupada por otro pedido.'),
    ).toBeInTheDocument();
  });

  it('si el servicio de usuarios no responde se avisa', async () => {
    simularBackend({
      crearPedido: () =>
        json({ error: 'El servicio de usuarios no está disponible en este momento.' }, 503),
    });
    pintarPlano();

    fireEvent.click(await screen.findByLabelText('Mesa 3: libre'));
    fireEvent.click(screen.getByText('Abrir pedido'));

    expect(
      await screen.findByText('El servicio de usuarios no está disponible en este momento.'),
    ).toBeInTheDocument();
  });

  it('el aviso de error se borra al elegir otra mesa', async () => {
    simularBackend({
      crearPedido: () => json({ error: 'La mesa 3 ya está ocupada por otro pedido.' }, 409),
    });
    pintarPlano();

    fireEvent.click(await screen.findByLabelText('Mesa 3: libre'));
    fireEvent.click(screen.getByText('Abrir pedido'));
    await screen.findByText('La mesa 3 ya está ocupada por otro pedido.');

    fireEvent.click(screen.getByLabelText('Mesa 4: reservada a las 19:00'));

    expect(
      screen.queryByText('La mesa 3 ya está ocupada por otro pedido.'),
    ).not.toBeInTheDocument();
  });

  it('sin mesa seleccionada el detalle esta vacio', async () => {
    simularBackend({});
    pintarPlano();

    await screen.findByLabelText('Mesa 3: libre');
    expect(screen.getByLabelText('Detalle de la mesa')).toBeEmptyDOMElement();
  });
});
