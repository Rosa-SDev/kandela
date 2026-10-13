import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Drawer } from './Drawer';

function DrawerDeEjemplo({ onCerrar }: { onCerrar: () => void }) {
  return (
    <Drawer
      titulo="Nueva reserva"
      cuerpo={
        <>
          <input aria-label="Cliente" />
          <input aria-label="Personas" />
        </>
      }
      pieDer={<button>Guardar</button>}
      onCerrar={onCerrar}
    />
  );
}

describe('Drawer', () => {
  it('al abrir, el foco cae en el primer control', () => {
    render(<DrawerDeEjemplo onCerrar={() => {}} />);
    expect(screen.getByLabelText('Cliente')).toHaveFocus();
  });

  it('el foco cae en el primer campo invalido si lo hay', () => {
    render(
      <Drawer
        titulo="Nueva reserva"
        cuerpo={
          <>
            <input aria-label="Cliente" />
            <input aria-label="Personas" aria-invalid="true" />
          </>
        }
        onCerrar={() => {}}
      />,
    );
    expect(screen.getByLabelText('Personas')).toHaveFocus();
  });

  it('Escape llama a onCerrar', () => {
    const onCerrar = vi.fn();
    render(<DrawerDeEjemplo onCerrar={onCerrar} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('Tab desde el ultimo elemento enfocable vuelve al primero', () => {
    render(<DrawerDeEjemplo onCerrar={() => {}} />);
    const guardar = screen.getByText('Guardar');
    guardar.focus();
    fireEvent.keyDown(guardar, { key: 'Tab' });
    expect(screen.getByLabelText('Cerrar')).toHaveFocus();
  });

  it('al cerrar, el foco vuelve al elemento que abrio el drawer', () => {
    function Contenedor() {
      const [abierto, setAbierto] = useState(false);
      return (
        <>
          <button onClick={() => setAbierto(true)}>Abrir</button>
          {abierto && <DrawerDeEjemplo onCerrar={() => setAbierto(false)} />}
        </>
      );
    }
    render(<Contenedor />);
    const abrir = screen.getByText('Abrir');
    abrir.focus();
    fireEvent.click(abrir);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(abrir).toHaveFocus();
  });
});
