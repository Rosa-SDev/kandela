import { Component, input, output, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';

@Component({
  selector: 'app-dialogo',
  standalone: true,
  template: `
    <div class="f-velo f-velo--centro">
      <section class="f-dialogo papel" role="alertdialog" aria-modal="true" tabindex="-1" #dialogoPanel>
        @if (tipo()) {
          <span class="f-dialogo__tipo" [class.f-dialogo__tipo--baja]="esDestructivo()">
            {{ esDestructivo() ? '! ' : '' }}{{ tipo() }}
          </span>
        }
        
        <h2 class="f-titulo">{{ titulo() }}</h2>
        
        <ng-content></ng-content>
        
        <div class="f-dialogo__pie">
          <ng-content select="[pie]"></ng-content>
        </div>
      </section>
    </div>
  `,
  styles: [`
    :host {
      display: contents;
    }
    .f-velo {
      position: fixed;
      inset: 0;
      z-index: 100;
      background: rgba(58, 26, 34, 0.45);
    }
    .f-dialogo {
      background: var(--papel);
      color: var(--tinta);
      box-shadow: 0 16px 40px rgba(30, 21, 23, 0.35);
    }
  `]
})
export class DialogoComponent implements AfterViewInit {
  titulo = input.required<string>();
  tipo = input<string | null>(null);
  esDestructivo = input<boolean>(false);
  cerrar = output<void>();

  @ViewChild('dialogoPanel') panel!: ElementRef<HTMLElement>;

  ngAfterViewInit() {
    this.panel.nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.cerrar.emit();
  }
}