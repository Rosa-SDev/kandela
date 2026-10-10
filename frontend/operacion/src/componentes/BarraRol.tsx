import type { ReactNode } from 'react';

export interface BarraRolProps {
  tabs: string[];
  activa: number;
  quien: ReactNode;
  onCambiarTab?: (indice: number) => void;
  salir?: boolean;
  onSalir?: () => void;
}

export function BarraRol({ tabs, activa, quien, onCambiarTab, salir = true, onSalir }: BarraRolProps) {
  return (
    <header className="f-nav">
      <span className="f-nav__logo">KANDELA</span>
      <nav className="f-nav__tabs" aria-label="Secciones">
        {tabs.map((tab, indice) =>
          onCambiarTab ? (
            <button
              key={tab}
              type="button"
              aria-current={indice === activa ? 'page' : undefined}
              onClick={() => onCambiarTab(indice)}
            >
              {tab}
            </button>
          ) : (
            <span key={tab} aria-current={indice === activa ? 'page' : undefined}>
              {tab}
            </span>
          ),
        )}
      </nav>
      <span className="f-nav__quien">
        {quien}
        {salir ? (
          <>
            {' · '}
            <button type="button" onClick={onSalir}>
              Salir
            </button>
          </>
        ) : null}
      </span>
    </header>
  );
}
