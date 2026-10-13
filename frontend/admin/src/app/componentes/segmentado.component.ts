import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-segmentado',
  standalone: true,
  template: `
    <div class="f-seg" role="group" [attr.aria-label]="label()">
      @for (opcion of opciones(); track opcion) {
        <button 
          type="button" 
          [attr.aria-pressed]="opcion === activa()"
          (click)="seleccion.emit(opcion)">
          {{ opcion }}
        </button>
      }
    </div>
  `
})
export class SegmentadoComponent {
  opciones = input.required<string[]>();
  activa = input.required<string>();
  label = input<string>('Selector');
  seleccion = output<string>();
}
