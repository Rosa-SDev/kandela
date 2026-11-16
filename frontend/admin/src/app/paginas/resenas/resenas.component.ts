import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { ResenaDTO } from '@compartido/api/tipos';
import { ErrorKandela } from '@compartido/api/errores';
import { ResenasService } from './resenas.service';
import { TituloComponent } from '../../componentes/titulo.component';
import { FiltrosComponent } from '../../componentes/filtros.component';
import { TablaComponent } from '../../componentes/tabla.component';
import { AvisoComponent } from '../../componentes/aviso.component';
import { EstadoComponent } from '../../componentes/estado.component';
import { BotonComponent } from '../../componentes/boton.component';

type Filtro = 'POR_REVISAR' | 'ABSTAIN' | 'QUEUE' | 'PASS' | 'TODAS';

/** Cada cuánto se buscan reseñas nuevas mientras la página está abierta. */
const CONSULTA_CADA_MS = 10_000;

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const VACIAS: Record<Filtro, string> = {
  POR_REVISAR: 'ninguna reseña espera revisión',
  ABSTAIN: 'el agente no ha dudado con ninguna',
  QUEUE: 'ninguna queja',
  PASS: 'ninguna almacenada',
  TODAS: 'todavía no llega ninguna'
};

/** Cómo se ve la decisión del agente: glifo y palabra, como el resto de Kandela. */
export function estadoDe(r: ResenaDTO): { glifo: string; texto: string; tono: '' | 'ate' | 'err' } {
  if (r.sinClasificar) {
    return { glifo: '◆', texto: 'Sin clasificar', tono: 'ate' };
  }
  switch (r.accion) {
    case 'ABSTAIN':
      return { glifo: '◆', texto: 'Requiere una persona', tono: 'ate' };
    case 'QUEUE':
      return { glifo: '!', texto: 'Queja', tono: 'err' };
    default:
      return { glifo: '✓', texto: 'Almacenada', tono: '' };
  }
}

/** Las que necesitan a la administradora: las dudas del agente y las quejas, sin revisar. */
export function esPorRevisar(r: ResenaDTO): boolean {
  return !r.revisada && r.accion !== 'PASS';
}

/**
 * Reseñas de los clientes, clasificadas por el agente SentiTriage-ES.
 *
 * Los clientes las dejan desde el QR de su mesa o de su factura. El agente
 * decide si cada una es una queja, si se puede almacenar o si debe leerla una
 * persona porque no está seguro. Aquí la administradora lee las que la
 * necesitan y las marca como revisadas.
 */
@Component({
  selector: 'app-resenas',
  standalone: true,
  imports: [TituloComponent, FiltrosComponent, TablaComponent, AvisoComponent, EstadoComponent, BotonComponent],
  styles: [`
    .rs-texto {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
      max-width: 60ch;
    }
    .rs-sin-dato {
      color: var(--texto-3);
    }
  `],
  template: `
    <div class="adm-cab">
      <app-titulo texto="Reseñas" [par]="porRevisar() + ' por revisar'"></app-titulo>
      <app-boton variante="texto" (accion)="cargar()">Actualizar</app-boton>
    </div>

    @if (error()) {
      <app-aviso tono="err" glifo="!" [titulo]="error()!"></app-aviso>
    }

    <app-filtros [items]="items()" [activo]="filtro()" (seleccion)="elegir($event)"></app-filtros>

    @if (exito()) {
      <app-aviso glifo="✓" [titulo]="exito()!"></app-aviso>
    }

    <app-tabla
      [columnas]="['Fecha', 'Reseña', 'Origen', 'Decisión del agente', 'Confianza', '']"
      [vacia]="!cargando() && visibles().length === 0"
      mensajeVacia="SIN RESEÑAS"
      [subMensajeVacia]="vacias[filtro()]">
      @for (r of visibles(); track r.id) {
        <tr [class.nueva]="nuevas().has(r.id)" [class.apagada]="r.revisada">
          <td><b>{{ fecha(r.fecha) }}</b></td>
          <td><span class="rs-texto" lang="es" [attr.title]="r.texto">{{ r.texto }}</span></td>
          <td>{{ origen(r) }}</td>
          <td>
            <app-estado [glifo]="estado(r).glifo" [texto]="estado(r).texto" [tono]="estado(r).tono"></app-estado>
          </td>
          <td>
            @if (r.confianza !== null) {
              {{ confianza(r.confianza) }}
            } @else {
              <span class="rs-sin-dato">—</span>
            }
          </td>
          <td class="acc">
            @if (r.sinClasificar) {
              <app-boton variante="texto" [disabled]="trabajando()" (accion)="volverAClasificar(r)">Clasificar de nuevo</app-boton>
            }
            @if (r.revisada) {
              <app-boton variante="texto-baja" [disabled]="trabajando()" (accion)="marcar(r, false)">Reabrir</app-boton>
            } @else if (porRevisarLa(r)) {
              <app-boton variante="texto" [disabled]="trabajando()" (accion)="marcar(r, true)">Marcar revisada</app-boton>
            }
          </td>
        </tr>
      }
    </app-tabla>
  `
})
export class ResenasComponent implements OnInit, OnDestroy {
  private resenasSrv = inject(ResenasService);

  resenas = signal<ResenaDTO[]>([]);
  numeroDeMesa = signal<Map<number, number>>(new Map());
  filtro = signal<Filtro>('POR_REVISAR');
  cargando = signal(true);
  trabajando = signal(false);
  error = signal<string | null>(null);
  exito = signal<string | null>(null);
  /** Las que llegaron desde la última consulta: se marcan con la franja de fila nueva. */
  nuevas = signal<Set<number>>(new Set());

  readonly vacias = VACIAS;
  readonly estado = estadoDe;
  readonly porRevisarLa = esPorRevisar;

  private temporizador: ReturnType<typeof setInterval> | undefined;
  private primeraCarga = true;

  porRevisar = computed(() => this.resenas().filter(esPorRevisar).length);

  items = computed(() => {
    const contar = (f: Filtro) => this.resenas().filter((r) => this.cumple(r, f)).length;
    return [
      { id: 'POR_REVISAR', texto: 'Por revisar', cantidad: contar('POR_REVISAR') },
      { id: 'ABSTAIN', texto: 'Requieren una persona', cantidad: contar('ABSTAIN') },
      { id: 'QUEUE', texto: 'Quejas', cantidad: contar('QUEUE') },
      { id: 'PASS', texto: 'Almacenadas', cantidad: contar('PASS') },
      { id: 'TODAS', texto: 'Todas', cantidad: contar('TODAS') }
    ];
  });

  visibles = computed(() => this.resenas().filter((r) => this.cumple(r, this.filtro())));

  ngOnInit() {
    this.cargar();
    this.temporizador = setInterval(() => this.cargar(true), CONSULTA_CADA_MS);
  }

  ngOnDestroy() {
    clearInterval(this.temporizador);
  }

  elegir(id: string) {
    this.filtro.set(id as Filtro);
  }

  /**
   * Trae las reseñas (el servidor ya las ordena de la más reciente a la más
   * antigua) y las mesas, para mostrar su número. Si el salón no responde, la
   * página sigue funcionando y la mesa se muestra por su id.
   *
   * @param silenciosa la consulta periódica: no limpia los avisos
   */
  cargar(silenciosa = false) {
    if (!silenciosa) {
      this.exito.set(null);
    }
    forkJoin({
      resenas: this.resenasSrv.listar(),
      mesas: this.resenasSrv.listarMesas().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ resenas, mesas }) => {
        if (!this.primeraCarga) {
          const conocidas = new Set(this.resenas().map((r) => r.id));
          const llegaron = resenas.filter((r) => !conocidas.has(r.id)).map((r) => r.id);
          if (llegaron.length > 0) {
            this.nuevas.set(new Set(llegaron));
          }
        }
        this.primeraCarga = false;
        this.resenas.set(resenas);
        this.numeroDeMesa.set(new Map(mesas.map((m) => [m.id, m.numero])));
        this.error.set(null);
        this.cargando.set(false);
      },
      error: (e: ErrorKandela) => {
        this.error.set(e.titulo);
        this.cargando.set(false);
      }
    });
  }

  marcar(r: ResenaDTO, revisada: boolean) {
    this.trabajando.set(true);
    this.resenasSrv.marcarRevisada(r.id, revisada).subscribe({
      next: (actualizada) => {
        this.reemplazar(actualizada);
        this.exito.set(revisada ? 'Reseña marcada como revisada.' : 'La reseña vuelve a estar por revisar.');
        this.trabajando.set(false);
      },
      error: (e: ErrorKandela) => {
        this.error.set(e.titulo);
        this.trabajando.set(false);
      }
    });
  }

  volverAClasificar(r: ResenaDTO) {
    this.trabajando.set(true);
    this.resenasSrv.volverAClasificar(r.id).subscribe({
      next: (clasificada) => {
        this.reemplazar(clasificada);
        this.exito.set(`El agente la clasificó: ${estadoDe(clasificada).texto.toLowerCase()}.`);
        this.trabajando.set(false);
      },
      error: (e: ErrorKandela) => {
        this.error.set(e.titulo);
        this.trabajando.set(false);
      }
    });
  }

  fecha(iso: string): string {
    const d = new Date(iso);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${d.getDate()} ${MESES[d.getMonth()]} · ${hh}:${mm}`;
  }

  origen(r: ResenaDTO): string {
    const partes: string[] = [];
    if (r.mesaId !== null) {
      partes.push(`Mesa ${this.numeroDeMesa().get(r.mesaId) ?? r.mesaId}`);
    }
    if (r.pedidoId !== null) {
      partes.push(`Pedido #${r.pedidoId}`);
    }
    return partes.length > 0 ? partes.join(' · ') : '—';
  }

  confianza(valor: number): string {
    return valor.toLocaleString('es-CO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  private cumple(r: ResenaDTO, f: Filtro): boolean {
    switch (f) {
      case 'POR_REVISAR':
        return esPorRevisar(r);
      case 'TODAS':
        return true;
      default:
        return r.accion === f;
    }
  }

  private reemplazar(actualizada: ResenaDTO) {
    this.resenas.update((lista) => lista.map((r) => (r.id === actualizada.id ? actualizada : r)));
  }
}
