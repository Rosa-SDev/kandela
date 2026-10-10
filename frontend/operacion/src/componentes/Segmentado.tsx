export interface SegmentadoProps {
  opciones: string[];
  activa: string;
  onCambiar: (opcion: string) => void;
  label: string;
}

export function Segmentado({ opciones, activa, onCambiar, label }: SegmentadoProps) {
  return (
    <div className="f-seg" role="group" aria-label={label}>
      {opciones.map((opcion) => (
        <button
          key={opcion}
          type="button"
          aria-pressed={opcion === activa}
          onClick={() => onCambiar(opcion)}
        >
          {opcion}
        </button>
      ))}
    </div>
  );
}
