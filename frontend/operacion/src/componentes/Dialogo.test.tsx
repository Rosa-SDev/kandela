import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dialogo } from './Dialogo';
import { Drawer } from './Drawer';

describe('Dialogo', () => {
  it('al abrir, el foco cae siempre en Volver', () => {
    render(
      <Dialogo
        tipo="Acción irreversible"
        titulo="¿Eliminar la mesa 3?"
        confirmar={<button>Eliminar</button>}
        onCerrar={() => {}}
      />,
    );
    expect(screen.getByText('Volver')).toHaveFocus();
  });

  it('Escape llama a onCerrar', () => {
    const onCerrar = vi.fn();
    render(<Dialogo tipo="Eliminar" titulo="¿Eliminar la mesa 3?" onCerrar={onCerrar} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it('con error, no se muestra el boton de confirmar', () => {
    render(
      <Dialogo
        tipo="Acción irreversible"
        titulo="¿Eliminar la mesa 3?"
        confirmar={<button>Eliminar</button>}
        error={{ t: 'No se pudo eliminar', x: 'La mesa tiene un pedido abierto.' }}
        onCerrar={() => {}}
      />,
    );
    expect(screen.queryByText('Eliminar')).not.toBeInTheDocument();
  });

  it('con un Dialogo abierto sobre un Drawer, Escape cierra solo el Dialogo', () => {
    const cerrarDrawer = vi.fn();
    const cerrarDialogo = vi.fn();
    render(
      <>
        <Drawer titulo="Nueva reserva" cuerpo={<input aria-label="Cliente" />} onCerrar={cerrarDrawer} />
        <Dialogo tipo="Acción irreversible" titulo="¿Cancelar la reserva?" onCerrar={cerrarDialogo} />
      </>,
    );
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(cerrarDialogo).toHaveBeenCalledTimes(1);
    expect(cerrarDrawer).not.toHaveBeenCalled();
  });
});
