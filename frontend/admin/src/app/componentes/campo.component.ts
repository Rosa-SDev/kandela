import { Component, input, forwardRef } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR, FormsModule } from '@angular/forms';

let nextId = 0;

@Component({
  selector: 'app-campo',
  standalone: true,
  imports: [FormsModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => CampoComponent),
      multi: true
    }
  ],
  template: `
    <div class="f-campo" [class.f-campo--error]="error()">
      <label [for]="id">
        {{ label() }}
        @if (req()) {
          <i aria-hidden="true">*</i>
        }
      </label>
      
      @if (tipo() === 'textarea') {
        <textarea 
          [id]="id" 
          [attr.aria-invalid]="!!error()"
          [attr.aria-describedby]="(error() || ayuda()) ? id + '-m' : null"
          [disabled]="disabled"
          [(ngModel)]="value"
          (ngModelChange)="onChange($event)"
          (blur)="onTouched()">
        </textarea>
      } @else {
        <input 
          [type]="tipo()" 
          [id]="id" 
          [attr.aria-invalid]="!!error()"
          [attr.aria-describedby]="(error() || ayuda()) ? id + '-m' : null"
          [disabled]="disabled"
          [(ngModel)]="value"
          (ngModelChange)="onChange($event)"
          (blur)="onTouched()" />
      }

      @if (error() || ayuda()) {
        <small [id]="id + '-m'" [class]="error() ? 'f-campo__error' : 'f-campo__ayuda'">
          {{ error() || ayuda() }}
        </small>
      }
    </div>
  `
})
export class CampoComponent implements ControlValueAccessor {
  label = input.required<string>();
  tipo = input<'text' | 'password' | 'email' | 'number' | 'textarea'>('text');
  req = input<boolean>(false);
  error = input<string | null>(null);
  ayuda = input<string | null>(null);

  id = `f-campo-${nextId++}`;
  
  // Implementación de ControlValueAccessor para Reactive Forms / NgModel
  value: any = '';
  disabled = false;
  
  onChange = (val: any) => {};
  onTouched = () => {};

  writeValue(val: any): void {
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
