import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { PedidoDTO } from '@compartido/api/tipos';
import { ApiService } from '../../nucleo/api.service';

/**
 * Los pedidos del salón, tal como los expone el servicio de salón.
 *
 * Administración solo consulta y cancela: los pedidos se abren en el salón, a
 * nombre de un mesero, y no tendría sentido crearlos desde aquí.
 */
@Injectable({
  providedIn: 'root'
})
export class PedidosService {
  private api = inject(ApiService);
  private readonly RUTA = '/api/pedidos';

  listar(): Observable<PedidoDTO[]> {
    return this.api.get<PedidoDTO[]>(this.RUTA);
  }

  /**
   * Cancela el pedido.
   *
   * La mesa la libera el salón al cancelar; esta pantalla no tiene que
   * acordarse de hacerlo aparte.
   */
  cancelar(id: number): Observable<PedidoDTO> {
    return this.api.patch<PedidoDTO>(`${this.RUTA}/${id}/estado`, { estado: 'CANCELADO' });
  }
}
