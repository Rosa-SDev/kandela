import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { Rol, UsuarioDTO } from '@compartido/api/tipos';
import { ApiService } from '../../nucleo/api.service';
import { TituloComponent } from '../../componentes/titulo.component';
import { FiltrosComponent } from '../../componentes/filtros.component';
import { TablaComponent } from '../../componentes/tabla.component';
import { AvisoComponent } from '../../componentes/aviso.component';

type Filtro = 'TODOS' | Rol;

@Component({
  selector: 'app-usuarios',
  standalone: true,
  imports: [TituloComponent, FiltrosComponent, TablaComponent, AvisoComponent],
  template: `
    <div class="adm-cab">
      <app-titulo texto="Usuarios" [par]="usuarios().length + ' registrados'"></app-titulo>
    </div>

    @if (error()) {
      <app-aviso tono="err" glifo="!" [titulo]="error()!"></app-aviso>
    }

    <app-filtros [items]="items()" [activo]="filtro()" (seleccion)="elegir($event)"></app-filtros>

    <app-tabla
      [columnas]="['Nombre', 'Correo', 'Rol']"
      [vacia]="!cargando() && visibles().length === 0"
      mensajeVacia="SIN USUARIOS">
      @for (u of visibles(); track u.id) {
        <tr>
          <td><b>{{ u.nombre }}</b></td>
          <td>{{ u.correo }}</td>
          <td>{{ etiqueta[u.rol] }}</td>
        </tr>
      }
    </app-tabla>
  `
})
export class UsuariosComponent implements OnInit {
  private api = inject(ApiService);

  usuarios = signal<UsuarioDTO[]>([]);
  filtro = signal<Filtro>('TODOS');
  cargando = signal(true);
  error = signal<string | null>(null);

  readonly etiqueta: Record<Rol, string> = {
    ADMINISTRADOR: 'Administrador',
    MESERO: 'Mesero',
    COCINERO: 'Cocinero',
    CAJERO: 'Cajero'
  };

  private readonly roles: Rol[] = ['ADMINISTRADOR', 'MESERO', 'COCINERO', 'CAJERO'];

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

  ngOnInit() {
    this.cargar();
  }

  elegir(id: string) {
    this.filtro.set(id as Filtro);
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