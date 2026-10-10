import { Component, input } from '@angular/core';

@Component({
  selector: 'app-tabla',
  standalone: true,
  template: `
    <table class="f-tabla">
      <thead>
        <tr>
          @for (col of columnas(); track col) {
            <th>{{ col }}</th>
          }
        </tr>
      </thead>
      <tbody>
        <ng-content></ng-content>
        @if (vacia()) {
          <tr>
            <td [attr.colspan]="columnas().length" class="vacia">
              {{ mensajeVacia() }}
              @if (subMensajeVacia()) {
                <br><span>({{ subMensajeVacia() }})</span>
              }
            </td>
          </tr>
        }
      </tbody>
    </table>
  `
})
export class TablaComponent {
  columnas = input.required<string[]>();
  vacia = input<boolean>(false);
  mensajeVacia = input<string>('SIN RESULTADOS');
  subMensajeVacia = input<string | null>(null);
}