import { useState } from 'react';
import { useNavigate } from 'react-router';
import { BarraRol } from '../componentes/BarraRol';
import { useSesion } from '../nucleo/sesion';
import { Caja } from './Caja';
import { Facturas } from './Facturas';

/**
 * La interfaz de la cajera: táctil y sobre arcilla, igual que el salón.
 */
export function CajaShell() {
  const { usuario, cerrar } = useSesion();
  const navegar = useNavigate();
  const [tab, setTab] = useState<'caja' | 'facturas'>('caja');

  function salir() {
    cerrar();
    navegar('/login', { replace: true });
  }

  return (
    <div className="sh" data-densidad="tactil" data-superficie="arcilla">
      <BarraRol
        tabs={['Caja', 'Facturas']}
        activa={tab === 'caja' ? 0 : 1}
        onCambiarTab={(indice) => setTab(indice === 0 ? 'caja' : 'facturas')}
        quien={
          <>
            Cajera · <b>{usuario?.nombre}</b>
          </>
        }
        onSalir={salir}
      />
      {tab === 'caja' ? <Caja /> : <Facturas />}
    </div>
  );
}
