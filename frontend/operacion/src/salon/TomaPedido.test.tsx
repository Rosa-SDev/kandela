import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LineaPedidoDTO, MesaDTO, PedidoDTO, PlatilloDTO } from '@compartido/api/tipos';
import { TomaPedido } from './TomaPedido';

const MESA: MesaDTO = { id: 3, numero: 3, capacidad: 4, estado: 'OCUPADA' };

const CARTA: PlatilloDTO[] = [
  {
    id: 3,
    nombre: 'Bandeja paisa',
    descripcion: 'Chicharrón, fríjoles, arroz, huevo y aguacate',
    categoria: 'Fuertes',
    precio: 38000,
    disponible: true,
  },
  {
    id: 6,
    nombre: 'Limonada de coco',
    descripcion: 'Limón, crema de coco y hielo',
    categoria: 'Bebidas',
    precio: 11000,
    disponible: true,
  },
];

function linea(id: number, platilloId: number, nombre: string, precio: number): LineaPedidoDTO {
  return { id, platilloId, nombre, precioUnitario: precio };
}

function pedido(ajustes: Partial<PedidoDTO> = {}): PedidoDTO {
  const platillos = ajustes.platillos ?? [
    linea(10, 3, 'Bandeja paisa', 38000),
    linea(14, 3, 'Bandeja paisa', 38000),
  ];
  return {
    id: 12,
    fechaHora: '2026-10-12T16:55:00',
    estado: 'ABIERTO',
    observaciones: 'Sin aguacate.',
    metodoPago: null,
    montoPagado: null,
    fechaPago: null,
    mesaId: 3,
    mesaNumero: 3,
    meseroId: 2,
    cocineroId: null,
    clienteId: null,
    total: platillos.reduce((suma, l) => suma + l.precioUnitario, 0),
    ...ajustes,
    platillos,
  };
}

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status });
}

interface Respuestas {
  pedido?: () => Response | Promise<Response>;
  estado?: () => Response | Promise<Response>;
  carta?: () => Response | Promise<Response>;
  mesa?: () => Response | Promise<Response>;
  agregar?: () => Response | Promise<Response>;
  quitar?: () => Response | Promise<Response>;
  nota?: () => Response | Promise<Response>;
}

function simularBackend(respuestas: Respuestas = {}) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, opciones?: RequestInit) => {
      const metodo = opciones?.method ?? 'GET';
      if (url === '/api/pedidos/12/platillos' && metodo === 'POST') {
        return Promise.resolve((respuestas.agregar ?? (() => json(pedido())))());
      }
      if (url.startsWith('/api/pedidos/12/platillos/') && metodo === 'DELETE') {
        return Promise.resolve((respuestas.quitar ?? (() => new Response(null, { status: 204 })))());
      }
      if (url === '/api/pedidos/12/estado' && metodo === 'PATCH') {
        return Promise.resolve((respuestas.estado ?? (() => json(pedido({ estado: 'EN_COCINA' }))))());
      }
      if (url === '/api/pedidos/12' && metodo === 'PATCH') {
        return Promise.resolve((respuestas.nota ?? (() => json(pedido())))());
      }
      if (url === '/api/pedidos/12') return Promise.resolve((respuestas.pedido ?? (() => json(pedido())))());
      if (url === '/api/platillos') return Promise.resolve((respuestas.carta ?? (() => json(CARTA)))());
      if (url === '/api/mesas/3') return Promise.resolve((respuestas.mesa ?? (() => json(MESA)))());
      throw new Error(`Ruta no simulada: ${metodo} ${url}`);
    }),
  );
}

function llamadas(ruta: string, metodo: string) {
  const todas = (fetch as unknown as { mock: { calls: [string, RequestInit?][] } }).mock.calls;
  return todas.filter(([url, opciones]) => url === ruta && (opciones?.method ?? 'GET') === metodo);
}

function pintarToma() {
  return render(
    <MemoryRouter initialEntries={['/salon/pedido/12']}>
      <Routes>
        <Route path="/salon/pedido/:id" element={<TomaPedido />} />
        <Route path="/salon" element={<p>Plano del salón</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('TomaPedido', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('muestra la cabecera, la carta y la comanda del pedido', async () => {
    simularBackend();
    pintarToma();

    expect(await screen.findByRole('heading', { name: /Mesa 3/ })).toHaveTextContent('(4 personas)');
    expect(screen.getByLabelText('Agregar Bandeja paisa')).toBeInTheDocument();
    expect(screen.getByText('2 en la comanda')).toBeInTheDocument();
    expect(screen.getByLabelText('Cantidad de Bandeja paisa')).toHaveTextContent('2');
    expect(screen.getByLabelText('Nota para cocina')).toHaveValue('Sin aguacate.');
  });

  it('si la mesa no responde, el titulo se queda sin parentesis', async () => {
    simularBackend({ mesa: () => json({ error: 'La mesa 3 no existe.' }, 404) });
    pintarToma();

    const titulo = await screen.findByRole('heading', { name: /Mesa 3/ });
    await waitFor(() => expect(titulo).not.toHaveTextContent('personas'));
  });

  it('si el pedido no existe no se pinta la pantalla', async () => {
    simularBackend({ pedido: () => json({ error: 'El pedido 12 no existe.' }, 404) });
    pintarToma();

    expect(await screen.findByText('El pedido 12 no existe.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Nota para cocina')).not.toBeInTheDocument();
  });

  it('agregar manda el platillo y repinta con lo que responde el servidor', async () => {
    const conTres = pedido({
      platillos: [
        linea(10, 3, 'Bandeja paisa', 38000),
        linea(14, 3, 'Bandeja paisa', 38000),
        linea(15, 3, 'Bandeja paisa', 38000),
      ],
    });
    simularBackend({ agregar: () => json(conTres, 201) });
    pintarToma();

    fireEvent.click(await screen.findByLabelText('Agregar Bandeja paisa'));

    await waitFor(() =>
      expect(screen.getByLabelText('Cantidad de Bandeja paisa')).toHaveTextContent('3'),
    );
    const [, opciones] = llamadas('/api/pedidos/12/platillos', 'POST')[0];
    expect(JSON.parse(String(opciones?.body))).toEqual({ platilloId: 3 });
  });

  it('tres toques seguidos en mas solo mandan una peticion', async () => {
    let soltar: (r: Response) => void = () => {};
    simularBackend({
      agregar: () =>
        new Promise<Response>((resolver) => {
          soltar = resolver;
        }),
    });
    pintarToma();

    const mas = await screen.findByLabelText('Agregar Bandeja paisa');
    fireEvent.click(mas);
    await waitFor(() => expect(mas).toBeDisabled());
    fireEvent.click(mas);
    fireEvent.click(mas);

    soltar(json(pedido(), 201));
    await waitFor(() => expect(mas).toBeEnabled());
    expect(llamadas('/api/pedidos/12/platillos', 'POST')).toHaveLength(1);
  });

  it('quitar borra la ultima linea de ese platillo y vuelve a pedir el pedido', async () => {
    simularBackend();
    pintarToma();

    await screen.findByLabelText('Cantidad de Bandeja paisa');
    fireEvent.click(screen.getByLabelText('Quitar uno'));

    await waitFor(() =>
      expect(llamadas('/api/pedidos/12/platillos/14', 'DELETE')).toHaveLength(1),
    );
    // El borrado no devuelve cuerpo: el pedido se vuelve a consultar.
    await waitFor(() => expect(llamadas('/api/pedidos/12', 'GET').length).toBeGreaterThan(1));
  });

  it('un platillo agotado avisa y la carta se vuelve a pedir', async () => {
    let yaFallo = false;
    simularBackend({
      agregar: () => {
        yaFallo = true;
        return json({ error: 'El platillo Limonada de coco está agotado.' }, 409);
      },
      carta: () => json(yaFallo ? [CARTA[0], { ...CARTA[1], disponible: false }] : CARTA),
    });
    pintarToma();

    fireEvent.click(await screen.findByLabelText('Agregar Limonada de coco'));

    expect(
      await screen.findByText('El platillo Limonada de coco está agotado.'),
    ).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText('✕ Agotado hoy')).toBeInTheDocument());
    expect(llamadas('/api/platillos', 'GET')).toHaveLength(2);
  });

  it('la nota se guarda al salir del campo solo si cambio', async () => {
    simularBackend();
    pintarToma();

    const nota = await screen.findByLabelText('Nota para cocina');

    fireEvent.blur(nota);
    expect(llamadas('/api/pedidos/12', 'PATCH')).toHaveLength(0);

    fireEvent.change(nota, { target: { value: 'Sin aguacate. Chicharrón crocante.' } });
    fireEvent.blur(nota);

    await waitFor(() => expect(llamadas('/api/pedidos/12', 'PATCH')).toHaveLength(1));
    const [, opciones] = llamadas('/api/pedidos/12', 'PATCH')[0];
    expect(JSON.parse(String(opciones?.body))).toEqual({
      observaciones: 'Sin aguacate. Chicharrón crocante.',
    });
  });

  it('una nota demasiado larga se marca debajo del campo', async () => {
    simularBackend({
      nota: () =>
        json(
          {
            error: 'La petición tiene campos inválidos',
            campos: { observaciones: 'La nota no puede tener más de 255 caracteres.' },
          },
          400,
        ),
    });
    pintarToma();

    const nota = await screen.findByLabelText('Nota para cocina');
    fireEvent.change(nota, { target: { value: 'a'.repeat(256) } });
    fireEvent.blur(nota);

    expect(
      await screen.findByText('! La nota no puede tener más de 255 caracteres.'),
    ).toBeInTheDocument();
  });

  it('si la carta no responde se avisa y la comanda sigue en pie', async () => {
    simularBackend({
      carta: () => json({ error: 'La carta no está disponible en este momento.' }, 503),
    });
    pintarToma();

    expect(
      await screen.findByText('La carta no está disponible en este momento.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Cantidad de Bandeja paisa')).toHaveTextContent('2');
  });

  it('sin platillos no se puede enviar a cocina', async () => {
    simularBackend({ pedido: () => json(pedido({ platillos: [] })) });
    pintarToma();

    expect(await screen.findByText('Enviar a cocina')).toBeDisabled();
  });

  it('enviar guarda primero la nota pendiente y despues cambia el estado', async () => {
    simularBackend();
    pintarToma();

    const nota = await screen.findByLabelText('Nota para cocina');
    fireEvent.change(nota, { target: { value: 'Sin aguacate. Chicharrón crocante.' } });
    fireEvent.click(screen.getByText('Enviar a cocina'));

    await waitFor(() => expect(llamadas('/api/pedidos/12/estado', 'PATCH')).toHaveLength(1));

    // El orden importa: la cocina tiene que recibir la comanda con su nota.
    const rutas = (fetch as unknown as { mock: { calls: [string, RequestInit?][] } }).mock.calls
      .filter(([, opciones]) => opciones?.method === 'PATCH')
      .map(([url]) => url);
    expect(rutas).toEqual(['/api/pedidos/12', '/api/pedidos/12/estado']);

    const [, opciones] = llamadas('/api/pedidos/12/estado', 'PATCH')[0];
    expect(JSON.parse(String(opciones?.body))).toEqual({ estado: 'EN_COCINA' });
  });

  it('si la nota no se puede guardar, la comanda no se envia', async () => {
    simularBackend({
      nota: () =>
        json(
          {
            error: 'La petición tiene campos inválidos',
            campos: { observaciones: 'La nota no puede tener más de 255 caracteres.' },
          },
          400,
        ),
    });
    pintarToma();

    const nota = await screen.findByLabelText('Nota para cocina');
    fireEvent.change(nota, { target: { value: 'a'.repeat(256) } });
    fireEvent.click(screen.getByText('Enviar a cocina'));

    expect(
      await screen.findByText('! La nota no puede tener más de 255 caracteres.'),
    ).toBeInTheDocument();
    expect(llamadas('/api/pedidos/12/estado', 'PATCH')).toHaveLength(0);
  });

  it('despues de enviar, la comanda queda bloqueada', async () => {
    simularBackend();
    pintarToma();

    fireEvent.click(await screen.findByText('Enviar a cocina'));

    expect(
      await screen.findByText('Comanda enviada a cocina: ya no se pueden agregar platillos.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Nota para cocina')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Cantidad de Bandeja paisa')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Agregar Bandeja paisa')).toBeDisabled();
    expect(screen.getByText('Volver al salón')).toBeInTheDocument();
    expect(screen.queryByText('Enviar a cocina')).not.toBeInTheDocument();
  });

  it('entrar a un pedido ya enviado lo muestra bloqueado desde el principio', async () => {
    simularBackend({ pedido: () => json(pedido({ estado: 'EN_COCINA' })) });
    pintarToma();

    expect(
      await screen.findByText('Comanda enviada a cocina: ya no se pueden agregar platillos.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Volver al salón')).toBeInTheDocument();
    expect(screen.getByLabelText('Agregar Bandeja paisa')).toBeDisabled();
  });

  it('dos toques en enviar solo cambian el estado una vez', async () => {
    let soltar: (r: Response) => void = () => {};
    simularBackend({
      estado: () =>
        new Promise<Response>((resolver) => {
          soltar = resolver;
        }),
    });
    pintarToma();

    const enviar = await screen.findByText('Enviar a cocina');
    fireEvent.click(enviar);
    await waitFor(() => expect(enviar).toBeDisabled());
    fireEvent.click(enviar);

    soltar(json(pedido({ estado: 'EN_COCINA' })));
    await waitFor(() => expect(llamadas('/api/pedidos/12/estado', 'PATCH')).toHaveLength(1));
  });

  it('si el estado responde conflicto se avisa y se vuelve a pedir el pedido', async () => {
    // El pedido llega abierto; lo cobraron por otro lado mientras tanto.
    let yaChoco = false;
    simularBackend({
      estado: () => {
        yaChoco = true;
        return json({ error: 'No se puede modificar un pedido ya pagado.' }, 409);
      },
      pedido: () => json(pedido({ estado: yaChoco ? 'PAGADO' : 'ABIERTO' })),
    });
    pintarToma();

    fireEvent.click(await screen.findByText('Enviar a cocina'));

    expect(await screen.findByText('No se puede modificar un pedido ya pagado.')).toBeInTheDocument();
    // La pantalla queda con lo que de verdad dice el servidor.
    await waitFor(() =>
      expect(screen.getByText('Pedido cobrado: ya no se pueden agregar platillos.')).toBeInTheDocument(),
    );
    expect(llamadas('/api/pedidos/12', 'GET').length).toBeGreaterThan(1);
  });

  it('volver al salon lleva al plano', async () => {
    simularBackend();
    pintarToma();

    fireEvent.click(await screen.findByText('← Salón'));

    expect(screen.getByText('Plano del salón')).toBeInTheDocument();
  });
});
