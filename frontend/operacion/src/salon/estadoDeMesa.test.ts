import { describe, expect, it } from 'vitest';
import type { EstadoPedido, MesaDTO, PedidoDTO, ReservaDTO } from '@compartido/api/tipos';
import { esElMismoDia, estadoDeMesa } from './estadoDeMesa';

const MESA: MesaDTO = { id: 3, numero: 3, capacidad: 4, estado: 'LIBRE' };

/** Una fecha local: el mes se escribe como se habla, de 1 a 12. */
function fechaLocal(anio: number, mes: number, dia: number, hora = 12, minuto = 0): Date {
  return new Date(anio, mes - 1, dia, hora, minuto);
}

/** Cómo la escribe el backend: hora local, sin zona. */
function comoLaEscribeElBackend(fecha: Date): string {
  const dos = (n: number) => String(n).padStart(2, '0');
  return (
    `${fecha.getFullYear()}-${dos(fecha.getMonth() + 1)}-${dos(fecha.getDate())}` +
    `T${dos(fecha.getHours())}:${dos(fecha.getMinutes())}:00`
  );
}

function pedido(estado: EstadoPedido, mesaId = 3): PedidoDTO {
  return {
    id: 1,
    fechaHora: '2026-10-11T12:00:00',
    estado,
    observaciones: null,
    metodoPago: null,
    montoPagado: null,
    fechaPago: null,
    mesaId,
    mesaNumero: mesaId,
    meseroId: 2,
    cocineroId: null,
    clienteId: null,
    platillos: [],
    total: 0,
  };
}

function reserva(ajustes: Partial<ReservaDTO> = {}): ReservaDTO {
  return {
    id: 1,
    fechaHora: comoLaEscribeElBackend(fechaLocal(2026, 10, 11, 19, 0)),
    numPersonas: 6,
    estado: 'CONFIRMADA',
    clienteId: 3,
    clienteNombre: 'Marcela Gómez',
    mesaId: 3,
    meseroId: 2,
    ...ajustes,
  };
}

describe('estadoDeMesa', () => {
  const HOY = fechaLocal(2026, 10, 11, 12, 0);

  it('sin pedidos ni reservas la mesa esta libre', () => {
    expect(estadoDeMesa(MESA, [], [], HOY)).toEqual({ clave: 'libre' });
  });

  it.each<EstadoPedido>(['ABIERTO', 'EN_COCINA', 'EN_PREPARACION', 'SERVIDO'])(
    'un pedido %s ocupa la mesa',
    (estado) => {
      const resultado = estadoDeMesa(MESA, [pedido(estado)], [], HOY);
      expect(resultado).toMatchObject({ clave: 'ocupada' });
    },
  );

  it.each<EstadoPedido>(['PAGADO', 'CANCELADO'])('un pedido %s ya no ocupa la mesa', (estado) => {
    expect(estadoDeMesa(MESA, [pedido(estado)], [], HOY)).toEqual({ clave: 'libre' });
  });

  it('un pedido de otra mesa no la ocupa', () => {
    expect(estadoDeMesa(MESA, [pedido('ABIERTO', 5)], [], HOY)).toEqual({ clave: 'libre' });
  });

  it('una reserva de hoy, vigente y con mesa, la marca reservada', () => {
    expect(estadoDeMesa(MESA, [], [reserva()], HOY)).toMatchObject({ clave: 'reservada' });
  });

  it('el pedido manda sobre la reserva', () => {
    const resultado = estadoDeMesa(MESA, [pedido('EN_COCINA')], [reserva()], HOY);
    expect(resultado).toMatchObject({ clave: 'ocupada' });
  });

  it('una reserva pendiente tambien la marca', () => {
    expect(estadoDeMesa(MESA, [], [reserva({ estado: 'PENDIENTE' })], HOY)).toMatchObject({
      clave: 'reservada',
    });
  });

  it.each<ReservaDTO['estado']>(['CUMPLIDA', 'CANCELADA'])(
    'una reserva %s ya no marca la mesa',
    (estado) => {
      expect(estadoDeMesa(MESA, [], [reserva({ estado })], HOY)).toEqual({ clave: 'libre' });
    },
  );

  it('una reserva sin mesa asignada no marca ninguna', () => {
    expect(estadoDeMesa(MESA, [], [reserva({ mesaId: null })], HOY)).toEqual({ clave: 'libre' });
  });

  it('una reserva de otra mesa no la marca', () => {
    expect(estadoDeMesa(MESA, [], [reserva({ mesaId: 5 })], HOY)).toEqual({ clave: 'libre' });
  });

  it('una reserva de manana no marca la mesa hoy', () => {
    const manana = comoLaEscribeElBackend(fechaLocal(2026, 10, 12, 19, 0));
    expect(estadoDeMesa(MESA, [], [reserva({ fechaHora: manana })], HOY)).toEqual({ clave: 'libre' });
  });

  it('una reserva de ayer tampoco', () => {
    const ayer = comoLaEscribeElBackend(fechaLocal(2026, 10, 10, 19, 0));
    expect(estadoDeMesa(MESA, [], [reserva({ fechaHora: ayer })], HOY)).toEqual({ clave: 'libre' });
  });

  it('a las nueve de la noche la reserva de las siete sigue marcando la mesa', () => {
    // A esa hora local en Bogotá ya es el día siguiente en UTC: si el día se
    // sacara de la fecha en UTC, la mesa 4 se vería libre en plena cena.
    const nueveDeLaNoche = fechaLocal(2026, 10, 11, 21, 0);
    expect(estadoDeMesa(MESA, [], [reserva()], nueveDeLaNoche)).toMatchObject({
      clave: 'reservada',
    });
  });

  it('la reserva sigue marcando la mesa aunque ya haya pasado su hora', () => {
    const casiMedianoche = fechaLocal(2026, 10, 11, 23, 30);
    expect(estadoDeMesa(MESA, [], [reserva()], casiMedianoche)).toMatchObject({
      clave: 'reservada',
    });
  });
});

describe('esElMismoDia', () => {
  it('compara el dia local, no el instante', () => {
    expect(esElMismoDia(fechaLocal(2026, 10, 11, 0, 1), fechaLocal(2026, 10, 11, 23, 59))).toBe(true);
    expect(esElMismoDia(fechaLocal(2026, 10, 11, 23, 59), fechaLocal(2026, 10, 12, 0, 1))).toBe(false);
  });
});
