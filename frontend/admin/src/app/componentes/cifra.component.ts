import { Component, input, computed } from '@angular/core';

@Component({
  selector: 'app-cifra',
  standalone: true,
  template: `
    <span class="f-cifra">{{ dinero() }}</span>
  `
})
export class CifraComponent {
  valor = input.required<number>();
  
  dinero = computed(() => {
    return '$ ' + Math.round(this.valor()).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  });
}
