export type Rol = 'ADMINISTRADOR' | 'MESERO' | 'COCINERO' | 'CAJERO';

export type EstadoMesa = 'LIBRE' | 'OCUPADA' | 'RESERVADA';

export type EstadoReserva = 'PENDIENTE' | 'CONFIRMADA' | 'CUMPLIDA' | 'CANCELADA';

export type EstadoPedido =
  | 'ABIERTO'
  | 'EN_COCINA'
  | 'EN_PREPARACION'
  | 'SERVIDO'
  | 'PAGADO'
  | 'CANCELADO';

export type MetodoPago = 'EFECTIVO' | 'TARJETA' | 'TRANSFERENCIA';

export interface UsuarioDTO {
  id: number;
  nombre: string;
  correo: string;
  rol: Rol;
  activo: boolean;
}

export interface PlatilloDTO {
  id: number;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  precio: number;
  disponible: boolean;
}

export interface ClienteDTO {
  id: number;
  nombre: string;
  documento: string;
  telefono: string | null;
}

export interface ReservaDTO {
  id: number;
  fechaHora: string;
  numPersonas: number;
  estado: EstadoReserva;
  clienteId: number;
  clienteNombre: string;
  mesaId: number | null;
  meseroId: number | null;
}

export interface MesaDTO {
  id: number;
  numero: number;
  capacidad: number;
  estado: EstadoMesa;
}

export interface LineaPedidoDTO {
  id: number;
  platilloId: number;
  nombre: string;
  precioUnitario: number;
}

export interface PedidoDTO {
  id: number;
  fechaHora: string;
  estado: EstadoPedido;
  observaciones: string | null;
  metodoPago: MetodoPago | null;
  montoPagado: number | null;
  fechaPago: string | null;
  mesaId: number;
  mesaNumero: number;
  meseroId: number;
  cocineroId: number | null;
  clienteId: number | null;
  platillos: LineaPedidoDTO[];
  total: number;
}

export interface FacturaDTO {
  id: number;
  numero: string;
  fecha: string;
  subtotal: number;
  impuestos: number;
  total: number;
  anulada: boolean;
  pedidoId: number;
  cajeroId: number;
}

export interface Login {
  correo: string;
  password: string;
}

export interface CrearUsuario {
  nombre: string;
  correo: string;
  rol: Rol;
  password: string;
}

export interface ActualizarUsuario {
  nombre: string;
  correo: string;
  password?: string;
}

export interface CrearPlatillo {
  nombre: string;
  descripcion?: string;
  categoria: string;
  precio: number;
  disponible: boolean;
}

export interface Descuento {
  porcentaje: number;
}

export interface CrearCliente {
  nombre: string;
  documento: string;
  telefono?: string;
}

export interface CrearReserva {
  fechaHora: string;
  numPersonas: number;
  clienteId: number;
  mesaId?: number;
  meseroId?: number;
}

export interface CambioEstadoReserva {
  nuevoEstado: EstadoReserva;
}

export interface CrearMesa {
  numero: number;
  capacidad: number;
}

export interface CrearPedido {
  mesaId: number;
  meseroId: number;
  clienteId?: number;
  observaciones?: string;
}

export interface ActualizarNotaPedido {
  observaciones: string;
}

export interface AgregarPlatillo {
  platilloId: number;
}

export interface CambioEstadoPedido {
  estado: EstadoPedido;
}

export interface CrearFactura {
  pedidoId: number;
  cajeroId: number;
  metodoPago: MetodoPago;
  monto: number;
}
