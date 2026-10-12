import type { PlatilloDTO } from '@compartido/api/tipos';
import { dinero } from '../componentes/Cifra';

export interface LineaCartaProps {
  platillo: PlatilloDTO;
  /** Cuántas unidades de este platillo hay ya en la comanda. */
  enPedido?: number;
  /** Falso cuando el pedido ya salió a cocina: el platillo se ve, pero no se agrega. */
  puedeAgregar?: boolean;
  /** En la carta de consulta no hay botón de agregar. */
  soloLectura?: boolean;
  onAgregar?: (platillo: PlatilloDTO) => void;
}

/**
 * Un plato del menú impreso: nombre, precio y el botón de agregar.
 *
 * Un platillo agotado se sigue mostrando, tachado y sin poder agregarse: el
 * mesero necesita saber que existe y que hoy no hay.
 */
export function LineaCarta({
  platillo,
  enPedido = 0,
  puedeAgregar = true,
  soloLectura = false,
  onAgregar,
}: LineaCartaProps) {
  const sePuede = platillo.disponible && puedeAgregar;

  return (
    <div
      className={`f-plato${platillo.disponible ? '' : ' f-plato--agotado'}`}
      style={soloLectura ? { gridTemplateColumns: 'minmax(0,1fr) auto' } : undefined}
    >
      <span className="f-plato__n">{platillo.nombre}</span>
      <span className="f-plato__p">{dinero(platillo.precio)}</span>

      {soloLectura ? null : (
        <button
          type="button"
          className="f-plato__add"
          disabled={!sePuede}
          aria-label={platillo.disponible ? `Agregar ${platillo.nombre}` : `${platillo.nombre} agotado`}
          onClick={() => onAgregar?.(platillo)}
        >
          +
        </button>
      )}

      <span className="f-plato__d">
        {platillo.disponible ? (
          <>
            {platillo.descripcion}
            {enPedido > 0 ? (
              <>
                {' · '}
                <b>{enPedido} en la comanda</b>
              </>
            ) : null}
          </>
        ) : (
          '✕ Agotado hoy'
        )}
      </span>
    </div>
  );
}
