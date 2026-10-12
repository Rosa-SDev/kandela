import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { catchError, forkJoin, of } from 'rxjs';
import { MesaDTO, PedidoDTO, ReservaDTO, UsuarioDTO } from '@compartido/api/tipos';
import { ApiService } from '../../nucleo/api.service';
import { TituloComponent } from '../../componentes/titulo.component';
import { TablaComponent } from '../../componentes/tabla.component';
import { AvisoComponent } from '../../componentes/aviso.component';
import { EstadoComponent } from '../../componentes/estado.component';
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
  imports: [TituloComponent, TablaComponent, AvisoComponent, EstadoComponent],
  templateUrl: './mesas.component.html'
})
export class MesasComponent implements OnInit {
  private api = inject(ApiService);
  private mesasService = inject(MesasService);

  mesas = signal<MesaDTO[]>([]);
  pedidos = signal<PedidoDTO[]>([]);
  reservas = signal<ReservaDTO[]>([]);
  usuarios = signal<UsuarioDTO[]>([]);

  cargando = signal(true);
  error = signal<string | null>(null);

  etiqueta = ETIQUETA_MESA;

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
