import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { CrearMesa, MesaDTO } from '@compartido/api/tipos';
import { ApiService } from '../../nucleo/api.service';

/**
 * Las mesas del salón, tal como las expone el servicio de salón.
 *
 * El cuerpo que se envía no lleva el estado: lo lleva el salón según lo que
 * pase encima de la mesa —si hay un pedido abierto o no— y administración no
 * tiene por qué decidirlo al crear ni al editar.
 */
@Injectable({
  providedIn: 'root'
})
export class MesasService {
  private api = inject(ApiService);
  private readonly RUTA = '/api/mesas';

  listar(): Observable<MesaDTO[]> {
    return this.api.get<MesaDTO[]>(this.RUTA);
  }

  crear(datos: CrearMesa): Observable<MesaDTO> {
    return this.api.post<MesaDTO>(this.RUTA, datos);
  }

  actualizar(id: number, datos: CrearMesa): Observable<MesaDTO> {
    return this.api.put<MesaDTO>(`${this.RUTA}/${id}`, datos);
  }

  eliminar(id: number): Observable<void> {
    return this.api.delete<void>(`${this.RUTA}/${id}`);
  }
}
