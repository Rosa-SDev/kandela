export interface BarraInferiorProps {
  tabs: string[];
  activa: number;
  onCambiar?: (indice: number) => void;
}

export function BarraInferior({ tabs, activa, onCambiar }: BarraInferiorProps) {
  return (
    <nav className="f-tabbar" aria-label="Secciones">
      {tabs.map((tab, indice) => (
        <button
          key={tab}
          type="button"
          aria-current={indice === activa ? 'page' : undefined}
          onClick={() => onCambiar?.(indice)}
        >
          {tab}
        </button>
      ))}
    </nav>
  );
}
