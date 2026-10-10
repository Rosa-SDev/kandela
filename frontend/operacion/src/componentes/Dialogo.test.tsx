import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Dialogo } from './Dialogo';

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
});
