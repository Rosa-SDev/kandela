import { Component, input } from '@angular/core';

@Component({
  selector: 'app-titulo',
  standalone: true,
  template: `
    <h1 class="f-titulo">
      {{ texto() }}
      @if (par()) {
        <span class="f-par">({{ par() }})</span>
      }
    </h1>
  `
})
export class TituloComponent {
  texto = input.required<string>();
  par = input<string>();
}
