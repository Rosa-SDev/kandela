import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import type { EstadoReserva, ReservaDTO } from '@compartido/api/tipos';
import { Boton } from '../componentes/Boton';
import { FilaReserva } from './FilaReserva';
import { fechaCorta } from './estadoReserva';

/** Una reserva escrita como la manda el backend, con el estado que se pida. */
function reserva(estado: EstadoReserva, extra: Partial<ReservaDTO> = {}): ReservaDTO {
  return {
    id: 1,
    fechaHora: '2026-10-14T19:00:00',
    numPersonas: 4,
    estado,
    clienteId: 1,
    clienteNombre: 'Ana Torres',
    mesaId: 2,
    meseroId: 2,
    ...extra,
  };
}

describe('la fila de la reserva', () => {
  it('dice cuando es, de quien y para cuantos', () => {
    render(<FilaReserva reserva={reserva('PENDIENTE')} mesaNumero={2} />);

    expect(screen.getByText(/14 oct · 19:00/)).toBeInTheDocument();
    expect(screen.getByText('Ana Torres')).toBeInTheDocument();
    expect(screen.getByText('4 personas')).toBeInTheDocument();
    expect(screen.getByText('Mesa 2')).toBeInTheDocument();
  });

  it('nombra el numero de la mesa, no su identificador', () => {
    render(<FilaReserva reserva={reserva('PENDIENTE', { mesaId: 7 })} mesaNumero={3} />);

    expect(screen.getByText('Mesa 3')).toBeInTheDocument();
    expect(screen.queryByText('Mesa 7')).not.toBeInTheDocument();
  });

  it('avisa cuando la reserva no tiene mesa', () => {
    render(<FilaReserva reserva={reserva('PENDIENTE', { mesaId: null })} />);

    expect(screen.getByText('Sin mesa asignada')).toBeInTheDocument();
  });

  it('muestra el estado con su glifo', () => {
    const { rerender } = render(<FilaReserva reserva={reserva('PENDIENTE')} />);
    expect(screen.getByText('Pendiente')).toBeInTheDocument();

    rerender(<FilaReserva reserva={reserva('CONFIRMADA')} />);
    expect(screen.getByText('Confirmada')).toBeInTheDocument();

    rerender(<FilaReserva reserva={reserva('CUMPLIDA')} />);
    expect(screen.getByText('Cumplida')).toBeInTheDocument();

    rerender(<FilaReserva reserva={reserva('CANCELADA')} />);
    expect(screen.getByText('Cancelada')).toBeInTheDocument();
  });

  it('atenua las reservas cerradas y deja vivas las vigentes', () => {
    const { container, rerender } = render(<FilaReserva reserva={reserva('CONFIRMADA')} />);
    expect(container.querySelector('.f-fila')).not.toHaveClass('f-fila--apagada');

    rerender(<FilaReserva reserva={reserva('CUMPLIDA')} />);
    expect(container.querySelector('.f-fila')).toHaveClass('f-fila--apagada');

    rerender(<FilaReserva reserva={reserva('CANCELADA')} />);
    expect(container.querySelector('.f-fila')).toHaveClass('f-fila--apagada');
  });

  it('coloca las acciones que le entreguen', () => {
    render(
      <FilaReserva reserva={reserva('PENDIENTE')} acciones={<Boton texto="Confirmar" />} />,
    );

    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeInTheDocument();
  });
});

describe('la fecha de la reserva', () => {
  it('dice Hoy cuando es del mismo dia', () => {
    const hoy = new Date('2026-10-12T20:30:00');
    expect(fechaCorta('2026-10-12T19:00:00', hoy)).toBe('Hoy');
  });

  it('escribe el dia y el mes cuando es otro dia', () => {
    const hoy = new Date('2026-10-12T20:30:00');
    expect(fechaCorta('2026-10-14T19:00:00', hoy)).toBe('14 oct');
    expect(fechaCorta('2026-11-02T13:00:00', hoy)).toBe('2 nov');
  });
});
