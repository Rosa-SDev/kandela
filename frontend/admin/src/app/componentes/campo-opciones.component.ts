import { Component, input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { SegmentadoComponent } from './segmentado.component';

let nextId = 0;

@Component({
  selector: 'app-campo-opciones',
  standalone: true,
  imports: [SegmentadoComponent],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CampoOpcionesComponent),
      multi: true
    }
  ],
  template: `
    <div class="f-campo" [class.f-campo--error]="error()">
      <label [id]="id + '-l'">
        {{ label() }}
        @if (req()) {
          <i aria-hidden="true">*</i>
        }
      </label>
      
      <app-segmentado
        [opciones]="opciones()"
        [activa]="value"
        [label]="label()"
        (seleccion)="seleccionar($event)">
      </app-segmentado>

      @if (error() || ayuda()) {
        <small [id]="id + '-m'" [class]="error() ? 'f-campo__error' : 'f-campo__ayuda'">
          {{ error() || ayuda() }}
        </small>
      }
    </div>
  `
})
export class CampoOpcionesComponent implements ControlValueAccessor {
  label = input.required<string>();
  opciones = input.required<string[]>();
  req = input<boolean>(false);
  error = input<string | null>(null);
  ayuda = input<string | null>(null);

  id = `f-campo-opc-${nextId++}`;
  
  value: string = '';
  disabled = false;
  
  onChange = (val: string) => {};
  onTouched = () => {};

  seleccionar(opcion: string) {
    if (this.disabled) return;
    this.value = opcion;
    this.onChange(opcion);
    this.onTouched();
  }

  writeValue(val: string): void {
    this.value = val;
  }
  registerOnChange(fn: any): void {
    this.onChange = fn;
  }
  registerOnTouched(fn: any): void {
    this.onTouched = fn;
  }
  setDisabledState?(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }
}
