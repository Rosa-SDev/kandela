import { Component, inject, computed } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { toSignal } from '@angular/core/rxjs-interop';
import { BarraRolComponent } from '../componentes/barra-rol.component';
import { SesionService } from '../nucleo/sesion.service';

@Component({
  selector: 'app-admin-shell',
  standalone: true,
  imports: [RouterOutlet, BarraRolComponent],
  template: `
    <div class="sh" data-densidad="compacta" data-superficie="arcilla">
      @if (usuario()) {
        <app-barra-rol
          [tabs]="tabs"
          [rol]="'Administradora'"
          [nombre]="usuario()!.nombre"
          [rutaActual]="rutaActual() || ''"
          (salir)="cerrarSesion()">
        </app-barra-rol>
      }
      
      <div class="adm-cuerpo">
        @if (rutaActual()?.startsWith('/operacion')) {
          <div class="adm-sub">
            <button type="button" [attr.aria-pressed]="rutaActual() === '/operacion/mesas'" (click)="irA('/operacion/mesas')">Mesas</button>
            <button type="button" [attr.aria-pressed]="rutaActual() === '/operacion/pedidos'" (click)="irA('/operacion/pedidos')">Pedidos</button>
            <button type="button" [attr.aria-pressed]="rutaActual() === '/operacion/reservas'" (click)="irA('/operacion/reservas')">Reservas</button>
          </div>
        }
        <router-outlet></router-outlet>
      </div>
    </div>
  `
})
export class AdminShellComponent {
  private router = inject(Router);
  private sesionService = inject(SesionService);
  
  usuario = this.sesionService.usuarioActual;
  
  private navEnd = toSignal(this.router.events.pipe(
    filter(event => event instanceof NavigationEnd)
  ));
  
  rutaActual = computed(() => {
    this.navEnd(); // trigger update on navigation
    return this.router.url;
  });

  tabs = [
    { texto: 'Operación', ruta: '/operacion' },
    { texto: 'Carta', ruta: '/carta' },
    { texto: 'Clientes', ruta: '/clientes' },
    { texto: 'Facturas', ruta: '/facturas' },
    { texto: 'Usuarios', ruta: '/usuarios' }
  ];

  irA(ruta: string) {
    this.router.navigate([ruta]);
  }

  cerrarSesion() {
    this.sesionService.cerrar();
    this.router.navigate(['/login']);
  }
}