import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { PedidoDTO, UsuarioDTO } from '@compartido/api/tipos';
import { ApiService } from '../../nucleo/api.service';
import { TituloComponent } from '../../componentes/titulo.component';
import { FiltrosComponent } from '../../componentes/filtros.component';
import { AvisoComponent } from '../../componentes/aviso.component';
import { EstadoComponent } from '../../componentes/estado.component';
import { BotonComponent } from '../../componentes/boton.component';
import { DrawerComponent } from '../../componentes/drawer.component';
import { DialogoComponent } from '../../componentes/dialogo.component';
import { esPedidoActivo } from '../mesas/estado-de-mesa';
import { ComandaComponent } from './comanda.component';
import { PedidosService } from './pedidos.service';
import { ETIQUETA_PEDIDO, dinero, estaEnCocina } from './estado-de-pedido';

type Grupo = 'activos' | 'cobrados' | 'cancelados' | 'todos';

/** Una fila de la tabla: el pedido con lo que hay que leer de él. */
interface FilaDePedido {
  pedido: PedidoDTO;
  destino: string;
  mesero: string;
  unidades: number;
  consumo: string;
}

/** A qué grupo pertenece cada pedido. */
const GRUPOS: Record<Grupo, (pedido: PedidoDTO) => boolean> = {
  activos: (pedido) => esPedidoActivo(pedido),
  cobrados: (pedido) => pedido.estado === 'PAGADO',
  cancelados: (pedido) => pedido.estado === 'CANCELADO',
  todos: () => true
};

/**
 * Los pedidos del salón desde administración.
 *
 * Administración no abre pedidos: los consulta y, si hace falta, los cancela.
 * De ahí que no haya botón de crear y que «Cancelar» solo salga en los que
 * siguen activos.
 *
 * Los usuarios se consultan aparte porque el pedido guarda el identificador
 * del mesero y no su nombre. Si esa consulta falla, la tabla se muestra igual
 * y la columna del mesero queda vacía.
 */
@Component({
  selector: 'app-pedidos',
  standalone: true,
  imports: [
    TituloComponent,
    FiltrosComponent,
    AvisoComponent,
    EstadoComponent,
    BotonComponent,
    DrawerComponent,
    DialogoComponent,
    ComandaComponent
  ],
  templateUrl: './pedidos.component.html'
})
export class PedidosComponent implements OnInit {
  private api = inject(ApiService);
  private pedidosService = inject(PedidosService);

  pedidos = signal<PedidoDTO[]>([]);
  usuarios = signal<UsuarioDTO[]>([]);

  cargando = signal(true);
  error = signal<string | null>(null);
  exito = signal<string | null>(null);
  grupo = signal<Grupo>('activos');

  etiqueta = ETIQUETA_PEDIDO;

  /** El pedido que se está mirando en el drawer, con su mesero ya resuelto. */
  verPedido = signal<FilaDePedido | null>(null);

  porCancelar = signal<FilaDePedido | null>(null);
  cancelando = signal(false);
  errorDelDialogo = signal<{ titulo: string; texto: string } | null>(null);

  cuantos = computed(() => {
    const pedidos = this.pedidos();
    return {
      activos: pedidos.filter(GRUPOS.activos).length,
      cobrados: pedidos.filter(GRUPOS.cobrados).length,
      cancelados: pedidos.filter(GRUPOS.cancelados).length,
      todos: pedidos.length
    };
  });

  filtros = computed(() => {
    const cuenta = this.cuantos();
    return [
      { id: 'activos', texto: 'Activos', cantidad: cuenta.activos },
      { id: 'cobrados', texto: 'Cobrados', cantidad: cuenta.cobrados },
      { id: 'cancelados', texto: 'Cancelados', cantidad: cuenta.cancelados },
      { id: 'todos', texto: 'Todos', cantidad: cuenta.todos }
    ];
  });

  /** Lo último abierto va arriba: es lo que el administrador está buscando. */
  filas = computed<FilaDePedido[]>(() => {
    const usuarios = this.usuarios();

    return this.pedidos()
      .filter(GRUPOS[this.grupo()])
      .sort((uno, otro) => otro.id - uno.id)
      .map((pedido) => {
        const mesero = usuarios.find((usuario) => usuario.id === pedido.meseroId);
        return {
          pedido,
          destino: `Mesa ${pedido.mesaNumero}`,
          mesero: mesero ? mesero.nombre : '—',
          unidades: pedido.platillos.length,
          consumo: dinero(pedido.total)
        };
      });
  });

  ngOnInit() {
    this.cargar();
  }

  elegir(grupo: string) {
    this.grupo.set(grupo as Grupo);
  }

  reintentar() {
    this.cargar();
  }

  esActivo(pedido: PedidoDTO): boolean {
    return esPedidoActivo(pedido);
  }

  ver(fila: FilaDePedido) {
    this.exito.set(null);
    this.verPedido.set(fila);
  }

  cerrarDrawer() {
    this.verPedido.set(null);
  }

  pedirCancelar(fila: FilaDePedido) {
    this.error.set(null);
    this.exito.set(null);
    this.errorDelDialogo.set(null);
    this.porCancelar.set(fila);
  }

  cancelarElDialogo() {
    this.porCancelar.set(null);
  }

  /**
   * Lo que pasa al cancelar este pedido, en el orden en que importa.
   *
   * Solo se nombra la cocina si la comanda está en sus manos: si el pedido
   * nunca salió del salón, el tablero de cocina no se entera de nada.
   */
  consecuenciasDeCancelar(fila: FilaDePedido): string[] {
    const consecuencias: string[] = [];
    if (estaEnCocina(fila.pedido.estado)) {
      consecuencias.push('La comanda sale del tablero de cocina.');
    }
    consecuencias.push(`La mesa ${fila.pedido.mesaNumero} queda libre.`);
    consecuencias.push('Un pedido cancelado no se puede reabrir ni cobrar.');
    return consecuencias;
  }

  /**
   * Cancela el pedido, o explica dentro del diálogo por qué no se pudo.
   *
   * El salón rechaza cancelar un pedido ya cobrado. Desde esta pantalla no
   * debería ofrecerse —«Cancelar» solo sale en los activos— pero la caja puede
   * haber cobrado mientras la tabla estaba abierta, y entonces el mensaje del
   * salón es la única explicación honesta.
   */
  confirmarCancelar() {
    const fila = this.porCancelar();
    if (!fila || this.cancelando()) {
      return;
    }
    this.cancelando.set(true);

    this.pedidosService.cancelar(fila.pedido.id).subscribe({
      next: (cancelado) => {
        this.pedidos.update((lista) => lista.map((p) => (p.id === cancelado.id ? cancelado : p)));
        this.exito.set(`Pedido #${cancelado.id} cancelado.`);
        this.cancelando.set(false);
        this.porCancelar.set(null);
        this.verPedido.set(null);
      },
      error: (err) => {
        this.cancelando.set(false);
        this.errorDelDialogo.set({
          titulo: err.titulo,
          texto: 'La tabla puede estar desactualizada; vuelva a cargarla.'
        });
      }
    });
  }

  private cargar() {
    this.cargando.set(true);
    this.error.set(null);

    forkJoin({
      pedidos: this.pedidosService.listar(),
      usuarios: this.api
        .get<UsuarioDTO[]>('/api/usuarios')
        .pipe(catchError(() => of([] as UsuarioDTO[])))
    }).subscribe({
      next: ({ pedidos, usuarios }) => {
        this.pedidos.set(pedidos);
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
