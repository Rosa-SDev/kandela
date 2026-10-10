import { Component, input, output, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';

@Component({
  selector: 'app-dialogo',
  standalone: true,
  template: `
    <div class="f-velo f-velo--centro">
      <div class="f-dialogo" role="alertdialog" aria-modal="true" tabindex="-1" #dialogoPanel>
        <h2 class="f-titulo">{{ titulo() }}</h2>
        
        @if (tipo()) {
          <div class="f-dialogo__tipo" [class.f-dialogo__tipo--baja]="esDestructivo()">
            {{ tipo() }}
          </div>
        }
        
        <ng-content></ng-content>
        
        <div class="f-dialogo__pie">
          <ng-content select="[pie]"></ng-content>
        </div>
      </div>
    </div>
  `
})
export class DialogoComponent implements AfterViewInit {
  titulo = input.required<string>();
  tipo = input<string | null>(null);
  esDestructivo = input<boolean>(false);
  cerrar = output<void>();

  @ViewChild('dialogoPanel') panel!: ElementRef<HTMLDivElement>;

  ngAfterViewInit() {
    // Llevar el foco al interior del panel (usualmente el botón 'Volver' debería tomarlo, 
    // pero enfocamos el contenedor base para asegurar accesibilidad)
    this.panel.nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.cerrar.emit();
  }
}