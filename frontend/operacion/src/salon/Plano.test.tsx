import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MesaDTO, PedidoDTO, ReservaDTO } from '@compartido/api/tipos';
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

interface Respuestas {
  mesas?: () => Response | Promise<Response>;
  pedidos?: () => Response | Promise<Response>;
  reservas?: () => Response | Promise<Response>;
}

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status });
}

/** Responde según la ruta pedida, para poder tumbar una sola de las tres. */
function simularBackend(respuestas: Respuestas) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
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
  });

  it('pinta cada mesa con el estado que le corresponde', async () => {
    simularBackend({});
    render(<Plano />);

    expect(await screen.findByLabelText('Mesa 1: ocupada, en cocina')).toBeInTheDocument();
    expect(screen.getByLabelText('Mesa 3: libre')).toBeInTheDocument();
    expect(screen.getByLabelText('Mesa 4: reservada a las 19:00')).toBeInTheDocument();
  });

  it('cuenta las mesas de cada filtro', async () => {
    simularBackend({});
    render(<Plano />);

    expect(await screen.findByText('Todas (3)')).toBeInTheDocument();
    expect(screen.getByText('Libres (1)')).toBeInTheDocument();
    expect(screen.getByText('Ocupadas (1)')).toBeInTheDocument();
    expect(screen.getByText('Reservadas (1)')).toBeInTheDocument();
  });

  it('las tres consultas salen a la vez', async () => {
    simularBackend({});
    render(<Plano />);

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
    render(<Plano />);

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
    render(<Plano />);

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
    render(<Plano />);

    fireEvent.click(await screen.findByText('Reintentar'));

    expect(await screen.findByLabelText('Mesa 3: libre')).toBeInTheDocument();
  });

  it('al tocar una mesa libre el detalle dice que no tiene pedido', async () => {
    simularBackend({});
    render(<Plano />);

    fireEvent.click(await screen.findByLabelText('Mesa 3: libre'));

    expect(screen.getByRole('heading', { name: /Mesa 3/ })).toHaveTextContent('(4 personas)');
    expect(screen.getByText('Sin pedido abierto.')).toBeInTheDocument();
  });

  it('al tocar una mesa reservada el detalle dice quien, a que hora y cuantos', async () => {
    simularBackend({});
    render(<Plano />);

    fireEvent.click(await screen.findByLabelText('Mesa 4: reservada a las 19:00'));

    // La hora también se lee en la mesa del plano: aquí se mira solo el panel.
    const detalle = within(screen.getByLabelText('Detalle de la mesa'));
    expect(detalle.getByText('Reservada · 19:00')).toBeInTheDocument();
    expect(detalle.getByText('Marcela Gómez · 6 personas')).toBeInTheDocument();
  });

  it('al tocar una mesa ocupada el detalle muestra su comanda', async () => {
    simularBackend({});
    render(<Plano />);

    fireEvent.click(await screen.findByLabelText('Mesa 1: ocupada, en cocina'));

    await waitFor(() => expect(screen.getByText('1 platillo · sin impuestos')).toBeInTheDocument());
    expect(screen.getAllByText('Bandeja paisa').length).toBeGreaterThan(0);
  });

  it('sin mesa seleccionada el detalle esta vacio', async () => {
    simularBackend({});
    render(<Plano />);

    await screen.findByLabelText('Mesa 3: libre');
    expect(screen.getByLabelText('Detalle de la mesa')).toBeEmptyDOMElement();
  });
});
