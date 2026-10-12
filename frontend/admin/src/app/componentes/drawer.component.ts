import { Component, input, output, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';

@Component({
  selector: 'app-drawer',
  standalone: true,
  template: `
    <div class="f-velo">
      <div class="f-drawer" role="dialog" aria-modal="true" tabindex="-1" #drawerPanel>
        <div class="f-drawer__cab">
          <h2 class="f-titulo">
            {{ titulo() }}
            @if (par()) {
              <span class="f-par">({{ par() }})</span>
            }
          </h2>
          <button type="button" class="f-cerrar" aria-label="Cerrar" (click)="cerrar.emit()">×</button>
        </div>
        <div class="f-drawer__cuerpo">
          <ng-content></ng-content>
        </div>
        <div class="f-drawer__pie">
          <ng-content select="[pie-izq]"></ng-content>
          <div class="der">
            <ng-content select="[pie-der]"></ng-content>
          </div>
        </div>
      </div>
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
    .f-drawer {
      box-shadow: -10px 0 30px rgba(30, 21, 23, 0.25);
    }
  `]
})
export class DrawerComponent implements AfterViewInit {
  titulo = input.required<string>();
  par = input<string | null>(null);
  cerrar = output<void>();

  @ViewChild('drawerPanel') panel!: ElementRef<HTMLDivElement>;

  ngAfterViewInit() {
    this.panel.nativeElement.focus();
  }

  @HostListener('document:keydown.escape')
  onEscape() {
    this.cerrar.emit();
  }
}