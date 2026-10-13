import { Component, input, output } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';

export interface TabRol {
  texto: string;
  ruta: string;
}

@Component({
  selector: 'app-barra-rol',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  template: `
    <header class="f-nav">
      <span class="f-nav__logo">KANDELA</span>
      <nav class="f-nav__tabs" aria-label="Secciones">
        @for (tab of tabs(); track tab.ruta) {
          <a [routerLink]="tab.ruta" routerLinkActive="activo" [attr.aria-current]="isActivo(tab.ruta) ? 'page' : null">
            {{ tab.texto }}
          </a>
        }
      </nav>
      <span class="f-nav__quien">
        {{ rol() }} <b>{{ nombre() }}</b> 
        <button type="button" (click)="salir.emit()">Salir</button>
      </span>
    </header>
  `,
  styles: [`
    /* Ajuste para que RouterLink interactúe con el CSS original que usa aria-current="page" */
    a { display: flex; align-items: center; padding: 0 var(--s4); font-family: var(--f-voz); font-size: 17px; letter-spacing: .03em; text-transform: uppercase; color: var(--vino-tenue); white-space: nowrap; text-decoration: none; }
    a[aria-current="page"] { background: var(--fondo); color: var(--texto); }
  `]
})
export class BarraRolComponent {
  tabs = input.required<TabRol[]>();
  rol = input.required<string>();
  nombre = input.required<string>();
  rutaActual = input.required<string>(); // para marcar la activa
  salir = output<void>();

  isActivo(ruta: string): boolean {
    return this.rutaActual().startsWith(ruta);
  }
}