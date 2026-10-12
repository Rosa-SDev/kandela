import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MesaDTO, ReservaDTO } from '@compartido/api/tipos';
import { Reservas } from './Reservas';

const MESAS: MesaDTO[] = [
  { id: 1, numero: 1, capacidad: 2, estado: 'LIBRE' },
  { id: 2, numero: 2, capacidad: 4, estado: 'LIBRE' },
  { id: 4, numero: 4, capacidad: 6, estado: 'LIBRE' },
];

const DE_MARCELA: ReservaDTO = {
  id: 1,
  fechaHora: '2026-10-12T19:00:00',
  numPersonas: 6,
  estado: 'CONFIRMADA',
  clienteId: 3,
  clienteNombre: 'Marcela Gómez',
  mesaId: 4,
  meseroId: 2,
};

const DE_ANA: ReservaDTO = {
  ...DE_MARCELA,
  id: 2,
  fechaHora: '2026-10-14T19:00:00',
  numPersonas: 4,
  estado: 'PENDIENTE',
  clienteNombre: 'Ana Torres',
  mesaId: 2,
};

const DE_LUIS: ReservaDTO = {
  ...DE_MARCELA,
  id: 3,
  fechaHora: '2026-10-15T20:30:00',
  numPersonas: 2,
  estado: 'PENDIENTE',
  clienteNombre: 'Luis Ramírez',
  mesaId: 1,
};

const CANCELADA: ReservaDTO = {
  ...DE_MARCELA,
  id: 4,
  fechaHora: '2026-10-13T13:00:00',
  estado: 'CANCELADA',
  clienteNombre: 'Pedro Díaz',
};

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status });
}

interface Respuestas {
  reservas?: () => Response | Promise<Response>;
  mesas?: () => Response | Promise<Response>;
  cambio?: () => Response | Promise<Response>;
}

/** Responde según la ruta, para poder tumbar las mesas sin tumbar las reservas. */
function simularBackend(respuestas: Respuestas) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, opciones?: RequestInit) => {
      if (opciones?.method === 'PATCH') {
        return Promise.resolve((respuestas.cambio ?? (() => json({})))());
      }
      if (url === '/api/mesas') {
        return Promise.resolve((respuestas.mesas ?? (() => json(MESAS)))());
      }
      return Promise.resolve((respuestas.reservas ?? (() => json([])))());
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('las reservas del salón', () => {
  it('las ordena de la mas proxima a la mas lejana', async () => {
    simularBackend({ reservas: () => json([DE_LUIS, DE_MARCELA, DE_ANA]) });
    const { container } = render(<Reservas />);

    await screen.findByText('Marcela Gómez');
    const filas = [...container.querySelectorAll('.f-fila')];
    expect(filas).toHaveLength(3);
    expect(filas[0].textContent).toContain('Marcela Gómez');
    expect(filas[1].textContent).toContain('Ana Torres');
    expect(filas[2].textContent).toContain('Luis Ramírez');
  });

  it('cuenta en el parentesis solo las reservas vigentes', async () => {
    simularBackend({ reservas: () => json([DE_MARCELA, DE_ANA, CANCELADA]) });
    render(<Reservas />);

    expect(await screen.findByText(/2 vigentes/)).toBeInTheDocument();
  });

  it('deja en la lista las cerradas, atenuadas', async () => {
    simularBackend({ reservas: () => json([DE_MARCELA, CANCELADA]) });
    const { container } = render(<Reservas />);

    await screen.findByText('Pedro Díaz');
    const apagadas = container.querySelectorAll('.f-fila--apagada');
    expect(apagadas).toHaveLength(1);
    expect(apagadas[0].textContent).toContain('Pedro Díaz');
  });

  it('nombra la mesa por su numero, que viene del salon', async () => {
    simularBackend({ reservas: () => json([DE_MARCELA]) });
    render(<Reservas />);

    expect(await screen.findByText('Mesa 4')).toBeInTheDocument();
  });

  it('sigue mostrando las reservas cuando el salon no responde', async () => {
    simularBackend({
      reservas: () => json([DE_MARCELA]),
      mesas: () => json({ error: 'El salón no está disponible.' }, 503),
    });
    render(<Reservas />);

    expect(await screen.findByText('Marcela Gómez')).toBeInTheDocument();
    expect(screen.getByText('6 personas')).toBeInTheDocument();
  });

  it('avisa cuando no hay ninguna reserva', async () => {
    simularBackend({ reservas: () => json([]) });
    render(<Reservas />);

    expect(await screen.findByText(/Sin reservas/)).toBeInTheDocument();
  });

  it('ofrece reintentar cuando el servicio de reservas no responde', async () => {
    simularBackend({ reservas: () => json({ error: 'No disponible.' }, 503) });
    render(<Reservas />);

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();

    simularBackend({ reservas: () => json([DE_MARCELA]) });
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(screen.getByText('Marcela Gómez')).toBeInTheDocument());
  });
});

describe('los cambios de estado de la reserva', () => {
  /** Captura las peticiones PATCH que salieron, ya convertidas desde JSON. */
  function cambiosEnviados(): { ruta: string; cuerpo: unknown }[] {
    const llamadas = (fetch as unknown as { mock: { calls: [string, RequestInit?][] } }).mock.calls;
    return llamadas
      .filter(([, opciones]) => opciones?.method === 'PATCH')
      .map(([ruta, opciones]) => ({ ruta, cuerpo: JSON.parse(String(opciones?.body)) }));
  }

  it('ofrece confirmar solo en las pendientes', async () => {
    simularBackend({ reservas: () => json([DE_MARCELA, DE_ANA]) });
    render(<Reservas />);

    await screen.findByText('Ana Torres');
    expect(screen.getAllByRole('button', { name: 'Confirmar' })).toHaveLength(1);
  });

  it('ofrece cumplida solo en las confirmadas', async () => {
    simularBackend({ reservas: () => json([DE_MARCELA, DE_ANA]) });
    render(<Reservas />);

    await screen.findByText('Marcela Gómez');
    expect(screen.getAllByRole('button', { name: 'Cumplida' })).toHaveLength(1);
  });

  it('no ofrece nada en las reservas cerradas', async () => {
    simularBackend({ reservas: () => json([CANCELADA]) });
    render(<Reservas />);

    await screen.findByText('Pedro Díaz');
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cumplida' })).not.toBeInTheDocument();
  });

  it('confirmar manda el estado nuevo a esa reserva', async () => {
    simularBackend({
      reservas: () => json([DE_ANA]),
      cambio: () => json({ ...DE_ANA, estado: 'CONFIRMADA' }),
    });
    render(<Reservas />);

    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

    await waitFor(() =>
      expect(cambiosEnviados()).toEqual([
        { ruta: '/api/reservas/2/estado', cuerpo: { nuevoEstado: 'CONFIRMADA' } },
      ]),
    );
  });

  it('cuenta lo que paso y deja la fila en su estado nuevo', async () => {
    simularBackend({
      reservas: () => json([DE_ANA]),
      cambio: () => json({ ...DE_ANA, estado: 'CONFIRMADA' }),
    });
    render(<Reservas />);

    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

    expect(await screen.findByText('Reserva de Ana Torres confirmada.')).toBeInTheDocument();
    expect(screen.getByText('Confirmada')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cumplida' })).toBeInTheDocument();
  });

  it('cumplida lo dice con sus palabras', async () => {
    simularBackend({
      reservas: () => json([DE_MARCELA]),
      cambio: () => json({ ...DE_MARCELA, estado: 'CUMPLIDA' }),
    });
    render(<Reservas />);

    fireEvent.click(await screen.findByRole('button', { name: 'Cumplida' }));

    expect(
      await screen.findByText('Reserva de Marcela Gómez marcada como cumplida.'),
    ).toBeInTheDocument();
  });

  it('muestra el mensaje del servidor cuando el paso no es valido', async () => {
    simularBackend({
      reservas: () => json([DE_ANA]),
      cambio: () => json({ error: 'No se puede pasar una reserva de PENDIENTE a CUMPLIDA.' }, 409),
    });
    render(<Reservas />);

    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

    expect(
      await screen.findByText('No se puede pasar una reserva de PENDIENTE a CUMPLIDA.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });
});
