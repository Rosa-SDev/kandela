import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormsModule, FormBuilder, Validators } from '@angular/forms';
import { CartaService } from './carta.service';
import { TituloComponent } from '../../componentes/titulo.component';
import { FiltrosComponent, FiltroItem } from '../../componentes/filtros.component';
import { BotonComponent } from '../../componentes/boton.component';
import { DrawerComponent } from '../../componentes/drawer.component';
import { DialogoComponent } from '../../componentes/dialogo.component';
import { CampoComponent } from '../../componentes/campo.component';
import { CampoOpcionesComponent } from '../../componentes/campo-opciones.component';
import { EstadoComponent } from '../../componentes/estado.component';
import { AvisoComponent } from '../../componentes/aviso.component';
import { PlatilloDTO, CrearPlatillo } from '@compartido/api/tipos';
import { ErrorKandela } from '@compartido/api/errores';

@Component({
  selector: 'app-carta',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule,
    FormsModule,
    TituloComponent, 
    FiltrosComponent, 
    BotonComponent, 
    DrawerComponent,
    DialogoComponent,
    CampoComponent,
    CampoOpcionesComponent,
    EstadoComponent,
    AvisoComponent
  ],
  templateUrl: './carta.component.html'
})
export class CartaComponent implements OnInit {
  private cartaSrv = inject(CartaService);
  private fb = inject(FormBuilder);

  platillos = signal<PlatilloDTO[]>([]);
  categoriaActiva = signal('todas');
  cargando = signal(false);

  // Avisos del sistema
  errorSrv = signal<{ titulo: string; texto: string } | null>(null);
  avisoOk = signal<{ titulo: string; texto: string } | null>(null);

  categoriasDisponibles = ['Entradas', 'Platos fuertes', 'Bebidas', 'Postres'];

  // Pestañas / Filtros calculados dinámicamente con cantidad
  filtrosCategorias = computed<FiltroItem[]>(() => {
    const list = this.platillos();
    const items: FiltroItem[] = [
      { id: 'todas', texto: 'Todas', cantidad: list.length }
    ];

    for (const cat of this.categoriasDisponibles) {
      const cantidad = list.filter(p => p.categoria.toLowerCase() === cat.toLowerCase()).length;
      items.push({ id: cat, texto: cat, cantidad });
    }
    return items;
  });

  // Platillos según la categoría activa
  platillosFiltrados = computed<PlatilloDTO[]>(() => {
    const cat = this.categoriaActiva();
    const list = this.platillos();
    if (cat === 'todas') return list;
    return list.filter(p => p.categoria.toLowerCase() === cat.toLowerCase());
  });

  // Drawer (Crear / Editar)
  drawerAbierto = signal(false);
  editandoId = signal<number | null>(null);

  formulario = this.fb.nonNullable.group({
    nombre: ['', Validators.required],
    descripcion: [''],
    categoria: ['Entradas', Validators.required],
    precio: [0, [Validators.required, Validators.min(1)]],
    disponible: ['Disponible', Validators.required]
  });

  // Diálogo de Descuento
  dialogoDescuento = signal(false);
  platilloDescuento = signal<PlatilloDTO | null>(null);
  porcentajeDescuento = signal<number | null>(null);
  errorDescuento = signal<string | null>(null);

  descuentoCalculado = computed(() => {
    const p = this.platilloDescuento();
    const pct = this.porcentajeDescuento();
    if (!p || pct === null || isNaN(pct) || pct <= 0 || pct > 100) return null;
    return Math.round(p.precio * (1 - pct / 100));
  });

  ayudaDescuento = computed(() => {
    const p = this.platilloDescuento();
    if (!p) return '';
    const nuevo = this.descuentoCalculado();
    if (nuevo !== null) {
      return `Precio nuevo: $${nuevo.toLocaleString('es-CO')} (antes $${p.precio.toLocaleString('es-CO')}).`;
    }
    return `Precio actual: $${p.precio.toLocaleString('es-CO')}.`;
  });

  descuentoValido = computed(() => {
    const pct = this.porcentajeDescuento();
    return pct !== null && !isNaN(pct) && pct > 0 && pct <= 100;
  });

  // Diálogo de Eliminar
  dialogoEliminar = signal(false);
  platilloEliminar = signal<PlatilloDTO | null>(null);

  ngOnInit() {
    this.cargarPlatillos();
  }

  cargarPlatillos() {
    this.cargando.set(true);
    this.errorSrv.set(null);

    this.cartaSrv.listar().subscribe({
      next: (datos) => {
        this.platillos.set(datos);
        this.cargando.set(false);
      },
      error: (err: ErrorKandela) => {
        this.cargando.set(false);
        this.errorSrv.set({
          titulo: 'El servicio de carta no está disponible en este momento.',
          texto: err?.titulo || 'No se pudo obtener la lista de platillos.'
        });
      }
    });
  }

  cambiarCategoria(catId: string) {
    this.categoriaActiva.set(catId);
  }

  formatearDinero(valor: number): string {
    return '$' + valor.toLocaleString('es-CO');
  }

  // Métodos del Drawer
  abrirCrear() {
    this.editandoId.set(null);
    this.formulario.reset({
      nombre: '',
      descripcion: '',
      categoria: 'Entradas',
      precio: 0,
      disponible: 'Disponible'
    });
    this.drawerAbierto.set(true);
  }

  abrirEditar(platillo: PlatilloDTO) {
    this.editandoId.set(platillo.id);
    this.formulario.patchValue({
      nombre: platillo.nombre,
      descripcion: platillo.descripcion || '',
      categoria: platillo.categoria,
      precio: platillo.precio,
      disponible: platillo.disponible ? 'Disponible' : 'Agotado'
    });
    this.drawerAbierto.set(true);
  }

  cerrarDrawer() {
    this.drawerAbierto.set(false);
    this.editandoId.set(null);
  }

  guardar() {
    if (this.formulario.invalid) return;

    const val = this.formulario.getRawValue();
    const datos: CrearPlatillo = {
      nombre: val.nombre.trim(),
      descripcion: val.descripcion?.trim() || undefined,
      categoria: val.categoria,
      precio: Number(val.precio),
      disponible: val.disponible === 'Disponible'
    };

    const id = this.editandoId();
    if (id) {
      this.cartaSrv.actualizar(id, datos).subscribe({
        next: (res) => {
          this.cerrarDrawer();
          this.avisoOk.set({
            titulo: 'Cambios guardados',
            texto: `Cambios de ${res.nombre} guardados.`
          });
          this.cargarPlatillos();
        },
        error: (err: ErrorKandela) => {
          this.errorSrv.set({
            titulo: err.titulo || 'No se pudo actualizar el platillo.',
            texto: err.texto || ''
          });
        }
      });
    } else {
      this.cartaSrv.crear(datos).subscribe({
        next: (res) => {
          this.cerrarDrawer();
          this.avisoOk.set({
            titulo: 'Platillo guardado',
            texto: `${res.nombre} agregado a la carta.`
          });
          this.cargarPlatillos();
        },
        error: (err: ErrorKandela) => {
          this.errorSrv.set({
            titulo: err.titulo || 'No se pudo crear el platillo.',
            texto: err.texto || ''
          });
        }
      });
    }
  }

  // Métodos de Descuento
  abrirDescuento(platillo: PlatilloDTO) {
    this.platilloDescuento.set(platillo);
    this.porcentajeDescuento.set(null);
    this.errorDescuento.set(null);
    this.dialogoDescuento.set(true);
  }

  cerrarDescuento() {
    this.dialogoDescuento.set(false);
    this.platilloDescuento.set(null);
    this.porcentajeDescuento.set(null);
    this.errorDescuento.set(null);
  }

  confirmarDescuento() {
    const p = this.platilloDescuento();
    const pct = this.porcentajeDescuento();
    if (!p || !this.descuentoValido() || pct === null) return;

    this.cartaSrv.aplicarDescuento(p.id, Number(pct)).subscribe({
      next: (actualizado) => {
        this.cerrarDescuento();
        this.avisoOk.set({
          titulo: 'Descuento aplicado',
          texto: `${actualizado.nombre} ahora cuesta $${actualizado.precio.toLocaleString('es-CO')}.`
        });
        this.cargarPlatillos();
      },
      error: (err: ErrorKandela) => {
        this.errorDescuento.set(err.titulo || 'No se pudo aplicar el descuento.');
      }
    });
  }

  // Métodos de Eliminar
  abrirEliminar(platillo: PlatilloDTO) {
    this.platilloEliminar.set(platillo);
    this.dialogoEliminar.set(true);
  }

  abrirEliminarDesdeDrawer() {
    const id = this.editandoId();
    if (!id) return;
    const p = this.platillos().find(x => x.id === id);
    if (p) {
      this.abrirEliminar(p);
    }
  }

  cerrarEliminar() {
    this.dialogoEliminar.set(false);
    this.platilloEliminar.set(null);
  }

  confirmarEliminar() {
    const p = this.platilloEliminar();
    if (!p) return;

    this.cartaSrv.eliminar(p.id).subscribe({
      next: () => {
        this.cerrarEliminar();
        this.cerrarDrawer();
        this.avisoOk.set({
          titulo: 'Platillo eliminado',
          texto: `${p.nombre} eliminado de la carta.`
        });
        this.cargarPlatillos();
      },
      error: (err: ErrorKandela) => {
        this.errorSrv.set({
          titulo: err.titulo || 'No se pudo eliminar el platillo.',
          texto: err.texto || ''
        });
        this.cerrarEliminar();
      }
    });
  }
}
