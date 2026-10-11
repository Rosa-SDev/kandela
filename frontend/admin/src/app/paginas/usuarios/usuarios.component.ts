import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { Rol, UsuarioDTO } from '@compartido/api/tipos';
import { ApiService } from '../../nucleo/api.service';
import { TituloComponent } from '../../componentes/titulo.component';
import { FiltrosComponent } from '../../componentes/filtros.component';
import { TablaComponent } from '../../componentes/tabla.component';
import { AvisoComponent } from '../../componentes/aviso.component';
import { BotonComponent } from '../../componentes/boton.component';
import { DrawerComponent } from '../../componentes/drawer.component';
import { CampoComponent } from '../../componentes/campo.component';
import { CampoOpcionesComponent } from '../../componentes/campo-opciones.component';

type Filtro = 'TODOS' | Rol;

const LOCAL_PERMITIDO = /^[A-Za-z0-9._%+-]+$/;
const DOMINIO_PERMITIDO = /^[A-Za-z0-9.-]+$/;

/** Equivale a @NotBlank del backend: el texto no puede ser vacío ni solo espacios. */
function noVacio(control: AbstractControl): ValidationErrors | null {
  return String(control.value ?? '').trim() ? null : { required: true };
}

/** Mismas reglas que @CorreoValido del backend. */
function correoValido(control: AbstractControl): ValidationErrors | null {
  const correo = String(control.value ?? '').trim();
  if (!correo) {
    return null;
  }
  const partes = correo.split('@');
  if (partes.length !== 2) {
    return { correo: true };
  }
  const [local, dominio] = partes;
  const punto = dominio.indexOf('.');
  const bien =
    LOCAL_PERMITIDO.test(local) &&
    DOMINIO_PERMITIDO.test(dominio) &&
    !local.includes('..') &&
    !dominio.includes('..') &&
    !local.startsWith('.') &&
    !local.endsWith('.') &&
    !dominio.startsWith('.') &&
    !dominio.endsWith('.') &&
    !dominio.startsWith('-') &&
    !dominio.endsWith('-') &&
    punto > 0 &&
    punto < dominio.length - 1;
  return bien ? null : { correo: true };
}

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TituloComponent,
    FiltrosComponent,
    TablaComponent,
    AvisoComponent,
    BotonComponent,
    DrawerComponent,
    CampoComponent,
    CampoOpcionesComponent
  ],
  template: `
    <div class="adm-cab">
      <app-titulo texto="Usuarios" [par]="usuarios().length + ' registrados'"></app-titulo>
      <app-boton variante="calor" (accion)="abrir()">Nuevo usuario</app-boton>
    </div>

    @if (error()) {
      <app-aviso tono="err" glifo="!" [titulo]="error()!"></app-aviso>
    }

    <app-filtros [items]="items()" [activo]="filtro()" (seleccion)="elegir($event)"></app-filtros>

    @if (exito()) {
      <app-aviso glifo="✓" [titulo]="exito()!"></app-aviso>
    }

    <app-tabla
      [columnas]="['Nombre', 'Correo', 'Rol', '']"
      [vacia]="!cargando() && visibles().length === 0"
      mensajeVacia="SIN USUARIOS">
      @for (u of visibles(); track u.id) {
        <tr [class.nueva]="u.id === resaltadoId()">
          <td><b>{{ u.nombre }}</b></td>
          <td>{{ u.correo }}</td>
          <td>{{ etiqueta[u.rol] }}</td>
          <td class="acc">
            <app-boton variante="texto" (accion)="editar(u)">Editar</app-boton>
          </td>
        </tr>
      }
    </app-tabla>

    @if (drawerAbierto()) {
      <app-drawer
        [titulo]="editando() ? 'Editar usuario' : 'Nuevo usuario'"
        [par]="editando()?.nombre ?? null"
        (cerrar)="cerrar()">
        @if (resumen()) {
          <app-aviso tono="err" glifo="!" [titulo]="resumen()!.titulo">
            {{ resumen()!.texto }}
          </app-aviso>
        }

        <form [formGroup]="formulario" (ngSubmit)="guardar()" style="display: grid; gap: var(--s4)">
          <app-campo
            label="Nombre completo"
            formControlName="nombre"
            [req]="true"
            [error]="errorDe('nombre')">
          </app-campo>

          <app-campo
            label="Correo"
            tipo="email"
            formControlName="correo"
            [req]="true"
            ayuda="Con este correo inicia sesión."
            [error]="errorDe('correo')">
          </app-campo>

          @if (editando()) {
            <div style="display: grid; gap: var(--s2)">
              <b>Rol</b>
              <span>{{ etiqueta[editando()!.rol] }}</span>
              <small>El rol se define al crear al usuario.</small>
            </div>
          } @else {
            <app-campo-opciones
              label="Rol"
              [opciones]="opcionesRol"
              formControlName="rol"
              [req]="true">
            </app-campo-opciones>
          }

          <app-campo
            label="Contraseña"
            tipo="password"
            formControlName="password"
            [req]="!editando()"
            [ayuda]="editando() ? 'Déjela vacía para conservar la actual.' : 'Mínimo 6 caracteres.'"
            [error]="errorDe('password')">
          </app-campo>

          <small class="f-req">* Obligatorio</small>
        </form>

        <app-boton pie-der variante="texto" (accion)="cerrar()">Cancelar</app-boton>
        <app-boton pie-der variante="calor" [disabled]="guardando()" (accion)="guardar()">
          {{ editando() ? 'Guardar cambios' : 'Crear usuario' }}
        </app-boton>
      </app-drawer>
    }
  `
})
export class UsuariosComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  usuarios = signal<UsuarioDTO[]>([]);
  filtro = signal<Filtro>('TODOS');
  cargando = signal(true);
  error = signal<string | null>(null);

  drawerAbierto = signal(false);
  editando = signal<UsuarioDTO | null>(null);
  guardando = signal(false);
  resumen = signal<{ titulo: string; texto: string } | null>(null);
  errorCorreoSrv = signal<string | null>(null);
  exito = signal<string | null>(null);
  resaltadoId = signal<number | null>(null);

  readonly etiqueta: Record<Rol, string> = {
    ADMINISTRADOR: 'Administrador',
    MESERO: 'Mesero',
    COCINERO: 'Cocinero',
    CAJERO: 'Cajero'
  };

  private readonly roles: Rol[] = ['ADMINISTRADOR', 'MESERO', 'COCINERO', 'CAJERO'];

  readonly opcionesRol = this.roles.map((rol) => this.etiqueta[rol]);

  private readonly mensajes: Record<string, Record<string, string>> = {
    nombre: { required: 'El nombre es obligatorio.' },
    correo: {
      required: 'El correo es obligatorio.',
      correo: 'El correo no tiene un formato válido.'
    },
    password: {
      required: 'La contraseña es obligatoria.',
      minlength: 'La contraseña debe tener al menos 6 caracteres.'
    }
  };

  formulario = this.fb.nonNullable.group({
    nombre: ['', noVacio],
    correo: ['', [noVacio, correoValido]],
    rol: ['Mesero'],
    password: ['', [noVacio, Validators.minLength(6)]]
  });

  items = computed(() => [
    { id: 'TODOS', texto: 'Todos', cantidad: this.usuarios().length },
    ...this.roles.map((rol) => ({
      id: rol,
      texto: this.etiqueta[rol],
      cantidad: this.usuarios().filter((u) => u.rol === rol).length
    }))
  ]);

  visibles = computed(() =>
    this.filtro() === 'TODOS'
      ? this.usuarios()
      : this.usuarios().filter((u) => u.rol === this.filtro())
  );

  constructor() {
    // Al cambiar el correo se borra el error de "correo repetido" que mandó el servidor.
    this.formulario.controls.correo.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.errorCorreoSrv.set(null));
  }

  ngOnInit() {
    this.cargar();
  }

  elegir(id: string) {
    this.filtro.set(id as Filtro);
  }

  abrir() {
    this.editando.set(null);
    // Al crear, la contraseña es obligatoria y de 6 o más caracteres.
    this.formulario.controls.password.setValidators([noVacio, Validators.minLength(6)]);
    this.formulario.reset({ nombre: '', correo: '', rol: 'Mesero', password: '' });
    this.preparar();
  }

  editar(usuario: UsuarioDTO) {
    this.editando.set(usuario);
    // Al editar, la contraseña es opcional; si se escribe, debe tener 6 o más caracteres.
    this.formulario.controls.password.setValidators([Validators.minLength(6)]);
    this.formulario.reset({
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: this.etiqueta[usuario.rol],
      password: ''
    });
    this.preparar();
  }

  private preparar() {
    this.formulario.controls.password.updateValueAndValidity();
    this.resumen.set(null);
    this.errorCorreoSrv.set(null);
    this.exito.set(null);
    this.drawerAbierto.set(true);
  }

  cerrar() {
    this.drawerAbierto.set(false);
  }

  errorDe(campo: 'nombre' | 'correo' | 'password'): string | null {
    if (campo === 'correo' && this.errorCorreoSrv()) {
      return this.errorCorreoSrv();
    }
    const control = this.formulario.controls[campo];
    if (!control.touched || !control.invalid) {
      return null;
    }
    const clave = Object.keys(control.errors ?? {})[0];
    return this.mensajes[campo][clave] ?? null;
  }

  guardar() {
    if (this.guardando()) {
      return;
    }

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      const n = Object.values(this.formulario.controls).filter((c) => c.invalid).length;
      this.resumen.set({
        titulo: `Revise ${n} campo${n === 1 ? '' : 's'}`,
        texto: 'No se guardó nada todavía.'
      });
      return;
    }

    const valores = this.formulario.getRawValue();
    const original = this.editando();
    this.guardando.set(true);
    this.resumen.set(null);

    const datos = {
      nombre: valores.nombre.trim(),
      correo: valores.correo.trim(),
      password: valores.password
    };

    const peticion = original
      ? this.api.put<UsuarioDTO>(`/api/usuarios/${original.id}`, datos)
      : this.api.post<UsuarioDTO>('/api/usuarios', { ...datos, rol: this.rolDe(valores.rol) });

    peticion.subscribe({
      next: (guardado) => {
        if (original) {
          this.usuarios.update((lista) => lista.map((u) => (u.id === guardado.id ? guardado : u)));
          this.exito.set(`Usuario ${guardado.nombre} actualizado.`);
        } else {
          this.usuarios.update((lista) => [...lista, guardado]);
          this.filtro.set('TODOS');
          this.exito.set(
            `Usuario ${guardado.nombre} creado como ${this.etiqueta[guardado.rol].toLowerCase()}.`
          );
        }
        this.resaltadoId.set(guardado.id);
        this.guardando.set(false);
        this.drawerAbierto.set(false);
      },
      error: (err) => {
        this.guardando.set(false);
        if (err.status === 409) {
          this.errorCorreoSrv.set('Use otro correo.');
        }
        this.resumen.set({
          titulo: err.titulo,
          texto: 'No se guardó nada todavía.'
        });
      }
    });
  }

  private rolDe(etiqueta: string): Rol {
    return this.roles.find((rol) => this.etiqueta[rol] === etiqueta) ?? 'MESERO';
  }

  private cargar() {
    this.cargando.set(true);
    this.error.set(null);
    this.api.get<UsuarioDTO[]>('/api/usuarios').subscribe({
      next: (lista) => {
        this.usuarios.set(lista);
        this.cargando.set(false);
      },
      error: (err) => {
        this.error.set(err.titulo);
        this.cargando.set(false);
      }
    });
  }
}