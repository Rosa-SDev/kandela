import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useParams } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PedidoDTO } from '@compartido/api/tipos';
import { SesionProveedor } from '../nucleo/sesion';
import { MisPedidos } from './MisPedidos';

const MESERO = {
  id: 2,
  nombre: 'Carlos Rojas',
  correo: 'carlos.rojas@raizysazon.co',
  rol: 'MESERO',
  activo: true,
};

const BASE: PedidoDTO = {
  id: 12,
  fechaHora: '2026-10-12T16:40:00',
  estado: 'ABIERTO',
  observaciones: 'Ajiaco sin alcaparras.',
  metodoPago: null,
  montoPagado: null,
  fechaPago: null,
  mesaId: 3,
  mesaNumero: 3,
  meseroId: 2,
  cocineroId: null,
  clienteId: null,
  platillos: [{ id: 1, platilloId: 3, nombre: 'Bandeja paisa', precioUnitario: 38000 }],
  total: 38000,
};

const EN_PREPARACION: PedidoDTO = { ...BASE, id: 14, estado: 'EN_PREPARACION', mesaId: 1, mesaNumero: 1 };
const DE_OTRO_MESERO: PedidoDTO = { ...BASE, id: 11, mesaId: 2, mesaNumero: 2, meseroId: 3 };
const COBRADO: PedidoDTO = { ...BASE, id: 9, estado: 'PAGADO', mesaId: 5, mesaNumero: 5 };
const CANCELADO: PedidoDTO = { ...BASE, id: 8, estado: 'CANCELADO', mesaId: 6, mesaNumero: 6 };

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), { status });
}

function simularPedidos(responder: () => Response | Promise<Response>) {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(responder())));
}

/** Señuelo de la toma de pedido, para comprobar a dónde navega «Seguir tomando». */
function TomaSenuelo() {
  const { id } = useParams();
  return <p>Toma del pedido {id}</p>;
}

function pintar() {
  sessionStorage.setItem('kandela.sesion', JSON.stringify(MESERO));
  return render(
    <MemoryRouter initialEntries={['/salon/pedidos']}>
      <SesionProveedor>
        <Routes>
          <Route path="/salon/pedidos" element={<MisPedidos />} />
          <Route path="/salon/pedido/:id" element={<TomaSenuelo />} />
        </Routes>
      </SesionProveedor>
    </MemoryRouter>,
  );
}

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('Mis pedidos', () => {
  it('muestra solo los pedidos activos del mesero en sesion', async () => {
    simularPedidos(() => json([BASE, EN_PREPARACION, DE_OTRO_MESERO, COBRADO, CANCELADO]));
    pintar();

    expect(await screen.findByText('Mesa 3')).toBeInTheDocument();
    expect(screen.getByText('Mesa 1')).toBeInTheDocument();
    expect(screen.queryByText('Mesa 2')).not.toBeInTheDocument();
    expect(screen.queryByText('Mesa 5')).not.toBeInTheDocument();
    expect(screen.queryByText('Mesa 6')).not.toBeInTheDocument();
  });

  it('cuenta los activos en el parentesis del titulo', async () => {
    simularPedidos(() => json([BASE, EN_PREPARACION, COBRADO]));
    pintar();

    expect(await screen.findByText(/2 activos/)).toBeInTheDocument();
  });

  it('dice activo en singular cuando solo hay uno', async () => {
    simularPedidos(() => json([BASE]));
    pintar();

    expect(await screen.findByText(/1 activo\)/)).toBeInTheDocument();
  });

  it('ofrece seguir tomando solo en el pedido sin enviar a cocina', async () => {
    simularPedidos(() => json([BASE, EN_PREPARACION]));
    pintar();

    await screen.findByText('Mesa 3');
    expect(screen.getAllByRole('button', { name: 'Seguir tomando' })).toHaveLength(1);
  });

  it('seguir tomando lleva a la toma de ese pedido', async () => {
    simularPedidos(() => json([BASE]));
    pintar();

    fireEvent.click(await screen.findByRole('button', { name: 'Seguir tomando' }));

    expect(await screen.findByText('Toma del pedido 12')).toBeInTheDocument();
  });

  it('avisa cuando el mesero no tiene pedidos', async () => {
    simularPedidos(() => json([COBRADO]));
    pintar();

    expect(await screen.findByText(/Sin pedidos/)).toBeInTheDocument();
  });

  it('ofrece reintentar cuando el servicio no responde', async () => {
    simularPedidos(() => json({ error: 'El servicio no está disponible.' }, 503));
    pintar();

    expect(await screen.findByRole('button', { name: 'Reintentar' })).toBeInTheDocument();

    simularPedidos(() => json([BASE]));
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }));

    await waitFor(() => expect(screen.getByText('Mesa 3')).toBeInTheDocument());
  });
});
