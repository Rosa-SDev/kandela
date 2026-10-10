export interface EstadoProps {
  glifo: string;
  texto: string;
  tono?: 'ate' | 'err' | 'off' | '';
}

export function Estado({ glifo, texto, tono = '' }: EstadoProps) {
  return (
    <span className={`f-estado${tono ? ' f-estado--' + tono : ''}`}>
      <i aria-hidden="true">{glifo}</i>
      {texto}
    </span>
  );
}
