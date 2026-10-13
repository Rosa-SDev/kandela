import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ClienteDTO, MesaDTO, ReservaDTO, UsuarioDTO } from '@compartido/api/tipos';
import { SesionProveedor } from '../nucleo/sesion';
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

const CLIENTES: ClienteDTO[] = [
  { id: 1, nombre: 'Ana Torres', documento: '1001234567', telefono: '3001234567' },
  { id: 3, nombre: 'Marcela Gómez', documento: '1009988776', telefono: null },
];

const MESEROS: UsuarioDTO[] = [
  { id: 2, nombre: 'Carlos Rojas', correo: 'carlos.rojas@raizysazon.co', rol: 'MESERO', activo: true },
  { id: 3, nombre: 'Andrea Pérez', correo: 'andrea.perez@raizysazon.co', rol: 'MESERO', activo: true },
];

const MESERO_EN_SESION = MESEROS[0];

interface Respuestas {
  reservas?: () => Response | Promise<Response>;
  mesas?: () => Response | Promise<Response>;
  clientes?: () => Response | Promise<Response>;
  meseros?: () => Response | Promise<Response>;
  cambio?: () => Response | Promise<Response>;
  crear?: () => Response | Promise<Response>;
}

/** Responde según la ruta, para poder tumbar una sola de las consultas. */
function simularBackend(respuestas: Respuestas) {
  vi.stubGlobal(
    'fetch',
    vi.fn((url: string, opciones?: RequestInit) => {
      if (opciones?.method === 'PATCH') {
        return Promise.resolve((respuestas.cambio ?? (() => json({})))());
      }
      if (opciones?.method === 'POST') {
        return Promise.resolve((respuestas.crear ?? (() => json(DE_ANA, 201)))());
      }
      if (url === '/api/mesas') {
        return Promise.resolve((respuestas.mesas ?? (() => json(MESAS)))());
      }
      if (url === '/api/clientes') {
        return Promise.resolve((respuestas.clientes ?? (() => json(CLIENTES)))());
      }
      if (url.startsWith('/api/usuarios')) {
        return Promise.resolve((respuestas.meseros ?? (() => json(MESEROS)))());
      }
      return Promise.resolve((respuestas.reservas ?? (() => json([])))());
    }),
  );
}

/** Los cuerpos enviados con POST, ya convertidos desde JSON. */
function reservasEnviadas(): unknown[] {
  const llamadas = (fetch as unknown as { mock: { calls: [string, RequestInit?][] } }).mock.calls;
  return llamadas
    .filter(([url, opciones]) => url === '/api/reservas' && opciones?.method === 'POST')
    .map(([, opciones]) => JSON.parse(String(opciones?.body)));
}

/** El drawer necesita la sesión para dejar elegido el mesero que lo abre. */
function pintarConSesion() {
  sessionStorage.setItem('kandela.sesion', JSON.stringify(MESERO_EN_SESION));
  return render(
    <SesionProveedor>
      <Reservas />
    </SesionProveedor>,
  );
}

async function abrirElDrawer() {
  fireEvent.click(await screen.findByRole('button', { name: 'Nueva reserva' }));
  return screen.findByRole('dialog', { name: 'Nueva reserva' });
}

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('las reservas del salón', () => {
  it('las ordena de la mas proxima a la mas lejana', async () => {
    simularBackend({ reservas: () => json([DE_LUIS, DE_MARCELA, DE_ANA]) });
    const { container } = pintarConSesion();

    await screen.findByText('Marcela Gómez');
    const filas = [...container.querySelectorAll('.f-fila')];
    expect(filas).toHaveLength(3);
    expect(filas[0].textContent).toContain('Marcela Gómez');
    expect(filas[1].textContent).toContain('Ana Torres');
    expect(filas[2].textContent).toContain('Luis Ramírez');
  });

  it('dice vigente en singular cuando solo queda una', async () => {
    simularBackend({ reservas: () => json([DE_MARCELA, CANCELADA]) });
    pintarConSesion();

    expect(await screen.findByText('(1 vigente)')).toBeInTheDocument();
  });

  it('cuenta en el parentesis solo las reservas vigentes', async () => {
    simularBackend({ reservas: () => json([DE_MARCELA, DE_ANA, CANCELADA]) });
    pintarConSesion();

    expect(await screen.findByText(/2 vigentes/)).toBeInTheDocument();
  });

  it('deja en la lista las cerradas, atenuadas', async () => {
    simularBackend({ reservas: () => json([DE_MARCELA, CANCELADA]) });
    const { container } = pintarConSesion();

    await screen.findByText('Pedro Díaz');
    const apagadas = container.querySelectorAll('.f-fila--apagada');
    expect(apagadas).toHaveLength(1);
    expect(apagadas[0].textContent).toContain('Pedro Díaz');
  });

  it('nombra la mesa por su numero, que viene del salon', async () => {
    simularBackend({ reservas: () => json([DE_MARCELA]) });
    pintarConSesion();

    expect(await screen.findByText('Mesa 4')).toBeInTheDocument();
  });

  it('sigue mostrando las reservas cuando el salon no responde', async () => {
    simularBackend({
      reservas: () => json([DE_MARCELA]),
      mesas: () => json({ error: 'El salón no está disponible.' }, 503),
    });
    pintarConSesion();

    expect(await screen.findByText('Marcela Gómez')).toBeInTheDocument();
    expect(screen.getByText('6 personas')).toBeInTheDocument();
  });

  it('avisa cuando no hay ninguna reserva', async () => {
    simularBackend({ reservas: () => json([]) });
    pintarConSesion();

    expect(await screen.findByText(/Sin reservas/)).toBeInTheDocument();
  });

  it('ofrece reintentar cuando el servicio de reservas no responde', async () => {
    simularBackend({ reservas: () => json({ error: 'No disponible.' }, 503) });
    pintarConSesion();

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
    pintarConSesion();

    await screen.findByText('Ana Torres');
    expect(screen.getAllByRole('button', { name: 'Confirmar' })).toHaveLength(1);
  });

  it('ofrece cumplida solo en las confirmadas', async () => {
    simularBackend({ reservas: () => json([DE_MARCELA, DE_ANA]) });
    pintarConSesion();

    await screen.findByText('Marcela Gómez');
    expect(screen.getAllByRole('button', { name: 'Cumplida' })).toHaveLength(1);
  });

  it('no ofrece nada en las reservas cerradas', async () => {
    simularBackend({ reservas: () => json([CANCELADA]) });
    pintarConSesion();

    await screen.findByText('Pedro Díaz');
    expect(screen.queryByRole('button', { name: 'Confirmar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Cumplida' })).not.toBeInTheDocument();
  });

  it('confirmar manda el estado nuevo a esa reserva', async () => {
    simularBackend({
      reservas: () => json([DE_ANA]),
      cambio: () => json({ ...DE_ANA, estado: 'CONFIRMADA' }),
    });
    pintarConSesion();

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
    pintarConSesion();

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
    pintarConSesion();

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
    pintarConSesion();

    fireEvent.click(await screen.findByRole('button', { name: 'Confirmar' }));

    expect(
      await screen.findByText('No se puede pasar una reserva de PENDIENTE a CUMPLIDA.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });
});

describe('cancelar una reserva', () => {
  async function abrirElDialogoDe(nombre: string) {
    await screen.findByText(nombre);
    const fila = [...document.querySelectorAll('.f-fila')].find((una) =>
      una.textContent?.includes(nombre),
    ) as HTMLElement;
    fireEvent.click(within(fila).getByRole('button', { name: 'Cancelar' }));
    return screen.findByRole('alertdialog');
  }

  it('ofrece cancelar en las vigentes, nunca en las cerradas', async () => {
    simularBackend({ reservas: () => json([DE_MARCELA, DE_ANA, CANCELADA]) });
    pintarConSesion();

    await screen.findByText('Pedro Díaz');
    expect(screen.getAllByRole('button', { name: 'Cancelar' })).toHaveLength(2);
  });

  it('no cancela nada hasta que se confirma en el dialogo', async () => {
    simularBackend({ reservas: () => json([DE_ANA]) });
    pintarConSesion();

    const dialogo = await abrirElDialogoDe('Ana Torres');

    expect(within(dialogo).getByText('¿Cancelar la reserva de Ana Torres?')).toBeInTheDocument();
    expect(
      (fetch as unknown as { mock: { calls: [string, RequestInit?][] } }).mock.calls.filter(
        ([, opciones]) => opciones?.method === 'PATCH',
      ),
    ).toHaveLength(0);
  });

  it('dice que la mesa deja de aparecer reservada', async () => {
    simularBackend({ reservas: () => json([DE_MARCELA]) });
    pintarConSesion();

    const dialogo = await abrirElDialogoDe('Marcela Gómez');

    expect(
      within(dialogo).getByText('La mesa 4 deja de aparecer reservada.'),
    ).toBeInTheDocument();
    expect(
      within(dialogo).getByText(/habría que registrar una nueva/),
    ).toBeInTheDocument();
  });

  it('cuando la reserva no tiene mesa, dice que queda en el historial', async () => {
    simularBackend({ reservas: () => json([{ ...DE_ANA, mesaId: null }]) });
    pintarConSesion();

    const dialogo = await abrirElDialogoDe('Ana Torres');

    expect(
      within(dialogo).getByText('La reserva queda en el historial como cancelada.'),
    ).toBeInTheDocument();
  });

  it('volver cierra el dialogo sin tocar la reserva', async () => {
    simularBackend({ reservas: () => json([DE_ANA]) });
    pintarConSesion();

    const dialogo = await abrirElDialogoDe('Ana Torres');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Volver' }));

    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByText('Pendiente')).toBeInTheDocument();
  });

  it('confirmar cancela la reserva y cierra el dialogo', async () => {
    simularBackend({
      reservas: () => json([DE_ANA]),
      cambio: () => json({ ...DE_ANA, estado: 'CANCELADA' }),
    });
    pintarConSesion();

    const dialogo = await abrirElDialogoDe('Ana Torres');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar reserva' }));

    expect(await screen.findByText('Reserva de Ana Torres cancelada.')).toBeInTheDocument();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
  });

  it('si el servidor la rechaza, el mensaje se queda dentro del dialogo', async () => {
    simularBackend({
      reservas: () => json([DE_ANA]),
      cambio: () => json({ error: 'No se puede pasar una reserva de CANCELADA a CANCELADA.' }, 409),
    });
    pintarConSesion();

    const dialogo = await abrirElDialogoDe('Ana Torres');
    fireEvent.click(within(dialogo).getByRole('button', { name: 'Cancelar reserva' }));

    const abierto = await screen.findByRole('alertdialog');
    expect(
      within(abierto).getByText('No se puede pasar una reserva de CANCELADA a CANCELADA.'),
    ).toBeInTheDocument();
    expect(
      within(abierto).queryByRole('button', { name: 'Cancelar reserva' }),
    ).not.toBeInTheDocument();
  });
});

describe('el drawer de nueva reserva', () => {
  it('no esta abierto hasta que se pulsa el boton', async () => {
    simularBackend({ reservas: () => json([DE_MARCELA]) });
    pintarConSesion();

    await screen.findByText('Marcela Gómez');
    expect(screen.queryByRole('dialog', { name: 'Nueva reserva' })).not.toBeInTheDocument();
  });

  it('deja elegido el mesero de la sesion', async () => {
    simularBackend({ reservas: () => json([]) });
    pintarConSesion();

    const drawer = await abrirElDrawer();

    expect(within(drawer).getByLabelText(/Mesero/)).toHaveValue('2');
  });

  it('ofrece los clientes con su documento', async () => {
    simularBackend({ reservas: () => json([]) });
    pintarConSesion();

    const drawer = await abrirElDrawer();

    expect(within(drawer).getByRole('option', { name: 'Elija un cliente' })).toBeInTheDocument();
    expect(
      within(drawer).getByRole('option', { name: 'Ana Torres · 1001234567' }),
    ).toBeInTheDocument();
  });

  it('ofrece las mesas con su capacidad, y dejarla sin asignar', async () => {
    simularBackend({ reservas: () => json([]) });
    pintarConSesion();

    const drawer = await abrirElDrawer();
    // «Sin asignar» también está en Mesero, así que se mira dentro de Mesa.
    const mesa = within(drawer).getByLabelText(/^Mesa/);

    expect(within(mesa).getByRole('option', { name: 'Sin asignar' })).toBeInTheDocument();
    expect(within(mesa).getByRole('option', { name: 'Mesa 2 · 4 personas' })).toBeInTheDocument();
    expect(within(mesa).getByRole('option', { name: 'Mesa 1 · 2 personas' })).toBeInTheDocument();
  });

  it('con los campos vacios avisa cuantos revisar y no envia nada', async () => {
    simularBackend({ reservas: () => json([]) });
    pintarConSesion();

    const drawer = await abrirElDrawer();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Registrar reserva' }));

    expect(await screen.findByText('Revise 4 campos')).toBeInTheDocument();
    expect(within(drawer).getByText(/El cliente es obligatorio/)).toBeInTheDocument();
    expect(within(drawer).getByText(/La fecha es obligatoria/)).toBeInTheDocument();
    expect(within(drawer).getByText(/La hora es obligatoria/)).toBeInTheDocument();
    expect(within(drawer).getByText(/El número de personas es obligatorio/)).toBeInTheDocument();
    expect(reservasEnviadas()).toHaveLength(0);
  });

  it('el error de un campo desaparece al escribir en el', async () => {
    simularBackend({ reservas: () => json([]) });
    pintarConSesion();

    const drawer = await abrirElDrawer();
    fireEvent.click(within(drawer).getByRole('button', { name: 'Registrar reserva' }));
    await screen.findByText('Revise 4 campos');

    fireEvent.change(within(drawer).getByLabelText(/Personas/), { target: { value: '4' } });

    expect(
      within(drawer).queryByText(/El número de personas es obligatorio/),
    ).not.toBeInTheDocument();
  });

  it('envia la reserva con la fecha y la hora juntas, sin convertir la zona', async () => {
    simularBackend({ reservas: () => json([]) });
    pintarConSesion();

    const drawer = await abrirElDrawer();
    fireEvent.change(within(drawer).getByLabelText(/Cliente/), { target: { value: '1' } });
    fireEvent.change(within(drawer).getByLabelText(/Fecha/), { target: { value: '2026-12-24' } });
    fireEvent.change(within(drawer).getByLabelText(/Hora/), { target: { value: '19:00' } });
    fireEvent.change(within(drawer).getByLabelText(/Personas/), { target: { value: '4' } });
    fireEvent.change(within(drawer).getByLabelText(/^Mesa/), { target: { value: '2' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Registrar reserva' }));

    await waitFor(() => expect(reservasEnviadas()).toHaveLength(1));
    expect(reservasEnviadas()[0]).toEqual({
      fechaHora: '2026-12-24T19:00:00',
      numPersonas: 4,
      clienteId: 1,
      mesaId: 2,
      meseroId: 2,
    });
  });

  it('omite la mesa cuando se deja sin asignar', async () => {
    simularBackend({ reservas: () => json([]) });
    pintarConSesion();

    const drawer = await abrirElDrawer();
    fireEvent.change(within(drawer).getByLabelText(/Cliente/), { target: { value: '1' } });
    fireEvent.change(within(drawer).getByLabelText(/Fecha/), { target: { value: '2026-12-24' } });
    fireEvent.change(within(drawer).getByLabelText(/Hora/), { target: { value: '19:00' } });
    fireEvent.change(within(drawer).getByLabelText(/Personas/), { target: { value: '6' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Registrar reserva' }));

    await waitFor(() => expect(reservasEnviadas()).toHaveLength(1));
    expect(reservasEnviadas()[0]).not.toHaveProperty('mesaId');
  });

  it('al registrarla cierra el drawer, lo cuenta y la pone en la lista', async () => {
    simularBackend({
      reservas: () => json([DE_MARCELA]),
      crear: () => json({ ...DE_ANA, fechaHora: '2026-12-24T19:00:00' }, 201),
    });
    pintarConSesion();

    const drawer = await abrirElDrawer();
    fireEvent.change(within(drawer).getByLabelText(/Cliente/), { target: { value: '1' } });
    fireEvent.change(within(drawer).getByLabelText(/Fecha/), { target: { value: '2026-12-24' } });
    fireEvent.change(within(drawer).getByLabelText(/Hora/), { target: { value: '19:00' } });
    fireEvent.change(within(drawer).getByLabelText(/Personas/), { target: { value: '4' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Registrar reserva' }));

    expect(
      await screen.findByText(
        'Reserva de Ana Torres registrada para 24 dic a las 19:00. Queda pendiente de confirmar.',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Nueva reserva' })).not.toBeInTheDocument();
    expect(screen.getByText('Ana Torres')).toBeInTheDocument();
  });

  it('escape cierra el drawer sin registrar nada', async () => {
    simularBackend({ reservas: () => json([]) });
    pintarConSesion();

    const drawer = await abrirElDrawer();
    fireEvent.keyDown(document.activeElement ?? drawer, { key: 'Escape' });

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Nueva reserva' })).not.toBeInTheDocument(),
    );
    expect(reservasEnviadas()).toHaveLength(0);
  });

  it('el velo cubre la pantalla, barra incluida', async () => {
    simularBackend({ reservas: () => json([]) });
    const { container } = pintarConSesion();

    await abrirElDrawer();

    // El velo se dibuja sobre todo el shell, que ocupa la ventana: por eso
    // tapa también la barra de rol y no deja pulsar las pestañas.
    expect(container.querySelector('.f-velo')).toBeInTheDocument();
    expect(container.querySelector('.f-velo > .f-drawer')).toBeInTheDocument();
  });
});

describe('los campos que rechaza el servidor', () => {
  /** Deja el formulario correcto para que el envío llegue al servidor. */
  async function llenarYEnviar(drawer: HTMLElement) {
    fireEvent.change(within(drawer).getByLabelText(/Cliente/), { target: { value: '1' } });
    fireEvent.change(within(drawer).getByLabelText(/Fecha/), { target: { value: '2026-12-24' } });
    fireEvent.change(within(drawer).getByLabelText(/Hora/), { target: { value: '19:00' } });
    fireEvent.change(within(drawer).getByLabelText(/Personas/), { target: { value: '4' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Registrar reserva' }));
  }

  it('marca la fecha y la hora a la vez cuando el servidor rechaza fechaHora', async () => {
    simularBackend({
      reservas: () => json([]),
      crear: () =>
        json(
          {
            error: 'La petición tiene campos inválidos',
            campos: { fechaHora: 'La fecha y hora son obligatorias' },
          },
          400,
        ),
    });
    pintarConSesion();

    const drawer = await abrirElDrawer();
    await llenarYEnviar(drawer);

    const abierto = await screen.findByRole('dialog', { name: 'Nueva reserva' });
    const mensajes = within(abierto).getAllByText(/La fecha y hora son obligatorias/);
    expect(mensajes).toHaveLength(2);
    expect(within(abierto).getByLabelText(/Fecha/)).toHaveAttribute('aria-invalid', 'true');
    expect(within(abierto).getByLabelText(/Hora/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('coloca cada mensaje bajo su campo y dice cuantos revisar', async () => {
    simularBackend({
      reservas: () => json([]),
      crear: () =>
        json(
          {
            error: 'La petición tiene campos inválidos',
            campos: {
              numPersonas: 'Debe ser al menos 1 persona',
              clienteId: 'El cliente es obligatorio',
            },
          },
          400,
        ),
    });
    pintarConSesion();

    const drawer = await abrirElDrawer();
    await llenarYEnviar(drawer);

    const abierto = await screen.findByRole('dialog', { name: 'Nueva reserva' });
    expect(within(abierto).getByText('Revise 2 campos')).toBeInTheDocument();
    expect(within(abierto).getByText(/Debe ser al menos 1 persona/)).toBeInTheDocument();
    expect(within(abierto).getByText(/El cliente es obligatorio/)).toBeInTheDocument();
    expect(within(abierto).getByText(/No se registró nada todavía/)).toBeInTheDocument();
  });

  it('el drawer se queda abierto y no pierde lo escrito', async () => {
    simularBackend({
      reservas: () => json([]),
      crear: () =>
        json({ error: 'La petición tiene campos inválidos', campos: { clienteId: 'malo' } }, 400),
    });
    pintarConSesion();

    const drawer = await abrirElDrawer();
    await llenarYEnviar(drawer);

    const abierto = await screen.findByRole('dialog', { name: 'Nueva reserva' });
    expect(within(abierto).getByLabelText(/Fecha/)).toHaveValue('2026-12-24');
    expect(within(abierto).getByLabelText(/Personas/)).toHaveValue('4');
  });

  it('un rechazo sin campos se cuenta con el texto del servidor', async () => {
    simularBackend({
      reservas: () => json([]),
      crear: () => json({ error: 'No se puede reservar para una fecha que ya pasó.' }, 400),
    });
    pintarConSesion();

    const drawer = await abrirElDrawer();
    await llenarYEnviar(drawer);

    expect(
      await screen.findByText('No se puede reservar para una fecha que ya pasó.'),
    ).toBeInTheDocument();
  });
});

describe('el conflicto de capacidad de la mesa', () => {
  /** Pide la mesa 2, que tiene cuatro puestos, para seis personas. */
  async function pedirSeisEnLaMesaDeCuatro(drawer: HTMLElement) {
    fireEvent.change(within(drawer).getByLabelText(/Cliente/), { target: { value: '1' } });
    fireEvent.change(within(drawer).getByLabelText(/Fecha/), { target: { value: '2026-12-24' } });
    fireEvent.change(within(drawer).getByLabelText(/Hora/), { target: { value: '21:00' } });
    fireEvent.change(within(drawer).getByLabelText(/Personas/), { target: { value: '6' } });
    fireEvent.change(within(drawer).getByLabelText(/^Mesa/), { target: { value: '2' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Registrar reserva' }));
  }

  it('la pantalla no se adelanta: la peticion sale y el servidor decide', async () => {
    simularBackend({ reservas: () => json([]) });
    pintarConSesion();

    const drawer = await abrirElDrawer();
    await pedirSeisEnLaMesaDeCuatro(drawer);

    await waitFor(() => expect(reservasEnviadas()).toHaveLength(1));
    expect(reservasEnviadas()[0]).toMatchObject({ numPersonas: 6, mesaId: 2 });
  });

  it('muestra el mensaje del servidor y marca el campo de la mesa', async () => {
    simularBackend({
      reservas: () => json([]),
      crear: () =>
        json(
          { error: 'La mesa 2 no alcanza para 6 personas. Su capacidad es de 4.' },
          409,
        ),
    });
    pintarConSesion();

    const drawer = await abrirElDrawer();
    await pedirSeisEnLaMesaDeCuatro(drawer);

    const abierto = await screen.findByRole('dialog', { name: 'Nueva reserva' });
    expect(
      within(abierto).getByText('La mesa 2 no alcanza para 6 personas. Su capacidad es de 4.'),
    ).toBeInTheDocument();
    expect(within(abierto).getByText(/Elija otra mesa o déjela sin asignar/)).toBeInTheDocument();
    expect(within(abierto).getByText(/Revise este campo/)).toBeInTheDocument();
    expect(within(abierto).getByLabelText(/^Mesa/)).toHaveAttribute('aria-invalid', 'true');
  });

  it('al dejar la mesa sin asignar el conflicto desaparece y se registra', async () => {
    let conflicto = true;
    simularBackend({
      reservas: () => json([]),
      crear: () => {
        if (conflicto) {
          conflicto = false;
          return json({ error: 'La mesa 2 no alcanza para 6 personas. Su capacidad es de 4.' }, 409);
        }
        return json({ ...DE_ANA, numPersonas: 6, mesaId: null }, 201);
      },
    });
    pintarConSesion();

    const drawer = await abrirElDrawer();
    await pedirSeisEnLaMesaDeCuatro(drawer);
    await screen.findByText(/no alcanza para 6 personas/);

    fireEvent.change(within(drawer).getByLabelText(/^Mesa/), { target: { value: '' } });
    fireEvent.click(within(drawer).getByRole('button', { name: 'Registrar reserva' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Nueva reserva' })).not.toBeInTheDocument(),
    );
    expect(reservasEnviadas()[1]).not.toHaveProperty('mesaId');
  });

  it('un cliente o una mesa que no existen se cuentan con el texto del servidor', async () => {
    simularBackend({
      reservas: () => json([]),
      crear: () => json({ error: 'La mesa 9 no existe.' }, 404),
    });
    pintarConSesion();

    const drawer = await abrirElDrawer();
    await pedirSeisEnLaMesaDeCuatro(drawer);

    expect(await screen.findByText('La mesa 9 no existe.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument();
  });

  it('si el salon no responde ofrece reintentar el mismo envio', async () => {
    let caido = true;
    simularBackend({
      reservas: () => json([]),
      crear: () => {
        if (caido) {
          caido = false;
          return json({ error: 'El salón no está disponible en este momento.' }, 503);
        }
        return json(DE_ANA, 201);
      },
    });
    pintarConSesion();

    const drawer = await abrirElDrawer();
    await pedirSeisEnLaMesaDeCuatro(drawer);

    const abierto = await screen.findByRole('dialog', { name: 'Nueva reserva' });
    expect(
      within(abierto).getByText('El salón no está disponible en este momento.'),
    ).toBeInTheDocument();

    fireEvent.click(within(abierto).getByRole('button', { name: 'Reintentar' }));

    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Nueva reserva' })).not.toBeInTheDocument(),
    );
    expect(reservasEnviadas()).toHaveLength(2);
  });
});
