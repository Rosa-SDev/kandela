import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SesionProveedor } from '../nucleo/sesion';
import { SalonShell } from './SalonShell';

const MESERO = {
  id: 2,
  nombre: 'Carlos Rojas',
  correo: 'carlos.rojas@raizysazon.co',
  rol: 'MESERO',
  activo: true,
};

function pintar(desde: string) {
  sessionStorage.setItem('kandela.sesion', JSON.stringify(MESERO));
  return render(
    <MemoryRouter initialEntries={[desde]}>
      <SesionProveedor>
        <Routes>
          {/* La misma ruta padre que monta App: las rutas del shell son relativas. */}
          <Route path="/salon/*" element={<SalonShell />} />
        </Routes>
      </SesionProveedor>
    </MemoryRouter>,
  );
}

/** Las dos barras se llaman igual; se distinguen por su clase. */
function barraDeArriba(): HTMLElement {
  return document.querySelector('.f-nav__tabs') as HTMLElement;
}

function barraDeAbajo(): HTMLElement {
  return document.querySelector('.f-tabbar') as HTMLElement;
}

beforeEach(() => {
  // El plano consulta tres listas al entrar; aquí solo importa la navegación.
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response('[]', { status: 200 }))));
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe('la barra del salón', () => {
  it('ofrece las secciones en el orden en que se usan', () => {
    pintar('/salon');

    const arriba = within(barraDeArriba()).getAllByRole('button');
    expect(arriba.map((boton) => boton.textContent)).toEqual(['Salón', 'Mis pedidos', 'Reservas', 'Carta']);
  });

  it('acorta los nombres en la barra inferior, que tiene menos sitio', () => {
    pintar('/salon');

    const abajo = within(barraDeAbajo()).getAllByRole('button');
    expect(abajo.map((boton) => boton.textContent)).toEqual(['Salón', 'Pedidos', 'Reservas', 'Carta']);
  });

  it('marca la seccion en la que esta el mesero', () => {
    pintar('/salon/pedidos');

    expect(within(barraDeArriba()).getByRole('button', { name: 'Mis pedidos' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('deja marcado el salon mientras se toma un pedido', () => {
    pintar('/salon/pedido/12');

    expect(within(barraDeArriba()).getByRole('button', { name: 'Salón' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('cambia de seccion al pulsar una pestaña', async () => {
    pintar('/salon');

    fireEvent.click(within(barraDeArriba()).getByRole('button', { name: 'Mis pedidos' }));

    expect(await screen.findByRole('heading', { name: /Mis pedidos/ })).toBeInTheDocument();
  });

  it('la barra inferior lleva a la misma seccion', async () => {
    pintar('/salon');

    fireEvent.click(within(barraDeAbajo()).getByRole('button', { name: 'Pedidos' }));

    expect(await screen.findByRole('heading', { name: /Mis pedidos/ })).toBeInTheDocument();
  });
});
