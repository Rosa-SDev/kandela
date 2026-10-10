import { Component, input } from '@angular/core';

@Component({
  selector: 'app-estado',
  standalone: true,
  template: `
    <span class="f-estado" [class]="tono() ? 'f-estado--' + tono() : ''">
      <i aria-hidden="true">{{ glifo() }}</i>
      {{ texto() }}
    </span>
  `
})
export class EstadoComponent {
  glifo = input.required<string>();
  texto = input.required<string>();
  tono = input<'ate' | 'err' | 'off' | ''>('');
}
