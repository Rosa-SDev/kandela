export interface TituloProps {
  texto: string;
  par?: string;
  nivel?: 1 | 2 | 3;
}

export function Titulo({ texto, par, nivel = 1 }: TituloProps) {
  const Etiqueta = `h${nivel}` as 'h1' | 'h2' | 'h3';
  return (
    <Etiqueta className="f-titulo">
      {texto}
      {par ? <span className="f-par"> ({par})</span> : null}
    </Etiqueta>
  );
}
