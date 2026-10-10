export interface CampoProps {
  id: string;
  label: string;
  tipo?: 'text' | 'email' | 'password' | 'number' | 'date' | 'time' | 'select' | 'textarea';
  valor: string;
  onCambiar: (valor: string) => void;
  req?: boolean;
  error?: string;
  ayuda?: string;
  opciones?: Array<[valor: string, texto: string]>;
  autoComplete?: string;
}

export function Campo({
  id,
  label,
  tipo = 'text',
  valor,
  onCambiar,
  req = false,
  error,
  ayuda,
  opciones = [],
  autoComplete,
}: CampoProps) {
  const idMensaje = `${id}-m`;
  const describedBy = error || ayuda ? idMensaje : undefined;

  let control;
  if (tipo === 'select') {
    control = (
      <select
        id={id}
        value={valor}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        onChange={(evento) => onCambiar(evento.target.value)}
      >
        {opciones.map(([v, t]) => (
          <option key={v} value={v}>
            {t}
          </option>
        ))}
      </select>
    );
  } else if (tipo === 'textarea') {
    control = (
      <textarea
        id={id}
        value={valor}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        onChange={(evento) => onCambiar(evento.target.value)}
      />
    );
  } else {
    control = (
      <input
        id={id}
        type={tipo}
        value={valor}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        autoComplete={autoComplete}
        onChange={(evento) => onCambiar(evento.target.value)}
      />
    );
  }

  return (
    <div className={`f-campo${error ? ' f-campo--error' : ''}`}>
      <label htmlFor={id}>
        {label}
        {req ? <i aria-hidden="true"> *</i> : null}
      </label>
      {control}
      {error ? (
        <span className="f-campo__error" id={idMensaje}>
          ! {error}
        </span>
      ) : ayuda ? (
        <span className="f-campo__ayuda" id={idMensaje}>
          {ayuda}
        </span>
      ) : null}
    </div>
  );
}
