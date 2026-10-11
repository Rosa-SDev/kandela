import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { SesionService } from '../nucleo/sesion.service';
import { TituloComponent } from '../componentes/titulo.component';
import { CampoComponent } from '../componentes/campo.component';
import { BotonComponent } from '../componentes/boton.component';
import { AvisoComponent } from '../componentes/aviso.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, TituloComponent, CampoComponent, BotonComponent, AvisoComponent],
  template: `
    <div class="sh sh-login" data-densidad="tactil" data-superficie="arcilla">
      <header class="f-nav"><span class="f-nav__logo">KANDELA</span></header>
      
      <div class="login">
        <div class="login__col">
          <app-titulo texto="Iniciar sesión" par="Raíz y Sazón"></app-titulo>
          
          @if (errorSrv()) {
            <app-aviso tono="err" glifo="!" [titulo]="errorSrv()!.titulo">
              {{ errorSrv()!.texto }}
            </app-aviso>
          }
          
          <form [formGroup]="formulario" (ngSubmit)="entrar()" style="display: grid; gap: var(--s4); width: 100%;">
            <app-campo 
              label="Correo" 
              tipo="email" 
              formControlName="correo" 
              [req]="true"
              [error]="errorDe('correo')">
            </app-campo>
            
            <app-campo 
              label="Contraseña" 
              tipo="password" 
              formControlName="password" 
              [req]="true"
              [error]="errorDe('password')">
            </app-campo>
            
            <app-boton 
              tipo="submit"
              variante="calor" 
              [ancho]="true" 
              [disabled]="formulario.invalid || cargando()">
              Entrar
            </app-boton>
          </form>
          
          <p class="login__nota">Cada rol entra a su propia pantalla: administración, salón, caja o cocina.</p>
        </div>
      </div>
    </div>
  `
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private sesionService = inject(SesionService);
  private router = inject(Router);

  cargando = signal(false);
  errorSrv = signal<{ titulo: string, texto: string } | null>(null);

  formulario = this.fb.nonNullable.group({
    correo: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required]
  });

  errorDe(campo: 'correo' | 'password'): string | null {
    const ctrl = this.formulario.get(campo);
    if (ctrl && ctrl.touched && ctrl.invalid) {
      if (ctrl.errors?.['required']) return `El campo es obligatorio.`;
      if (ctrl.errors?.['email']) return 'Correo no válido.';
    }
    return null;
  }

  entrar() {
    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      return;
    }

    this.cargando.set(true);
    this.errorSrv.set(null);

    this.sesionService.iniciar(this.formulario.getRawValue()).subscribe({
      next: (usuario) => {
        if (usuario.rol !== 'ADMINISTRADOR') {
          // Si no es administrador, no lo dejamos pasar.
          this.errorSrv.set({
            titulo: 'Rol no autorizado.',
            texto: 'Esta aplicación es solo para administración. Use Kandela POS o Kandela KDS.'
          });
          this.sesionService.cerrar(); // Borramos la sesión que se acaba de guardar
        } else {
          this.router.navigate(['/operacion/mesas']);
        }
        this.cargando.set(false);
      },
      error: (err) => {
        this.cargando.set(false);
        this.errorSrv.set({
          titulo: err.titulo,
          texto: err.texto || 'Revise los datos e intente de nuevo.'
        });
      }
    });
  }
}
