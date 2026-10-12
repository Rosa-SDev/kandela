import { Component, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { catchError, debounceTime, distinctUntilChanged, EMPTY, forkJoin, map, switchMap } from 'rxjs';
import { ClienteDTO, ReservaDTO } from '@compartido/api/tipos';
import { ApiService } from '../../nucleo/api.service';
import { TituloComponent } from '../../componentes/titulo.component';
import { TablaComponent } from '../../componentes/tabla.component';
import { AvisoComponent } from '../../componentes/aviso.component';
import { CampoComponent } from '../../componentes/campo.component';

@Component({
  selector: 'app-clientes',
  standalone: true,
  imports: [ReactiveFormsModule, TituloComponent, TablaComponent, AvisoComponent, CampoComponent],
  template: `
    <div class="adm-cab">
      <app-titulo texto="Clientes" [par]="total() + ' registrados'"></app-titulo>
    </div>

    @if (error()) {
      <app-aviso tono="err" glifo="!" [titulo]="error()!"></app-aviso>
    }

    <div style="max-width: 420px; margin: var(--s4) 0 var(--s2)">
      <app-campo label="Buscar por nombre" [formControl]="busqueda"></app-campo>
    </div>

    <app-tabla
      [columnas]="['Nombre', 'Documento', 'Teléfono', 'Reservas']"
      [vacia]="!cargando() && clientes().length === 0"
      [mensajeVacia]="termino() ? 'SIN RESULTADOS' : 'SIN CLIENTES'"
      [subMensajeVacia]="termino() ? 'ningún cliente se llama «' + termino() + '»' : null">
      @for (c of clientes(); track c.id) {
        <tr>
          <td><b>{{ c.nombre }}</b></td>
          <td>{{ c.documento }}</td>
          <td>{{ c.telefono ?? '—' }}</td>
          <td>{{ reservasPorCliente()[c.id] ?? 0 }}</td>
        </tr>
      }
    </app-tabla>
  `
})
export class ClientesComponent implements OnInit {
  private api = inject(ApiService);

  clientes = signal<ClienteDTO[]>([]);
  total = signal(0);
  reservasPorCliente = signal<Record<number, number>>({});
  termino = signal('');
  cargando = signal(true);
  error = signal<string | null>(null);

  busqueda = new FormControl('', { nonNullable: true });

  constructor() {
    // Busca en el servidor 300 ms después de que la persona deja de escribir.
    this.busqueda.valueChanges
      .pipe(
        debounceTime(300),
        map((texto) => texto.trim()),
        distinctUntilChanged(),
        switchMap((texto) =>
          this.api
            .get<ClienteDTO[]>(
              texto ? `/api/clientes?nombre=${encodeURIComponent(texto)}` : '/api/clientes'
            )
            .pipe(
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
  }

  ngOnInit() {
    this.cargar();
  }

  private cargar() {
    this.cargando.set(true);
    this.error.set(null);

    forkJoin({
      clientes: this.api.get<ClienteDTO[]>('/api/clientes'),
      reservas: this.api.get<ReservaDTO[]>('/api/reservas')
    }).subscribe({
      next: ({ clientes, reservas }) => {
        const cuenta: Record<number, number> = {};
        for (const reserva of reservas) {
          cuenta[reserva.clienteId] = (cuenta[reserva.clienteId] ?? 0) + 1;
        }
        this.reservasPorCliente.set(cuenta);
        this.clientes.set(clientes);
        this.total.set(clientes.length);
        this.cargando.set(false);
      },
      error: (err) => {
        this.error.set(err.titulo);
        this.cargando.set(false);
      }
    });
  }
}