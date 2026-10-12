import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormBuilder, FormControl, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, EMPTY, forkJoin, map, of, switchMap } from 'rxjs';
import { ClienteDTO, ReservaDTO } from '@compartido/api/tipos';
import { ApiService } from '../../nucleo/api.service';
import { TituloComponent } from '../../componentes/titulo.component';
import { TablaComponent } from '../../componentes/tabla.component';
import { AvisoComponent } from '../../componentes/aviso.component';
import { CampoComponent } from '../../componentes/campo.component';
import { BotonComponent } from '../../componentes/boton.component';
import { DrawerComponent } from '../../componentes/drawer.component';

/** Equivale a @NotBlank del backend: el texto no puede ser vacío ni solo espacios. */
function noVacio(control: AbstractControl): ValidationErrors | null {
  return String(control.value ?? '').trim() ? null : { required: true };
}

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TituloComponent,
    TablaComponent,
    AvisoComponent,
    CampoComponent,
    BotonComponent,
    DrawerComponent
  ],
  template: `
    <div class="adm-cab">
      <app-titulo texto="Clientes" [par]="total() + ' registrados'"></app-titulo>
      <app-boton variante="calor" (accion)="abrir()">Nuevo cliente</app-boton>
    </div>

    @if (error()) {
      <app-aviso tono="err" glifo="!" [titulo]="error()!"></app-aviso>
    }

    <div style="max-width: 420px; margin: var(--s4) 0 var(--s2)">
      <app-campo label="Buscar por nombre" [formControl]="busqueda"></app-campo>
    </div>

    @if (exito()) {
      <app-aviso glifo="✓" [titulo]="exito()!"></app-aviso>
    }

    <app-tabla
      [columnas]="['Nombre', 'Documento', 'Teléfono', 'Reservas']"
      [vacia]="!cargando() && clientes().length === 0"
      [mensajeVacia]="termino() ? 'SIN RESULTADOS' : 'SIN CLIENTES'"
      [subMensajeVacia]="termino() ? 'ningún cliente se llama «' + termino() + '»' : null">
      @for (c of clientes(); track c.id) {
        <tr [class.nueva]="c.id === resaltadoId()">
          <td><b>{{ c.nombre }}</b></td>
          <td>{{ c.documento }}</td>
          <td>{{ c.telefono ?? '—' }}</td>
          <td>{{ reservasPorCliente()[c.id] ?? 0 }}</td>
        </tr>
      }
    </app-tabla>

    @if (drawerAbierto()) {
      <app-drawer titulo="Nuevo cliente" (cerrar)="cerrar()">
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
            label="Documento"
            formControlName="documento"
            [req]="true"
            [error]="errorDe('documento')">
          </app-campo>

          <app-campo
            label="Teléfono"
            formControlName="telefono"
            ayuda="Opcional.">
          </app-campo>

          <small class="f-req">* Obligatorio</small>
        </form>

        <app-boton pie-der variante="texto" (accion)="cerrar()">Cancelar</app-boton>
        <app-boton pie-der variante="calor" [disabled]="guardando()" (accion)="guardar()">
          Registrar cliente
        </app-boton>
      </app-drawer>
    }
  `
})
export class ClientesComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  /** Todos los clientes, sin filtro: dan el total del título y dicen quién tiene un documento. */
  todos = signal<ClienteDTO[]>([]);
  /** Los que se ven en la tabla: todos, o el resultado de la búsqueda. */
  clientes = signal<ClienteDTO[]>([]);
  total = computed(() => this.todos().length);
  reservasPorCliente = signal<Record<number, number>>({});
  termino = signal('');
  cargando = signal(true);
  error = signal<string | null>(null);
  exito = signal<string | null>(null);
  resaltadoId = signal<number | null>(null);

  drawerAbierto = signal(false);
  guardando = signal(false);
  resumen = signal<{ titulo: string; texto: string } | null>(null);
  errorDocumentoSrv = signal<string | null>(null);

  busqueda = new FormControl('', { nonNullable: true });

  formulario = this.fb.nonNullable.group({
    nombre: ['', noVacio],
    documento: ['', noVacio],
    telefono: ['']
  });

  private readonly mensajes: Record<string, string> = {
    nombre: 'El nombre es obligatorio.',
    documento: 'El documento es obligatorio.'
  };

  constructor() {
    // Busca en el servidor 300 ms después de que la persona deja de escribir.
    this.busqueda.valueChanges
      .pipe(
        debounceTime(300),
        map((texto) => texto.trim()),
        distinctUntilChanged(),
        switchMap((texto) =>
          this.api.get<ClienteDTO[]>(this.urlDeBusqueda(texto)).pipe(
            map((lista) => ({ texto, lista })),
            catchError((err) => {
              this.error.set(err.titulo);
              return EMPTY;
            })
          )
        ),
        takeUntilDestroyed()
      )
      .subscribe(({ texto, lista }) => {
        this.error.set(null);
        this.termino.set(texto);
        this.clientes.set(lista);
      });

    // Al cambiar el documento se borra el aviso de "documento repetido" que mandó el servidor.
    this.formulario.controls.documento.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => this.errorDocumentoSrv.set(null));
  }

  ngOnInit() {
    this.cargar();
  }

  abrir() {
    this.formulario.reset({ nombre: '', documento: '', telefono: '' });
    this.resumen.set(null);
    this.errorDocumentoSrv.set(null);
    this.exito.set(null);
    this.drawerAbierto.set(true);
  }

  cerrar() {
    this.drawerAbierto.set(false);
  }

  errorDe(campo: 'nombre' | 'documento'): string | null {
    if (campo === 'documento' && this.errorDocumentoSrv()) {
      return this.errorDocumentoSrv();
    }
    const control = this.formulario.controls[campo];
    return control.touched && control.invalid ? this.mensajes[campo] : null;
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
    const datos = {
      nombre: valores.nombre.trim(),
      documento: valores.documento.trim(),
      telefono: valores.telefono.trim() || null
    };
    this.guardando.set(true);
    this.resumen.set(null);

    this.api.post<ClienteDTO>('/api/clientes', datos).subscribe({
      next: (guardado) => {
        this.guardando.set(false);
        this.drawerAbierto.set(false);
        this.resaltadoId.set(guardado.id);
        this.exito.set(`Cliente ${guardado.nombre} registrado.`);
        // Se limpia la búsqueda para que el cliente nuevo quede a la vista.
        this.busqueda.setValue('', { emitEvent: false });
        this.termino.set('');
        this.cargar();
      },
      error: (err) => {
        this.guardando.set(false);
        if (err.status === 409) {
          this.errorDocumentoSrv.set('Revise este campo.');
          const dueno = this.todos().find((c) => c.documento === datos.documento);
          this.resumen.set({
            titulo: err.titulo,
            texto: dueno
              ? `Lo tiene ${dueno.nombre}. Búsquelo en la lista en lugar de registrarlo de nuevo.`
              : 'No se guardó nada todavía.'
          });
        } else {
          this.resumen.set({ titulo: err.titulo, texto: 'No se guardó nada todavía.' });
        }
      }
    });
  }

  private urlDeBusqueda(texto: string): string {
    return texto ? `/api/clientes?nombre=${encodeURIComponent(texto)}` : '/api/clientes';
  }

  /** Trae todos los clientes, sus reservas y, si hay una búsqueda activa, su resultado. */
  private cargar() {
    this.cargando.set(true);
    const termino = this.termino();

    forkJoin({
      todos: this.api.get<ClienteDTO[]>('/api/clientes'),
      reservas: this.api.get<ReservaDTO[]>('/api/reservas'),
      buscados: termino ? this.api.get<ClienteDTO[]>(this.urlDeBusqueda(termino)) : of(null)
    }).subscribe({
      next: ({ todos, reservas, buscados }) => {
        const cuenta: Record<number, number> = {};
        for (const reserva of reservas) {
          cuenta[reserva.clienteId] = (cuenta[reserva.clienteId] ?? 0) + 1;
        }
        this.reservasPorCliente.set(cuenta);
        this.todos.set(todos);
        this.clientes.set(buscados ?? todos);
        this.error.set(null);
        this.cargando.set(false);
      },
      error: (err) => {
        this.error.set(err.titulo);
        this.cargando.set(false);
      }
    });
  }
}
