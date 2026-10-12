import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { EstadoReserva, MesaDTO, ReservaDTO, UsuarioDTO } from '@compartido/api/tipos';
import { ApiService } from '../../nucleo/api.service';
import { TituloComponent } from '../../componentes/titulo.component';
import { FiltrosComponent } from '../../componentes/filtros.component';
import { TablaComponent } from '../../componentes/tabla.component';
import { AvisoComponent } from '../../componentes/aviso.component';
import { EstadoComponent } from '../../componentes/estado.component';

type Filtro = 'TODAS' | 'PENDIENTES' | 'CONFIRMADAS' | 'CERRADAS';

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
  imports: [TituloComponent, FiltrosComponent, TablaComponent, AvisoComponent, EstadoComponent],
  template: `
    <div class="adm-cab">
      <app-titulo texto="Reservas" [par]="vigentes() + ' vigentes'"></app-titulo>
    </div>

    @if (error()) {
      <app-aviso tono="err" glifo="!" [titulo]="error()!"></app-aviso>
    }

    <app-filtros [items]="items()" [activo]="filtro()" (seleccion)="elegir($event)"></app-filtros>

    <app-tabla
      [columnas]="['Fecha', 'Hora', 'Cliente', 'Personas', 'Mesa', 'Mesero', 'Estado']"
      [vacia]="!cargando() && visibles().length === 0"
      mensajeVacia="SIN RESERVAS">
      @for (r of visibles(); track r.id) {
        <tr>
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
        </tr>
      }
    </app-tabla>
  `
})
export class ReservasComponent implements OnInit {
  private api = inject(ApiService);

  reservas = signal<ReservaDTO[]>([]);
  mesas = signal<MesaDTO[]>([]);
  meseros = signal<UsuarioDTO[]>([]);
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
      usuarios: this.api.get<UsuarioDTO[]>('/api/usuarios').pipe(catchError(() => of([] as UsuarioDTO[])))
    }).subscribe({
      next: ({ reservas, mesas, usuarios }) => {
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
