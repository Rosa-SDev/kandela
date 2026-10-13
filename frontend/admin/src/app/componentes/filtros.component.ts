import { Component, input, output } from '@angular/core';

export interface FiltroItem {
  id: string;
  texto: string;
  cantidad?: number;
}

@Component({
  selector: 'app-filtros',
  standalone: true,
  template: `
    <div class="f-filtros" role="group" aria-label="Filtrar">
      @for (item of items(); track item.id) {
        <button 
          type="button" 
          [attr.aria-pressed]="item.id === activo()"
          (click)="seleccion.emit(item.id)">
          <span>{{ item.texto }} {{ item.cantidad !== undefined ? '(' + item.cantidad + ')' : '' }}</span>
        </button>
      }
    </div>
  `
})
export class FiltrosComponent {
  items = input.required<FiltroItem[]>();
  activo = input.required<string>();
  seleccion = output<string>();
}
