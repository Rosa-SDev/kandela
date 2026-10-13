import { Injectable, signal, inject } from '@angular/core';
import { ApiService } from './api.service';
import { UsuarioDTO, Login } from '@compartido/api/tipos';
import { tap } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SesionService {
  private api = inject(ApiService);
  
  // Señal reactiva del usuario actual
  readonly usuarioActual = signal<UsuarioDTO | null>(this.leerDeStorage());

  iniciar(credenciales: Login) {
    return this.api.post<UsuarioDTO>('/api/auth/login', credenciales).pipe(
      tap(usuario => {
        sessionStorage.setItem('kandela_admin_user', JSON.stringify(usuario));
        this.usuarioActual.set(usuario);
      })
    );
  }

  cerrar() {
    sessionStorage.removeItem('kandela_admin_user');
    this.usuarioActual.set(null);
  }

  private leerDeStorage(): UsuarioDTO | null {
    const data = sessionStorage.getItem('kandela_admin_user');
    return data ? JSON.parse(data) : null;
  }
}
