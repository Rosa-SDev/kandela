import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { LineaPedidoDTO, PedidoDTO } from '@compartido/api/tipos';
import { Comanda } from './Comanda';

const CREADO = '2026-10-11T16:55:00';
const CREADO_MS = new Date(CREADO).getTime();
const UN_MINUTO = 60_000;

function linea(id: number, platilloId: number, nombre: string, precio: number): LineaPedidoDTO {
  return { id, platilloId, nombre, precioUnitario: precio };
}

function pedido(ajustes: Partial<PedidoDTO> = {}): PedidoDTO {
  const platillos = ajustes.platillos ?? [
    linea(1, 3, 'Bandeja paisa', 38000),
    linea(2, 3, 'Bandeja paisa', 38000),
    linea(3, 2, 'Ajiaco santafereño', 28000),
  ];
  return {
    id: 12,
    fechaHora: CREADO,
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
    total: platillos.reduce((suma, l) => suma + l.precioUnitario, 0),
    ...ajustes,
    platillos,
  };
}

describe('Comanda', () => {
  it('agrupa las unidades del mismo platillo en una sola fila', () => {
    render(<Comanda pedido={pedido()} variante="lectura" />);

    expect(screen.getByText('2×')).toBeInTheDocument();
    expect(screen.getByText('Bandeja paisa')).toBeInTheDocument();
    expect(screen.getByText('$ 76.000')).toBeInTheDocument();
    expect(screen.getByText('3 platillos · sin impuestos')).toBeInTheDocument();
  });

  it('la banda dice el numero de la mesa, no su identificador', () => {
    render(<Comanda pedido={pedido({ mesaId: 41, mesaNumero: 3 })} variante="lectura" />);

    expect(screen.getByText('Mesa 3')).toBeInTheDocument();
    expect(screen.queryByText('Mesa 41')).not.toBeInTheDocument();
  });

  it('la variante editable trae el paso de cantidad y la nota escribible', () => {
    render(<Comanda pedido={pedido()} variante="editable" />);

    expect(screen.getByLabelText('Cantidad de Bandeja paisa')).toBeInTheDocument();
    expect(screen.getByLabelText('Nota para cocina')).toHaveValue('Ajiaco sin alcaparras.');
  });

  it('la variante bloqueada explica por que ya no se puede agregar', () => {
    render(<Comanda pedido={pedido({ estado: 'EN_COCINA' })} variante="bloqueada" />);

    expect(
      screen.getByText('Comanda enviada a cocina: ya no se pueden agregar platillos.'),
    ).toBeInTheDocument();
    expect(screen.queryByLabelText('Cantidad de Bandeja paisa')).not.toBeInTheDocument();
    expect(screen.getByText('En cocina')).toBeInTheDocument();
  });

  it('un pedido cobrado lo dice con su propio texto', () => {
    render(<Comanda pedido={pedido({ estado: 'PAGADO' })} variante="bloqueada" />);

    expect(
      screen.getByText('Pedido cobrado: ya no se pueden agregar platillos.'),
    ).toBeInTheDocument();
  });

  it('la variante pared no muestra precios ni suma', () => {
    render(<Comanda pedido={pedido({ estado: 'EN_COCINA' })} variante="pared" ahora={CREADO_MS} />);

    expect(screen.getByText('Bandeja paisa')).toBeInTheDocument();
    expect(screen.queryByText('$ 76.000')).not.toBeInTheDocument();
    expect(screen.queryByText(/sin impuestos/)).not.toBeInTheDocument();
  });

  it('la variante pared muestra el mesero solo si se lo pasan', () => {
    const { rerender } = render(
      <Comanda pedido={pedido()} variante="pared" ahora={CREADO_MS} />,
    );
    expect(screen.queryByText('Carlos Rojas')).not.toBeInTheDocument();

    rerender(
      <Comanda pedido={pedido()} variante="pared" ahora={CREADO_MS} meseroNombre="Carlos Rojas" />,
    );
    expect(screen.getByText('Carlos Rojas')).toBeInTheDocument();
  });

  describe('reloj de la variante pared', () => {
    function relojCon(minutos: number, segundos = 0) {
      render(
        <Comanda
          pedido={pedido({ estado: 'EN_COCINA' })}
          variante="pared"
          ahora={CREADO_MS + minutos * UN_MINUTO + segundos * 1000}
        />,
      );
      return screen.getByLabelText('Tiempo desde que llegó');
    }

    it('antes de los 10 minutos no alerta', () => {
      const tiempo = relojCon(9, 59);
      expect(tiempo).toHaveTextContent('09:59');
      expect(tiempo.className).toBe('f-tiempo');
    });

    it('a los 10 minutos pasa a ambar', () => {
      const tiempo = relojCon(10);
      expect(tiempo).toHaveTextContent('10:00');
      expect(tiempo.className).toBe('f-tiempo f-tiempo--ate');
    });

    it('a los 15 minutos pasa a rojo', () => {
      const tiempo = relojCon(15);
      expect(tiempo).toHaveTextContent('15:00');
      expect(tiempo.className).toBe('f-tiempo f-tiempo--err');
    });
  });
});
