import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, ValidationErrors, Validators } from '@angular/forms';
import { catchError, forkJoin, Observable, of } from 'rxjs';
import { ClienteDTO, EstadoReserva, MesaDTO, ReservaDTO, UsuarioDTO } from '@compartido/api/tipos';
import { ApiService } from '../../nucleo/api.service';
import { TituloComponent } from '../../componentes/titulo.component';
import { FiltrosComponent } from '../../componentes/filtros.component';
import { TablaComponent } from '../../componentes/tabla.component';
import { AvisoComponent } from '../../componentes/aviso.component';
import { EstadoComponent } from '../../componentes/estado.component';
import { BotonComponent } from '../../componentes/boton.component';
import { DrawerComponent } from '../../componentes/drawer.component';
import { DialogoComponent } from '../../componentes/dialogo.component';

type Filtro = 'TODAS' | 'PENDIENTES' | 'CONFIRMADAS' | 'CERRADAS';

/** La fecha y la hora juntas no pueden quedar antes del minuto actual (igual que el backend). */
function noPasada(grupo: AbstractControl): ValidationErrors | null {
  const fecha = grupo.get('fecha')?.value;
  const hora = grupo.get('hora')?.value;
  if (!fecha || !hora) {
    return null;
  }
  const elegida = new Date(`${fecha}T${hora}:00`);
  const ahora = new Date();
  ahora.setSeconds(0, 0);
  return elegida < ahora ? { pasada: true } : null;
}

function dosDigitos(n: number): string {
  return String(n).padStart(2, '0');
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** Cómo se ve cada estado en la tabla. */
const ESTADOS: Record<EstadoReserva, { glifo: string; texto: string; tono: '' | 'off' }> = {
  PENDIENTE: { glifo: '○', texto: 'Pendiente', tono: '' },
  CONFIRMADA: { glifo: '●', texto: 'Confirmada', tono: '' },
  CUMPLIDA: { glifo: '✓', texto: 'Cumplida', tono: 'off' },
  CANCELADA: { glifo: '✕', texto: 'Cancelada', tono: 'off' }
};

@Component({
  selector: 'app-reservas',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    TituloComponent,
    FiltrosComponent,
    TablaComponent,
    AvisoComponent,
    EstadoComponent,
    BotonComponent,
    DrawerComponent,
    DialogoComponent
  ],
  template: `
    <div class="adm-cab">
      <app-titulo texto="Reservas" [par]="vigentes() + ' vigentes'"></app-titulo>
      <app-boton variante="calor" (accion)="abrir()">Nueva reserva</app-boton>
    </div>

    @if (error()) {
      <app-aviso tono="err" glifo="!" [titulo]="error()!"></app-aviso>
    }

    <app-filtros [items]="items()" [activo]="filtro()" (seleccion)="elegir($event)"></app-filtros>

    @if (exito()) {
      <app-aviso glifo="✓" [titulo]="exito()!"></app-aviso>
    }

    <app-tabla
      [columnas]="['Fecha', 'Hora', 'Cliente', 'Personas', 'Mesa', 'Mesero', 'Estado', '']"
      [vacia]="!cargando() && visibles().length === 0"
      mensajeVacia="SIN RESERVAS">
      @for (r of visibles(); track r.id) {
        <tr [class.nueva]="r.id === resaltadoId()">
          <td><b>{{ fecha(r.fechaHora) }}</b></td>
          <td>{{ hora(r.fechaHora) }}</td>
          <td>{{ r.clienteNombre }}</td>
          <td>{{ r.numPersonas }}</td>
          <td>{{ mesa(r.mesaId) }}</td>
          <td>{{ mesero(r.meseroId) }}</td>
          <td>
            <app-estado
              [glifo]="estados[r.estado].glifo"
              [texto]="estados[r.estado].texto"
              [tono]="estados[r.estado].tono">
            </app-estado>
          </td>
          <td class="acc">
            @if (r.estado === 'PENDIENTE') {
              <app-boton variante="texto" (accion)="cambiarEstado(r, 'CONFIRMADA')">Confirmar</app-boton>
            }
            @if (r.estado === 'CONFIRMADA') {
              <app-boton variante="texto" (accion)="cambiarEstado(r, 'CUMPLIDA')">Cumplida</app-boton>
            }
            @if (r.estado === 'PENDIENTE' || r.estado === 'CONFIRMADA') {
              <app-boton variante="texto-baja" (accion)="pedir('cancelar', r)">Cancelar</app-boton>
            }
            <app-boton variante="texto-baja" (accion)="pedir('eliminar', r)">Eliminar</app-boton>
          </td>
        </tr>
      }
    </app-tabla>

    @if (drawerAbierto()) {
      <app-drawer titulo="Nueva reserva" (cerrar)="cerrar()">
        @if (resumen()) {
          <app-aviso tono="err" glifo="!" [titulo]="resumen()!.titulo">
            {{ resumen()!.texto }}
          </app-aviso>
        }

        <form [formGroup]="formulario" (ngSubmit)="guardar()" style="display: grid; gap: var(--s4)">
          <div class="f-campo" [class.f-campo--error]="errorDe('clienteId')">
            <label for="r-cliente">Cliente <i aria-hidden="true">*</i></label>
            <select id="r-cliente" formControlName="clienteId">
              <option value="">Elija un cliente</option>
              @for (c of clientes(); track c.id) {
                <option [value]="c.id">{{ c.nombre }} · {{ c.documento }}</option>
              }
            </select>
            @if (errorDe('clienteId')) {
              <small class="f-campo__error">{{ errorDe('clienteId') }}</small>
            }
          </div>

          <div class="f-dos">
            <div class="f-campo" [class.f-campo--error]="errorDe('fecha')">
              <label for="r-fecha">Fecha <i aria-hidden="true">*</i></label>
              <input id="r-fecha" type="date" formControlName="fecha" />
              @if (errorDe('fecha')) {
                <small class="f-campo__error">{{ errorDe('fecha') }}</small>
              }
            </div>
            <div class="f-campo" [class.f-campo--error]="errorDe('hora')">
              <label for="r-hora">Hora <i aria-hidden="true">*</i></label>
              <input id="r-hora" type="time" formControlName="hora" />
              @if (errorDe('hora')) {
                <small class="f-campo__error">{{ errorDe('hora') }}</small>
              }
            </div>
          </div>

          <div class="f-dos">
            <div class="f-campo" [class.f-campo--error]="errorDe('personas')">
              <label for="r-personas">Personas <i aria-hidden="true">*</i></label>
              <input id="r-personas" type="number" min="1" formControlName="personas" />
              @if (errorDe('personas')) {
                <small class="f-campo__error">{{ errorDe('personas') }}</small>
              }
            </div>
            <div class="f-campo" [class.f-campo--error]="errorMesaSrv()">
              <label for="r-mesa">Mesa</label>
              <select id="r-mesa" formControlName="mesaId">
                <option value="">Sin asignar</option>
                @for (m of mesas(); track m.id) {
                  <option [value]="m.id">Mesa {{ m.numero }} · hasta {{ m.capacidad }}</option>
                }
              </select>
              @if (errorMesaSrv()) {
                <small class="f-campo__error">{{ errorMesaSrv() }}</small>
              }
            </div>
          </div>

          <div class="f-campo">
            <label for="r-mesero">Mesero</label>
            <select id="r-mesero" formControlName="meseroId">
              <option value="">Sin asignar</option>
              @for (u of meseros(); track u.id) {
                <option [value]="u.id">{{ u.nombre }}</option>
              }
            </select>
          </div>

          <small class="f-req">* Obligatorio</small>
        </form>

        <app-boton pie-der variante="texto" (accion)="cerrar()">Cancelar</app-boton>
        <app-boton pie-der variante="calor" [disabled]="guardando()" (accion)="guardar()">
          Registrar reserva
        </app-boton>
      </app-drawer>
    }

    @if (dialogo(); as d) {
      @if (d.accion === 'cancelar') {
        <app-dialogo
          [titulo]="'¿Cancelar la reserva de ' + d.reserva.clienteNombre + '?'"
          tipo="Cambio de estado"
          (cerrar)="cerrarDialogo()">
          <ul>
            <li>Queda en el historial como cancelada.</li>
            <li>Si el cliente vuelve a llamar, se registra una reserva nueva.</li>
          </ul>
          <app-boton pie variante="tinta" (accion)="cerrarDialogo()">Volver</app-boton>
          <app-boton pie variante="calor" [disabled]="trabajando()" (accion)="confirmarDialogo()">
            Cancelar reserva
          </app-boton>
        </app-dialogo>
      } @else {
        <app-dialogo
          [titulo]="'¿Eliminar la reserva de ' + d.reserva.clienteNombre + '?'"
          tipo="Acción irreversible"
          [esDestructivo]="true"
          (cerrar)="cerrarDialogo()">
          <ul>
            <li>Se borra del todo: no queda en el historial.</li>
            <li>Si el cliente solo avisó que no viene, use «Cancelar».</li>
          </ul>
          <app-boton pie variante="tinta" (accion)="cerrarDialogo()">Volver</app-boton>
          <app-boton pie variante="calor" [disabled]="trabajando()" (accion)="confirmarDialogo()">
            Eliminar reserva
          </app-boton>
        </app-dialogo>
      }
    }
  `
})
export class ReservasComponent implements OnInit {
  private api = inject(ApiService);
  private fb = inject(FormBuilder);

  reservas = signal<ReservaDTO[]>([]);
  mesas = signal<MesaDTO[]>([]);
  meseros = signal<UsuarioDTO[]>([]);
  clientes = signal<ClienteDTO[]>([]);
  exito = signal<string | null>(null);
  resaltadoId = signal<number | null>(null);

  drawerAbierto = signal(false);
  guardando = signal(false);
  resumen = signal<{ titulo: string; texto: string } | null>(null);
  errorMesaSrv = signal<string | null>(null);

  dialogo = signal<{ accion: 'cancelar' | 'eliminar'; reserva: ReservaDTO } | null>(null);
  trabajando = signal(false);

  formulario = this.fb.nonNullable.group(
    {
      clienteId: ['', Validators.required],
      fecha: ['', Validators.required],
      hora: ['', Validators.required],
      personas: [2, [Validators.required, Validators.min(1)]],
      mesaId: [''],
      meseroId: ['']
    },
    { validators: noPasada }
  );
  filtro = signal<Filtro>('TODAS');
  cargando = signal(true);
  error = signal<string | null>(null);

  readonly estados = ESTADOS;

  /** Pendientes y confirmadas: las que todavía van a pasar. */
  vigentes = computed(
    () => this.reservas().filter((r) => r.estado === 'PENDIENTE' || r.estado === 'CONFIRMADA').length
  );

  items = computed(() => {
    const contar = (f: Filtro) => this.reservas().filter((r) => this.cumple(r, f)).length;
    return [
      { id: 'TODAS', texto: 'Todas', cantidad: contar('TODAS') },
      { id: 'PENDIENTES', texto: 'Pendientes', cantidad: contar('PENDIENTES') },
      { id: 'CONFIRMADAS', texto: 'Confirmadas', cantidad: contar('CONFIRMADAS') },
      { id: 'CERRADAS', texto: 'Cerradas', cantidad: contar('CERRADAS') }
    ];
  });

  visibles = computed(() =>
    this.reservas()
      .filter((r) => this.cumple(r, this.filtro()))
      .sort((a, b) => a.fechaHora.localeCompare(b.fechaHora))
  );

  ngOnInit() {
    this.cargar();
  }

  elegir(id: string) {
    this.filtro.set(id as Filtro);
  }

  abrir() {
    const hoy = new Date();
    this.formulario.reset({
      clienteId: '',
      fecha: `${hoy.getFullYear()}-${dosDigitos(hoy.getMonth() + 1)}-${dosDigitos(hoy.getDate())}`,
      hora: '20:00',
      personas: 2,
      mesaId: '',
      meseroId: ''
    });
    this.resumen.set(null);
    this.errorMesaSrv.set(null);
    this.exito.set(null);
    this.drawerAbierto.set(true);
  }

  cerrar() {
    this.drawerAbierto.set(false);
  }

  errorDe(campo: 'clienteId' | 'fecha' | 'hora' | 'personas'): string | null {
    const control = this.formulario.controls[campo];
    if (campo === 'fecha' && this.formulario.hasError('pasada') && (control.touched || this.formulario.touched)) {
      return 'No se puede reservar para una fecha que ya pasó.';
    }
    if (!control.touched || !control.invalid) {
      return null;
    }
    switch (campo) {
      case 'clienteId':
        return 'Elija un cliente.';
      case 'fecha':
        return 'La fecha es obligatoria.';
      case 'hora':
        return 'La hora es obligatoria.';
      default:
        return 'Debe ser al menos 1 persona.';
    }
  }

  guardar() {
    if (this.guardando()) {
      return;
    }
    this.errorMesaSrv.set(null);

    if (this.formulario.invalid) {
      this.formulario.markAllAsTouched();
      const campos = (['clienteId', 'fecha', 'hora', 'personas'] as const).filter((c) => this.errorDe(c));
      const n = Math.max(campos.length, 1);
      this.resumen.set({
        titulo: `Revise ${n} campo${n === 1 ? '' : 's'}`,
        texto: 'No se guardó nada todavía.'
      });
      return;
    }

    const v = this.formulario.getRawValue();
    const cliente = this.clientes().find((c) => c.id === Number(v.clienteId));
    this.guardando.set(true);
    this.resumen.set(null);

    this.api
      .post<ReservaDTO>('/api/reservas', {
        fechaHora: `${v.fecha}T${v.hora}:00`,
        numPersonas: Number(v.personas),
        clienteId: Number(v.clienteId),
        mesaId: v.mesaId ? Number(v.mesaId) : null,
        meseroId: v.meseroId ? Number(v.meseroId) : null
      })
      .subscribe({
        next: (creada) => {
          this.guardando.set(false);
          this.drawerAbierto.set(false);
          this.filtro.set('TODAS');
          this.resaltadoId.set(creada.id);
          this.exito.set(`Reserva de ${cliente?.nombre ?? creada.clienteNombre} registrada.`);
          this.cargar();
        },
        error: (err) => {
          this.guardando.set(false);
          if (err.status === 409 || err.status === 404) {
            // Mesa que no existe o que no alcanza: lo dice el salón.
            this.errorMesaSrv.set('Revise este campo.');
            this.resumen.set({ titulo: err.titulo, texto: 'Elija otra mesa o cambie el número de personas.' });
          } else if (err.status === 503) {
            this.resumen.set({ titulo: err.titulo, texto: 'Intente de nuevo en un momento o deje la mesa sin asignar.' });
          } else {
            this.resumen.set({ titulo: err.titulo, texto: 'No se guardó nada todavía.' });
          }
        }
      });
  }

  /** Confirmar y Cumplida se aplican de una vez; no borran nada. */
  cambiarEstado(reserva: ReservaDTO, nuevoEstado: EstadoReserva) {
    this.exito.set(null);
    this.error.set(null);
    this.api.patch<ReservaDTO>(`/api/reservas/${reserva.id}/estado`, { nuevoEstado }).subscribe({
      next: () => {
        const texto = nuevoEstado === 'CONFIRMADA' ? 'confirmada' : 'marcada como cumplida';
        this.resaltadoId.set(reserva.id);
        this.exito.set(`Reserva de ${reserva.clienteNombre} ${texto}.`);
        this.cargar();
      },
      error: (err) => this.error.set(err.titulo)
    });
  }

  pedir(accion: 'cancelar' | 'eliminar', reserva: ReservaDTO) {
    this.exito.set(null);
    this.error.set(null);
    this.dialogo.set({ accion, reserva });
  }

  cerrarDialogo() {
    this.dialogo.set(null);
  }

  confirmarDialogo() {
    const d = this.dialogo();
    if (!d || this.trabajando()) {
      return;
    }
    this.trabajando.set(true);
    const peticion: Observable<unknown> =
      d.accion === 'cancelar'
        ? this.api.patch<ReservaDTO>(`/api/reservas/${d.reserva.id}/estado`, { nuevoEstado: 'CANCELADA' })
        : this.api.delete<void>(`/api/reservas/${d.reserva.id}`);

    peticion.subscribe({
      next: () => {
        this.trabajando.set(false);
        this.dialogo.set(null);
        this.resaltadoId.set(d.accion === 'cancelar' ? d.reserva.id : null);
        this.exito.set(
          `Reserva de ${d.reserva.clienteNombre} ${d.accion === 'cancelar' ? 'cancelada' : 'eliminada'}.`
        );
        this.cargar();
      },
      error: (err) => {
        this.trabajando.set(false);
        this.dialogo.set(null);
        this.error.set(err.titulo);
      }
    });
  }

  /** «Hoy» si es el día de hoy; si no, «14 oct». */
  fecha(fechaHora: string): string {
    const d = new Date(fechaHora);
    const hoy = new Date();
    if (d.toDateString() === hoy.toDateString()) {
      return 'Hoy';
    }
    return `${d.getDate()} ${MESES[d.getMonth()]}`;
  }

  hora(fechaHora: string): string {
    return fechaHora.substring(11, 16);
  }

  mesa(mesaId: number | null): string {
    if (mesaId === null) {
      return '—';
    }
    const mesa = this.mesas().find((m) => m.id === mesaId);
    return `Mesa ${mesa ? mesa.numero : mesaId}`;
  }

  mesero(meseroId: number | null): string {
    if (meseroId === null) {
      return '—';
    }
    return this.meseros().find((u) => u.id === meseroId)?.nombre ?? '—';
  }

  private cumple(r: ReservaDTO, filtro: Filtro): boolean {
    switch (filtro) {
      case 'PENDIENTES':
        return r.estado === 'PENDIENTE';
      case 'CONFIRMADAS':
        return r.estado === 'CONFIRMADA';
      case 'CERRADAS':
        return r.estado === 'CUMPLIDA' || r.estado === 'CANCELADA';
      default:
        return true;
    }
  }

  /**
   * Trae las reservas y, para mostrar nombres en lugar de números, las mesas y
   * los usuarios. Si el salón o usuarios no responden, la tabla sale igual con
   * lo que haya.
   */
  private cargar() {
    this.cargando.set(true);
    forkJoin({
      reservas: this.api.get<ReservaDTO[]>('/api/reservas'),
      mesas: this.api.get<MesaDTO[]>('/api/mesas').pipe(catchError(() => of([] as MesaDTO[]))),
      usuarios: this.api.get<UsuarioDTO[]>('/api/usuarios').pipe(catchError(() => of([] as UsuarioDTO[]))),
      clientes: this.api.get<ClienteDTO[]>('/api/clientes').pipe(catchError(() => of([] as ClienteDTO[])))
    }).subscribe({
      next: ({ reservas, mesas, usuarios, clientes }) => {
        this.clientes.set(clientes);
        this.reservas.set(reservas);
        this.mesas.set(mesas);
        this.meseros.set(usuarios.filter((u) => u.rol === 'MESERO'));
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
