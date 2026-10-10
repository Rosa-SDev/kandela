import { useRef, type ReactNode } from 'react';
import { useCapaFlotante } from './capaFlotante';
import { Titulo } from './Titulo';

export interface DrawerProps {
  titulo: string;
  par?: string;
  cuerpo: ReactNode;
  pieIzq?: ReactNode;
  pieDer?: ReactNode;
  onCerrar: () => void;
}

export function Drawer({ titulo, par, cuerpo, pieIzq, pieDer, onCerrar }: DrawerProps) {
  const contenedorRef = useRef<HTMLDivElement>(null);

  useCapaFlotante(contenedorRef, onCerrar, () => {
    const contenedor = contenedorRef.current;
    if (!contenedor) return null;
    return (
      contenedor.querySelector<HTMLElement>('[aria-invalid="true"]') ??
      contenedor.querySelector<HTMLElement>('input, select, textarea, .f-seg button')
    );
  });

  return (
    <div className="f-velo">
      <section ref={contenedorRef} className="f-drawer" role="dialog" aria-modal="true" aria-label={titulo}>
        <header className="f-drawer__cab">
          <Titulo texto={titulo} par={par} nivel={2} />
          <button type="button" className="f-cerrar" onClick={onCerrar} aria-label="Cerrar">
            ×
          </button>
        </header>
        <div className="f-drawer__cuerpo">{cuerpo}</div>
        <footer className="f-drawer__pie">
          {pieIzq}
          <span className="der">{pieDer}</span>
        </footer>
      </section>
    </div>
  );
}
