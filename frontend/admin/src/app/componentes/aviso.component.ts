import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-aviso',
  standalone: true,
  template: `
    <div class="f-aviso" [class]="tono() ? 'f-aviso--' + tono() : ''">
      <i aria-hidden="true">{{ glifo() }}</i>
      <div>
        <b>{{ titulo() }}</b>
        <ng-content></ng-content>
      </div>
      @if (textoBoton()) {
        <button type="button" class="f-btn f-btn--texto" (click)="accion.emit()">
          {{ textoBoton() }}
        </button>
      }
    </div>
  `
})
export class AvisoComponent {
  glifo = input.required<string>();
  titulo = input.required<string>();
  tono = input<'err' | 'ate' | ''>('');
  textoBoton = input<string | null>(null);
  accion = output<void>();
}