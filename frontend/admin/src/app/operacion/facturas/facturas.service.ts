import { Injectable, inject } from '@angular/core';
import { ApiService } from '../../nucleo/api.service';
import { FacturaDTO, PedidoDTO } from '@compartido/api/tipos';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class FacturasService {
  private api = inject(ApiService);
  private readonly RUTA_FACTURAS = '/api/facturas';
  private readonly RUTA_PEDIDOS = '/api/pedidos';

  listarFacturas(): Observable<FacturaDTO[]> {
    return this.api.get<FacturaDTO[]>(this.RUTA_FACTURAS);
  }

  listarPedidos(): Observable<PedidoDTO[]> {
    return this.api.get<PedidoDTO[]>(this.RUTA_PEDIDOS);
  }

  buscarPorId(id: number): Observable<FacturaDTO> {
    return this.api.get<FacturaDTO>(`${this.RUTA_FACTURAS}/${id}`);
  }

  anularFactura(id: number): Observable<FacturaDTO> {
    return this.api.delete<FacturaDTO>(`${this.RUTA_FACTURAS}/${id}`);
  }
}
