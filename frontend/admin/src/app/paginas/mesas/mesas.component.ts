import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators
} from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';
import { MesaDTO, PedidoDTO, ReservaDTO, UsuarioDTO } from '@compartido/api/tipos';
import { ApiService } from '../../nucleo/api.service';
import { TituloComponent } from '../../componentes/titulo.component';
import { TablaComponent } from '../../componentes/tabla.component';
import { AvisoComponent } from '../../componentes/aviso.component';
import { EstadoComponent } from '../../componentes/estado.component';
import { BotonComponent } from '../../componentes/boton.component';
import { DrawerComponent } from '../../componentes/drawer.component';
import { CampoComponent } from '../../componentes/campo.component';
import { MesasService } from './mesas.service';
import { ClaveDeMesa, ETIQUETA_MESA, situacionDeMesa } from './estado-de-mesa';

/** Una fila de la tabla: la mesa y lo que está pasando encima de ella. */
interface FilaDeMesa {
  mesa: MesaDTO;
  clave: ClaveDeMesa;
  ahora: string;
  pedidoId: number | null;
}

/**
 * Un entero mayor que cero, que es lo único que acepta el salón.
 *
 * Se valida aquí además de en el servidor para no gastar una ida y vuelta en
 * un número negativo, y porque el aviso tiene que aparecer debajo del campo.
 */
function enteroPositivo(control: AbstractControl): ValidationErrors | null {
  const texto = String(control.value ?? '').trim();
  if (!texto) {
    return null;
  }
  const numero = Number(texto);
  return Number.isInteger(numero) && numero > 0 ? null : { positivo: true };
}

/**
 * Las mesas del salón desde administración.
 *
 * La pantalla consulta cuatro cosas: las mesas, los pedidos, las reservas y
 * los usuarios. Las tres últimas son para la columna «Ahora» y para saber el
 * estado real de cada mesa, que no se puede leer de la mesa misma. Si alguna
 * de esas tres falla, la tabla se muestra igual y «Ahora» queda más pobre;
 * solo el fallo de las mesas deja la pantalla sin nada que mostrar.
 */
@Component({
  selector: 'app-mesas',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TituloComponent,
    TablaComponent,
    AvisoComponent,
    EstadoComponent,
    BotonComponent,
    DrawerComponent,
    CampoComponent
  ],
  templateUrl: './mesas.component.html'
})
export class MesasComponent implements OnInit {
  private api = inject(ApiService);
  private mesasService = inject(MesasService);
  private fb = inject(FormBuilder);

  mesas = signal<MesaDTO[]>([]);
  pedidos = signal<PedidoDTO[]>([]);
  reservas = signal<ReservaDTO[]>([]);
  usuarios = signal<UsuarioDTO[]>([]);

  cargando = signal(true);
  error = signal<string | null>(null);
  exito = signal<string | null>(null);
  resaltadoId = signal<number | null>(null);

  drawerAbierto = signal(false);
  editando = signal<MesaDTO | null>(null);
  guardando = signal(false);
  resumen = signal<{ titulo: string; texto: string } | null>(null);
  errorNumeroSrv = signal<string | null>(null);

  etiqueta = ETIQUETA_MESA;

  formulario = this.fb.nonNullable.group({
    numero: ['', [Validators.required, enteroPositivo]],
    capacidad: ['', [Validators.required, enteroPositivo]]
  });

  private readonly mensajes: Record<string, Record<string, string>> = {
    numero: {
      required: 'El número de la mesa es obligatorio.',
      positivo: 'El número de la mesa debe ser mayor que cero.'
    },
    capacidad: {
      required: 'La capacidad es obligatoria.',
      positivo: 'La capacidad de la mesa debe ser mayor que cero.'
    }
  };

  /** Las mesas en el orden en que están numeradas en el salón. */
  filas = computed<FilaDeMesa[]>(() => {
    const pedidos = this.pedidos();
    const reservas = this.reservas();
    const usuarios = this.usuarios();
    const hoy = new Date();

    return [...this.mesas()]
      .sort((una, otra) => una.numero - otra.numero)
      .map((mesa) => {
        const situacion = situacionDeMesa(mesa, pedidos, reservas, usuarios, hoy);
        return {
          mesa,
          clave: situacion.clave,
          ahora: situacion.ahora,
          pedidoId: situacion.pedidoId
        };
      });
  });

  ngOnInit() {
    this.cargar();
  }

  reintentar() {
    this.cargar();
  }

  abrir() {
    this.editando.set(null);
    this.formulario.reset({ numero: '', capacidad: '' });
    this.preparar();
  }

  /**
   * Abre el drawer con los datos de esa mesa.
   *
   * El estado no se edita: lo lleva el salón según lo que pase encima de la
   * mesa, así que el formulario solo toca el número y la capacidad.
   */
  editar(mesa: MesaDTO) {
    this.editando.set(mesa);
    this.formulario.reset({
      numero: String(mesa.numero),
      capacidad: String(mesa.capacidad)
    });
    this.preparar();
  }

  private preparar() {
    this.resumen.set(null);
    this.errorNumeroSrv.set(null);
    this.exito.set(null);
    this.drawerAbierto.set(true);
  }

  cerrar() {
    this.drawerAbierto.set(false);
  }

  /** El mensaje de un campo: primero lo que dijo el servidor, luego lo nuestro. */
  errorDe(campo: 'numero' | 'capacidad'): string | null {
    if (campo === 'numero' && this.errorNumeroSrv()) {
      return this.errorNumeroSrv();
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
    const datos = { numero: Number(valores.numero), capacidad: Number(valores.capacidad) };
    const original = this.editando();

    this.guardando.set(true);
    this.resumen.set(null);
    this.errorNumeroSrv.set(null);

    const peticion = original
      ? this.mesasService.actualizar(original.id, datos)
      : this.mesasService.crear(datos);

    peticion.subscribe({
      next: (guardada) => {
        if (original) {
          this.mesas.update((lista) => lista.map((m) => (m.id === guardada.id ? guardada : m)));
          this.exito.set(`Mesa ${guardada.numero} actualizada.`);
        } else {
          this.mesas.update((lista) => [...lista, guardada]);
          this.exito.set(`Mesa ${guardada.numero} creada para ${guardada.capacidad} personas.`);
        }
        this.resaltadoId.set(guardada.id);
        this.guardando.set(false);
        this.drawerAbierto.set(false);
      },
      error: (err) => {
        this.guardando.set(false);
        // El único conflicto al crear o renumerar es que ese número ya esté
        // tomado, así que además del aviso se marca el campo que hay que cambiar.
        if (err.status === 409) {
          this.errorNumeroSrv.set('! Revise este campo.');
          this.resumen.set({ titulo: err.titulo, texto: 'Elija otro número.' });
        } else {
          this.resumen.set({ titulo: err.titulo, texto: 'No se guardó nada todavía.' });
        }
      }
    });
  }

  private cargar() {
    this.cargando.set(true);
    this.error.set(null);

    forkJoin({
      mesas: this.mesasService.listar(),
      pedidos: this.api.get<PedidoDTO[]>('/api/pedidos').pipe(catchError(() => of([] as PedidoDTO[]))),
      reservas: this.api
        .get<ReservaDTO[]>('/api/reservas')
        .pipe(catchError(() => of([] as ReservaDTO[]))),
      usuarios: this.api
        .get<UsuarioDTO[]>('/api/usuarios')
        .pipe(catchError(() => of([] as UsuarioDTO[])))
    }).subscribe({
      next: ({ mesas, pedidos, reservas, usuarios }) => {
        this.mesas.set(mesas);
        this.pedidos.set(pedidos);
        this.reservas.set(reservas);
        this.usuarios.set(usuarios);
        this.cargando.set(false);
      },
      error: (err) => {
        this.error.set(err.titulo);
        this.cargando.set(false);
      }
    });
  }
}
