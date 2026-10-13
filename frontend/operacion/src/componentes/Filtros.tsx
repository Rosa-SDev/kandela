export interface FiltrosProps {
  items: Array<[id: string, texto: string, cantidad: number]>;
  activo: string;
  onCambiar: (id: string) => void;
}

export function Filtros({ items, activo, onCambiar }: FiltrosProps) {
  return (
    <div className="f-filtros" role="group" aria-label="Filtrar">
      {items.map(([id, texto, cantidad]) => (
        <button key={id} type="button" aria-pressed={id === activo} onClick={() => onCambiar(id)}>
          <span>
            {texto} ({cantidad})
          </span>
        </button>
      ))}
    </div>
  );
}
