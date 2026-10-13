import { Component, computed, input } from '@angular/core';
import { PedidoDTO } from '@compartido/api/tipos';
import { EstadoComponent } from '../../componentes/estado.component';
import { hora } from '../mesas/estado-de-mesa';
import { ETIQUETA_PEDIDO, agruparLineas, dinero, platillos } from './estado-de-pedido';

/**
 * La comanda del pedido, en lectura.
 *
 * Es el mismo objeto de papel que el mesero y la cocina tienen en sus
 * pantallas, aquí solo para consultarlo: administración no agrega platillos ni
 * cambia cantidades.
 *
 * Las líneas llegan una por unidad y se agrupan para no repetir tres veces la
 * misma bandeja. La nota del pedido se muestra entera, porque es donde van las
 * alergias y lo que la cocina tiene que saber.
 */
@Component({
  selector: 'app-comanda',
  standalone: true,
  imports: [EstadoComponent],
  templateUrl: './comanda.component.html'
})
export class ComandaComponent {
  pedido = input.required<PedidoDTO>();

  lineas = computed(() => agruparLineas(this.pedido().platillos));
  etiqueta = computed(() => ETIQUETA_PEDIDO[this.pedido().estado]);
  resumen = computed(() => platillos(this.pedido().platillos.length));
  total = computed(() => dinero(this.pedido().total));

  /** La hora solo se muestra cuando el pedido ya salió a cocina. */
  horaDeEnvio = computed(() =>
    this.pedido().estado === 'ABIERTO' ? null : hora(this.pedido().fechaHora)
  );

  importe(valor: number): string {
    return dinero(valor);
  }
}
