import { Fragment } from 'react';
import type { PlatilloDTO } from '@compartido/api/tipos';
import { LineaCarta } from './LineaCarta';

export interface CartaProps {
  platillos: PlatilloDTO[];
  /** Unidades que ya hay en la comanda, por identificador de platillo. */
  enPedido?: Map<number, number>;
  puedeAgregar?: boolean;
  soloLectura?: boolean;
  onAgregar?: (platillo: PlatilloDTO) => void;
}

/**
 * La carta del restaurante, agrupada por categoría.
 *
 * El orden de las categorías es el que trae la carta, no uno alfabético: el
 * menú se lee de la entrada al postre, y ese orden lo decide quien administra
 * la carta.
 */
export function Carta({
  platillos,
  enPedido,
  puedeAgregar = true,
  soloLectura = false,
  onAgregar,
}: CartaProps) {
  const categorias = [...new Set(platillos.map((platillo) => platillo.categoria))];

  return (
    <section className="f-carta papel" aria-label="Carta">
      {categorias.map((categoria) => {
        const suyos = platillos.filter((platillo) => platillo.categoria === categoria);
        return (
          // Fragment y no un div: el titulo y los platos tienen que seguir
          // siendo hijos directos de .f-carta, porque la hoja de estilos quita
          // el margen superior solo al primer titulo.
          <Fragment key={categoria}>
            <h3>
              {categoria} <span>({suyos.length})</span>
            </h3>
            {suyos.map((platillo) => (
              <LineaCarta
                key={platillo.id}
                platillo={platillo}
                enPedido={enPedido?.get(platillo.id) ?? 0}
                puedeAgregar={puedeAgregar}
                soloLectura={soloLectura}
                onAgregar={onAgregar}
              />
            ))}
          </Fragment>
        );
      })}
    </section>
  );
}
