import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-boton',
  standalone: true,
  template: `
    <button 
      type="button" 
      class="f-btn" 
      [class]="'f-btn--' + variante()"
      [class.f-btn--ancho]="ancho()"
      [disabled]="disabled()"
      (click)="accion.emit()">
      <ng-content></ng-content>
    </button>
  `
})
export class BotonComponent {
  variante = input<'calor' | 'tinta' | 'texto' | 'baja' | 'texto-baja'>('tinta');
  ancho = input<boolean>(false);
  disabled = input<boolean>(false);
  accion = output<void>();
}
