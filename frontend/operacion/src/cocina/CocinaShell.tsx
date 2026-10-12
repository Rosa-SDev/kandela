import { useState } from 'react';
import { useSesion } from '../nucleo/sesion';
import { BarraRol } from '../componentes/BarraRol';
import { TableroCocina } from './TableroCocina';
import { DisponibilidadCocina } from './DisponibilidadCocina';

export function CocinaShell() {
  const [tab, setTab] = useState<'cocina' | 'disponibilidad'>('cocina');
  const { cerrar } = useSesion();

  return (
    <div className="sh" data-densidad="pared" data-superficie="tablero">
      <BarraRol
        tabs={['Cocina', 'Disponibilidad']}
        activa={tab === 'cocina' ? 0 : 1}
        quien={<>Estación <b>central</b></>}
        onCambiarTab={(indice) => setTab(indice === 0 ? 'cocina' : 'disponibilidad')}
        onSalir={cerrar}
      />
      {tab === 'cocina' ? <TableroCocina /> : <DisponibilidadCocina />}
    </div>
  );
}
