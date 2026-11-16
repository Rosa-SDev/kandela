import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { MarcarRevisada, MesaDTO, ResenaDTO } from '@compartido/api/tipos';
import { ApiService } from '../../nucleo/api.service';

/**
 * Las reseñas de los clientes, ya clasificadas por el agente SentiTriage-ES.
 *
 * Las mesas se piden solo para mostrar su número: la reseña guarda el id.
 */
@Injectable({
  providedIn: 'root'
})
export class ResenasService {
  private api = inject(ApiService);
  private readonly RUTA = '/api/resenas';

  listar(): Observable<ResenaDTO[]> {
    return this.api.get<ResenaDTO[]>(this.RUTA);
  }

  marcarRevisada(id: number, revisada: boolean): Observable<ResenaDTO> {
    const cuerpo: MarcarRevisada = { revisada };
    return this.api.patch<ResenaDTO>(`${this.RUTA}/${id}/revisada`, cuerpo);
  }

  volverAClasificar(id: number): Observable<ResenaDTO> {
    return this.api.post<ResenaDTO>(`${this.RUTA}/${id}/clasificacion`, {});
  }

  listarMesas(): Observable<MesaDTO[]> {
    return this.api.get<MesaDTO[]>('/api/mesas');
  }
}
