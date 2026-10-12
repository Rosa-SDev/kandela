import { MesaDTO, PedidoDTO, ReservaDTO, UsuarioDTO } from '@compartido/api/tipos';
import { situacionDeMesa } from './estado-de-mesa';

const MESA_3: MesaDTO = { id: 3, numero: 3, capacidad: 4, estado: 'LIBRE' };

const PEDIDO_BASE: PedidoDTO = {
  id: 12,
  fechaHora: '2026-10-12T16:40:00',
  estado: 'EN_PREPARACION',
  observaciones: null,
  metodoPago: null,
  montoPagado: null,
  fechaPago: null,
  mesaId: 3,
  mesaNumero: 3,
  meseroId: 2,
  cocineroId: null,
  clienteId: null,
  platillos: [],
  total: 0
};

const RESERVA_BASE: ReservaDTO = {
  id: 1,
  fechaHora: '2026-10-12T19:00:00',
  numPersonas: 6,
  estado: 'CONFIRMADA',
  clienteId: 3,
  clienteNombre: 'Marcela Gómez',
  mesaId: 3,
  meseroId: 2
};

const USUARIOS: UsuarioDTO[] = [
  { id: 2, nombre: 'Carlos Rojas', correo: 'carlos.rojas@raizysazon.co', rol: 'MESERO', activo: true }
];

const HOY = new Date('2026-10-12T17:00:00');

describe('situacionDeMesa', () => {
  it('deja libre la mesa sin pedido ni reserva', () => {
    const situacion = situacionDeMesa(MESA_3, [], [], USUARIOS, HOY);

    expect(situacion.clave).toBe('libre');
    expect(situacion.ahora).toBe('');
    expect(situacion.pedidoId).toBeNull();
  });

  it('nombra el pedido y su mesero cuando la mesa esta ocupada', () => {
    const situacion = situacionDeMesa(MESA_3, [PEDIDO_BASE], [], USUARIOS, HOY);

    expect(situacion.clave).toBe('ocupada');
    expect(situacion.ahora).toBe('Pedido #12 · Carlos Rojas');
    expect(situacion.pedidoId).toBe(12);
  });

  it('nombra solo el pedido si no llegaron los usuarios', () => {
    const situacion = situacionDeMesa(MESA_3, [PEDIDO_BASE], [], [], HOY);

    expect(situacion.ahora).toBe('Pedido #12');
  });

  it('un pedido cobrado o cancelado ya no ocupa la mesa', () => {
    const cobrado = { ...PEDIDO_BASE, estado: 'PAGADO' as const };
    const cancelado = { ...PEDIDO_BASE, estado: 'CANCELADO' as const };

    expect(situacionDeMesa(MESA_3, [cobrado], [], USUARIOS, HOY).clave).toBe('libre');
    expect(situacionDeMesa(MESA_3, [cancelado], [], USUARIOS, HOY).clave).toBe('libre');
  });

  it('marca reservada la mesa con una reserva de hoy, y dice la hora y el cliente', () => {
    const situacion = situacionDeMesa(MESA_3, [], [RESERVA_BASE], USUARIOS, HOY);

    expect(situacion.clave).toBe('reservada');
    expect(situacion.ahora).toBe('19:00 · Marcela Gómez');
  });

  it('no marca la mesa por una reserva de otro dia', () => {
    const manana = { ...RESERVA_BASE, fechaHora: '2026-10-13T19:00:00' };

    expect(situacionDeMesa(MESA_3, [], [manana], USUARIOS, HOY).clave).toBe('libre');
  });

  it('no marca la mesa por una reserva ya cerrada', () => {
    const cumplida = { ...RESERVA_BASE, estado: 'CUMPLIDA' as const };
    const cancelada = { ...RESERVA_BASE, estado: 'CANCELADA' as const };

    expect(situacionDeMesa(MESA_3, [], [cumplida], USUARIOS, HOY).clave).toBe('libre');
    expect(situacionDeMesa(MESA_3, [], [cancelada], USUARIOS, HOY).clave).toBe('libre');
  });

  it('no marca la mesa por una reserva sin mesa asignada', () => {
    const sinMesa = { ...RESERVA_BASE, mesaId: null };

    expect(situacionDeMesa(MESA_3, [], [sinMesa], USUARIOS, HOY).clave).toBe('libre');
  });

  it('el pedido manda sobre la reserva: si hay gente sentada, esta ocupada', () => {
    const situacion = situacionDeMesa(MESA_3, [PEDIDO_BASE], [RESERVA_BASE], USUARIOS, HOY);

    expect(situacion.clave).toBe('ocupada');
  });

  it('no confunde los pedidos ni las reservas de otras mesas', () => {
    const deLaMesa5 = { ...PEDIDO_BASE, mesaId: 5 };
    const reservaDeLa5 = { ...RESERVA_BASE, mesaId: 5 };

    expect(situacionDeMesa(MESA_3, [deLaMesa5], [reservaDeLa5], USUARIOS, HOY).clave).toBe('libre');
  });
});
