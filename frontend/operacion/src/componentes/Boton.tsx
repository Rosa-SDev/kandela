import type { ReactNode } from 'react';

type Variante = 'calor' | 'tinta' | 'texto' | 'baja' | 'texto-baja';

export interface BotonProps {
  texto: ReactNode;
  variante?: Variante;
  tipo?: 'button' | 'submit';
  ancho?: boolean;
  disabled?: boolean;
  label?: string;
  onClick?: () => void;
}

export function Boton({
  texto,
  variante = 'tinta',
  tipo = 'button',
  ancho = false,
  disabled = false,
  label,
  onClick,
}: BotonProps) {
  return (
    <button
      type={tipo}
      className={`f-btn f-btn--${variante}${ancho ? ' f-btn--ancho' : ''}`}
      disabled={disabled}
      aria-label={label}
      onClick={onClick}
    >
      {texto}
    </button>
  );
}
