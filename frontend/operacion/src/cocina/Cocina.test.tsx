import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { PedidoDTO, PlatilloDTO } from '@compartido/api/tipos';
import { SesionProveedor } from '../nucleo/sesion';
import { CocinaShell } from './CocinaShell';
import { TableroCocina } from './TableroCocina';
import { DisponibilidadCocina } from './DisponibilidadCocina';

const COCINERO = {
  id: 4,
  nombre: 'Jorge Castaño',
  correo: 'jorge.castano@raizysazon.co',
  rol: 'COCINERO',
  activo: true,
};

const PEDIDO_NUEVO: PedidoDTO = {
  id: 101,
  fechaHora: '2026-10-12T12:00:00',
  estado: 'EN_COCINA',
  observaciones: 'Sin cebolla',
  metodoPago: null,
  montoPagado: null,
  fechaPago: null,
  mesaId: 2,
  mesaNumero: 2,
  meseroId: 2,
  cocineroId: null,
  clienteId: null,
  platillos: [{ id: 1, platilloId: 1, nombre: 'Ajiaco santafereño', precioUnitario: 28000 }],
  total: 28000,
};

const PEDIDO_PREPARACION: PedidoDTO = {
  id: 102,
  fechaHora: '2026-10-12T12:05:00',
  estado: 'EN_PREPARACION',
  observaciones: null,
  metodoPago: null,
  montoPagado: null,
  fechaPago: null,
  mesaId: 3,
  mesaNumero: 3,
  meseroId: 2,
  cocineroId: 4,
  clienteId: null,
  platillos: [{ id: 2, platilloId: 2, nombre: 'Bandeja paisa', precioUnitario: 38000 }],
  total: 38000,
};

const PLATILLOS_INICIALES: PlatilloDTO[] = [
  {
    id: 1,
    nombre: 'Ajiaco santafereño',
    descripcion: 'Con pollo y alcaparras',
    categoria: 'Fuertes',
    precio: 28000,
    disponible: true,
  },
  {
    id: 2,
    nombre: 'Limonada de coco',
    descripcion: 'Bebida fría',
    categoria: 'Bebidas',
    precio: 11000,
    disponible: false,
  },
];

function json(cuerpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('Cocina KDS', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  describe('TableroCocina', () => {
    it('muestra los pedidos clasificados en Nuevos y En preparación', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (url === '/api/pedidos') {
            return Promise.resolve(json([PEDIDO_NUEVO, PEDIDO_PREPARACION]));
          }
          throw new Error(`Ruta no esperada: ${url}`);
        }),
      );

      render(<TableroCocina />);

      expect(await screen.findByText('Mesa 2')).toBeInTheDocument();
      expect(screen.getByText('Mesa 3')).toBeInTheDocument();
      expect(screen.getByText('Empezar')).toBeInTheDocument();
      expect(screen.getByText('Listo para servir')).toBeInTheDocument();
    });

    it('permite avanzar un pedido de EN_COCINA a EN_PREPARACION con Empezar', async () => {
      let patchLlamado = false;
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, opciones?: RequestInit) => {
          if (url === '/api/pedidos') {
            return Promise.resolve(json([PEDIDO_NUEVO]));
          }
          if (url === '/api/pedidos/101/estado' && opciones?.method === 'PATCH') {
            patchLlamado = true;
            return Promise.resolve(json({ ...PEDIDO_NUEVO, estado: 'EN_PREPARACION' }));
          }
          throw new Error(`Ruta no esperada: ${url}`);
        }),
      );

      render(<TableroCocina />);

      const btnEmpezar = await screen.findByRole('button', { name: 'Empezar' });
      fireEvent.click(btnEmpezar);

      await waitFor(() => {
        expect(patchLlamado).toBe(true);
      });
      expect(await screen.findByRole('button', { name: 'Listo para servir' })).toBeInTheDocument();
    });

    it('permite marcar un pedido como SERVIDO con Listo para servir', async () => {
      let patchLlamado = false;
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, opciones?: RequestInit) => {
          if (url === '/api/pedidos') {
            return Promise.resolve(json([PEDIDO_PREPARACION]));
          }
          if (url === '/api/pedidos/102/estado' && opciones?.method === 'PATCH') {
            patchLlamado = true;
            return Promise.resolve(json({ ...PEDIDO_PREPARACION, estado: 'SERVIDO' }));
          }
          throw new Error(`Ruta no esperada: ${url}`);
        }),
      );

      render(<TableroCocina />);

      const btnListo = await screen.findByRole('button', { name: 'Listo para servir' });
      fireEvent.click(btnListo);

      await waitFor(() => {
        expect(patchLlamado).toBe(true);
      });
      // Al ser SERVIDO, desaparece del tablero de preparación
      expect(screen.queryByText('Mesa 3')).not.toBeInTheDocument();
    });

    it('muestra aviso de error si la carga de pedidos falla', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('Network error'))),
      );

      render(<TableroCocina />);

      expect(
        await screen.findByText('No se pudo actualizar la comanda desde el salón.'),
      ).toBeInTheDocument();
    });
  });

  describe('DisponibilidadCocina', () => {
    it('lista los platillos y muestra su estado de disponibilidad', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (url === '/api/platillos') {
            return Promise.resolve(json(PLATILLOS_INICIALES));
          }
          throw new Error(`Ruta no esperada: ${url}`);
        }),
      );

      render(<DisponibilidadCocina />);

      expect(await screen.findByText('Ajiaco santafereño')).toBeInTheDocument();
      expect(screen.getByText('Limonada de coco')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Marcar agotado' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Volver a ofrecer' })).toBeInTheDocument();
      expect(screen.getByText('Agotado')).toBeInTheDocument();
    });

    it('permite marcar un platillo como agotado', async () => {
      let putLlamado = false;
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, opciones?: RequestInit) => {
          if (url === '/api/platillos') {
            return Promise.resolve(json(PLATILLOS_INICIALES));
          }
          if (url === '/api/platillos/1' && opciones?.method === 'PUT') {
            putLlamado = true;
            const cuerpo = JSON.parse(String(opciones.body));
            expect(cuerpo.disponible).toBe(false);
            return Promise.resolve(json({ ...PLATILLOS_INICIALES[0], disponible: false }));
          }
          throw new Error(`Ruta no esperada: ${url}`);
        }),
      );

      render(<DisponibilidadCocina />);

      const btnAgotar = await screen.findByRole('button', { name: 'Marcar agotado' });
      fireEvent.click(btnAgotar);

      await waitFor(() => {
        expect(putLlamado).toBe(true);
      });
      expect(
        await screen.findByText(/Ajiaco santafereño: agotado/i),
      ).toBeInTheDocument();
    });

    it('permite volver a ofrecer un platillo agotado', async () => {
      let putLlamado = false;
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, opciones?: RequestInit) => {
          if (url === '/api/platillos') {
            return Promise.resolve(json(PLATILLOS_INICIALES));
          }
          if (url === '/api/platillos/2' && opciones?.method === 'PUT') {
            putLlamado = true;
            const cuerpo = JSON.parse(String(opciones.body));
            expect(cuerpo.disponible).toBe(true);
            return Promise.resolve(json({ ...PLATILLOS_INICIALES[1], disponible: true }));
          }
          throw new Error(`Ruta no esperada: ${url}`);
        }),
      );

      render(<DisponibilidadCocina />);

      const btnOfrecer = await screen.findByRole('button', { name: 'Volver a ofrecer' });
      fireEvent.click(btnOfrecer);

      await waitFor(() => {
        expect(putLlamado).toBe(true);
      });
      expect(
        await screen.findByText(/Limonada de coco: disponible de nuevo/i),
      ).toBeInTheDocument();
    });

    it('muestra error 503 cuando el servicio de carta no responde', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.reject(new Error('503 Service Unavailable'))),
      );

      render(<DisponibilidadCocina />);

      expect(
        await screen.findByText('El servicio de carta no está disponible en este momento.'),
      ).toBeInTheDocument();
    });
  });

  describe('CocinaShell', () => {
    it('alterna entre la pestaña Cocina y Disponibilidad', async () => {
      sessionStorage.setItem('kandela.sesion', JSON.stringify(COCINERO));
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string) => {
          if (url === '/api/pedidos') return Promise.resolve(json([]));
          if (url === '/api/platillos') return Promise.resolve(json(PLATILLOS_INICIALES));
          throw new Error(`Ruta no esperada: ${url}`);
        }),
      );

      render(
        <MemoryRouter>
          <SesionProveedor>
            <CocinaShell />
          </SesionProveedor>
        </MemoryRouter>,
      );

      expect(await screen.findByRole('heading', { name: /cocina/i })).toBeInTheDocument();
      expect(screen.getByText(/Estación/i)).toBeInTheDocument();
      expect(screen.getByText('central')).toBeInTheDocument();

      const tabDisp = screen.getByRole('button', { name: 'Disponibilidad' });
      fireEvent.click(tabDisp);

      expect(await screen.findByRole('heading', { name: /disponibilidad/i })).toBeInTheDocument();
    });
  });
});
