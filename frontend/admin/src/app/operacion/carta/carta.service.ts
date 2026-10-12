import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../nucleo/api.service';
import { CrearPlatillo, PlatilloDTO } from '@compartido/api/tipos';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CartaService {
  private api = inject(ApiService);
  private readonly RUTA = '/api/platillos';

  listar(categoria?: string): Observable<PlatilloDTO[]> {
    const query = categoria && categoria !== 'todas' && categoria !== 'Todas' 
      ? `?categoria=${encodeURIComponent(categoria)}` 
      : '';
    return this.api.get<PlatilloDTO[]>(`${this.RUTA}${query}`);
  }

  buscarPorId(id: number): Observable<PlatilloDTO> {
    return this.api.get<PlatilloDTO>(`${this.RUTA}/${id}`);
  }

  crear(datos: CrearPlatillo): Observable<PlatilloDTO> {
    return this.api.post<PlatilloDTO>(this.RUTA, datos);
  }

  actualizar(id: number, datos: CrearPlatillo): Observable<PlatilloDTO> {
    return this.api.put<PlatilloDTO>(`${this.RUTA}/${id}`, datos);
  }

  aplicarDescuento(id: number, porcentaje: number): Observable<PlatilloDTO> {
    return this.api.patch<PlatilloDTO>(`${this.RUTA}/${id}/descuento`, { porcentaje });
  }

  eliminar(id: number): Observable<void> {
    return this.api.delete<void>(`${this.RUTA}/${id}`);
  }
}
