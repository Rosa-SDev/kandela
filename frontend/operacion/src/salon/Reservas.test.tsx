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
}

/** Responde según la ruta, para poder tumbar las mesas sin tumbar las reservas. */
function simularBackend(respuestas: Respuestas) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string) => {
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
