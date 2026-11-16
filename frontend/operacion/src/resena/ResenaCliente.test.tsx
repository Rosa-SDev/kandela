import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ResenaCliente } from './ResenaCliente';

function respuesta(status: number, cuerpo: unknown): Response {
  return new Response(JSON.stringify(cuerpo), { status });
}

/** Pinta el formulario como lo abre el QR, con la dirección que se le pase. */
function pintar(direccion = '/resena') {
  return render(
    <MemoryRouter initialEntries={[direccion]}>
      <Routes>
        <Route path="/resena" element={<ResenaCliente />} />
      </Routes>
    </MemoryRouter>,
  );
}

function escribir(texto: string) {
  fireEvent.change(screen.getByLabelText(/Tu comentario/), { target: { value: texto } });
}

function enviar() {
  fireEvent.click(screen.getByText('Enviar comentario'));
}

describe('ResenaCliente', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('sin comentario lo pide y no llama al servidor', async () => {
    const fetchSimulado = vi.fn();
    vi.stubGlobal('fetch', fetchSimulado);
    pintar();

    enviar();

    expect(await screen.findByText('! Escribe tu comentario.')).toBeInTheDocument();
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('envía el comentario con la mesa del QR y solo agradece', async () => {
    const fetchSimulado = vi.fn().mockResolvedValue(
      respuesta(201, { id: 1, accion: 'QUEUE', etiqueta: 'negative', sinClasificar: false }),
    );
    vi.stubGlobal('fetch', fetchSimulado);
    pintar('/resena?mesa=4');

    escribir('  La sopa llegó fría.  ');
    enviar();

    expect(await screen.findByText(/Gracias/)).toBeInTheDocument();
    const [ruta, opciones] = fetchSimulado.mock.calls[0];
    expect(ruta).toBe('/api/resenas');
    expect(opciones.method).toBe('POST');
    expect(JSON.parse(opciones.body)).toEqual({ texto: 'La sopa llegó fría.', mesaId: 4 });
    // La decisión del agente es para la administración, no para el cliente.
    expect(screen.queryByText(/QUEUE|queja|negative/i)).not.toBeInTheDocument();
  });

  it('ignora una mesa que no es un número', async () => {
    const fetchSimulado = vi.fn().mockResolvedValue(respuesta(201, { id: 2 }));
    vi.stubGlobal('fetch', fetchSimulado);
    pintar('/resena?mesa=abc&pedido=12');

    escribir('Todo muy rico.');
    enviar();

    await screen.findByText(/Gracias/);
    expect(JSON.parse(fetchSimulado.mock.calls[0][1].body)).toEqual({ texto: 'Todo muy rico.', pedidoId: 12 });
  });

  it('si el servidor no responde lo dice y conserva el comentario', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    pintar();

    escribir('Nos atendieron muy rápido.');
    enviar();

    expect(await screen.findByText(/No se pudo enviar tu comentario/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Tu comentario/)).toHaveValue('Nos atendieron muy rápido.');
  });
});
