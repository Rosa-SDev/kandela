import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { PlatilloDTO } from '@compartido/api/tipos';
import { Carta } from './Carta';

const CARTA: PlatilloDTO[] = [
  {
    id: 1,
    nombre: 'Arepa de choclo',
    descripcion: 'Maíz tierno asado con queso campesino',
    categoria: 'Entradas',
    precio: 9000,
    disponible: true,
  },
  {
    id: 3,
    nombre: 'Bandeja paisa',
    descripcion: 'Chicharrón, fríjoles, arroz, huevo y aguacate',
    categoria: 'Fuertes',
    precio: 38000,
    disponible: true,
  },
  {
    id: 4,
    nombre: 'Sobrebarriga al horno',
    descripcion: 'Hogao criollo, papa chorreada y yuca',
    categoria: 'Fuertes',
    precio: 36000,
    disponible: true,
  },
  {
    id: 6,
    nombre: 'Limonada de coco',
    descripcion: 'Limón, crema de coco y hielo',
    categoria: 'Bebidas',
    precio: 11000,
    disponible: false,
  },
];

describe('Carta', () => {
  it('agrupa por categoria y cuenta los platillos de cada una', () => {
    render(<Carta platillos={CARTA} />);

    expect(screen.getByRole('heading', { name: /Entradas/ })).toHaveTextContent('(1)');
    expect(screen.getByRole('heading', { name: /Fuertes/ })).toHaveTextContent('(2)');
    expect(screen.getByRole('heading', { name: /Bebidas/ })).toHaveTextContent('(1)');
  });

  it('marca cuantas unidades hay ya en la comanda', () => {
    render(<Carta platillos={CARTA} enPedido={new Map([[3, 2]])} />);

    expect(screen.getByText('2 en la comanda')).toBeInTheDocument();
  });

  it('un platillo agotado se ve pero no se puede agregar', () => {
    render(<Carta platillos={CARTA} />);

    expect(screen.getByText('Limonada de coco')).toBeInTheDocument();
    expect(screen.getByText('✕ Agotado hoy')).toBeInTheDocument();
    expect(screen.getByLabelText('Limonada de coco agotado')).toBeDisabled();
  });

  it('agregar avisa con el platillo completo', () => {
    const alAgregar = vi.fn();
    render(<Carta platillos={CARTA} onAgregar={alAgregar} />);

    fireEvent.click(screen.getByLabelText('Agregar Bandeja paisa'));

    expect(alAgregar).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));
  });

  it('con el pedido ya enviado ningun boton agrega', () => {
    render(<Carta platillos={CARTA} puedeAgregar={false} />);

    expect(screen.getByLabelText('Agregar Bandeja paisa')).toBeDisabled();
    expect(screen.getByLabelText('Agregar Arepa de choclo')).toBeDisabled();
  });

  it('la carta de consulta no trae botones de agregar', () => {
    render(<Carta platillos={CARTA} soloLectura />);

    expect(screen.queryByLabelText('Agregar Bandeja paisa')).not.toBeInTheDocument();
    expect(screen.getByText('Bandeja paisa')).toBeInTheDocument();
  });
});
