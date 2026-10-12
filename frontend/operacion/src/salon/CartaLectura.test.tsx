import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PlatilloDTO } from '@compartido/api/tipos';
import { CartaLectura } from './CartaLectura';

const CARTA: PlatilloDTO[] = [
  { id: 1, nombre: 'Bandeja paisa', descripcion: null, categoria: 'Fuertes', precio: 38000, disponible: true },
  { id: 2, nombre: 'Ajiaco santafereño', descripcion: null, categoria: 'Sopas', precio: 28000, disponible: true },
  { id: 5, nombre: 'Limonada de coco', descripcion: null, categoria: 'Bebidas', precio: 9000, disponible: false },
];

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status });
}

function simularCarta(responder: () => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(responder())));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('la carta del salón', () => {
  it('muestra los platillos agrupados por categoria', async () => {
    simularCarta(() => json(CARTA));
    render(<CartaLectura />);

    expect(await screen.findByText('Bandeja paisa')).toBeInTheDocument();
    expect(screen.getByText('Ajiaco santafereño')).toBeInTheDocument();
    expect(screen.getByText('Limonada de coco')).toBeInTheDocument();
  });

  it('cuenta en el titulo solo los platillos disponibles', async () => {
    simularCarta(() => json(CARTA));
    render(<CartaLectura />);

    expect(await screen.findByText(/2 disponibles/)).toBeInTheDocument();
  });

  it('no ofrece agregar nada: aqui solo se consulta', async () => {
    simularCarta(() => json(CARTA));
    render(<CartaLectura />);

    await screen.findByText('Bandeja paisa');
    expect(screen.queryByRole('button', { name: /agregar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '+' })).not.toBeInTheDocument();
  });

  it('avisa con reintentar cuando la carta no responde', async () => {
    simularCarta(() => json({ error: 'La carta no está disponible en este momento.' }, 503));
    render(<CartaLectura />);

    expect(await screen.findByText(/La carta no está disponible/)).toBeInTheDocument();

    simularCarta(() => json(CARTA));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(screen.getByText('Bandeja paisa')).toBeInTheDocument());
  });
});
