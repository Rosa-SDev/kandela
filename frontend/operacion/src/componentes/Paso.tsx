export interface PasoProps {
  valor: number;
  nombre: string;
  onMenos: () => void;
  onMas: () => void;
  disabledMenos?: boolean;
  disabledMas?: boolean;
}

export function Paso({ valor, nombre, onMenos, onMas, disabledMenos = false, disabledMas = false }: PasoProps) {
  return (
    <span className="f-paso" role="group" aria-label={`Cantidad de ${nombre}`}>
      <button type="button" onClick={onMenos} disabled={disabledMenos} aria-label="Quitar uno">
        −
      </button>
      <output aria-live="polite">{valor}</output>
      <button type="button" onClick={onMas} disabled={disabledMas} aria-label="Agregar uno">
        +
      </button>
    </span>
  );
}
