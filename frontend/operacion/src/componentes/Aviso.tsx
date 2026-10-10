import type { ReactNode } from 'react';

export interface AvisoProps {
  tono?: 'err' | 'ate' | '';
  glifo?: string;
  titulo?: string;
  texto?: string;
  accion?: ReactNode;
}

export function Aviso({ tono = '', glifo, titulo, texto, accion }: AvisoProps) {
  const g = glifo ?? (tono === 'err' ? '!' : tono === 'ate' ? '◆' : '✓');
  return (
    <div className={`f-aviso${tono ? ' f-aviso--' + tono : ''}`} role={tono === 'err' ? 'alert' : 'status'}>
      <i aria-hidden="true">{g}</i>
      <span>
        {titulo ? <b>{titulo}</b> : null}
        {texto}
      </span>
      {accion}
    </div>
  );
}
