import { useRef, type ReactNode } from 'react';
import { useCapaFlotante } from './capaFlotante';
import { Boton } from './Boton';
import { Aviso } from './Aviso';

export interface DialogoProps {
  tipo: string;
  baja?: boolean;
  titulo: string;
  consecuencias?: string[];
  cuerpo?: ReactNode;
  error?: { t: string; x: string };
  confirmar?: ReactNode;
  onCerrar: () => void;
}

export function Dialogo({
  tipo,
  baja = false,
  titulo,
  consecuencias = [],
  cuerpo,
  error,
  confirmar,
  onCerrar,
}: DialogoProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);

  useCapaFlotante(
    contenedorRef,
    onCerrar,
    () => contenedorRef.current?.querySelector<HTMLElement>('.f-dialogo__pie .f-btn') ?? null,
  );

  return (
    <div className="f-velo f-velo--centro">
      <section
        ref={contenedorRef}
        className="f-dialogo papel"
        role="alertdialog"
        aria-modal="true"
        aria-label={titulo}
      >
        <span className={`f-dialogo__tipo${baja ? ' f-dialogo__tipo--baja' : ''}`}>
          {baja ? '! ' : ''}
          {tipo}
        </span>
        <h2 className="f-titulo">{titulo}</h2>
        {consecuencias.length > 0 ? (
          <ul>
            {consecuencias.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        ) : null}
        {cuerpo}
        {error ? <Aviso tono="err" titulo={error.t} texto={error.x} /> : null}
        <div className="f-dialogo__pie">
          <Boton texto="Volver" variante="tinta" onClick={onCerrar} />
          {error ? null : confirmar}
        </div>
      </section>
    </div>
  );
}
