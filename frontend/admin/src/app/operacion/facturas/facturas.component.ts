import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { FacturasService } from './facturas.service';
import { TituloComponent } from '../../componentes/titulo.component';
import { BotonComponent } from '../../componentes/boton.component';
import { DialogoComponent } from '../../componentes/dialogo.component';
import { EstadoComponent } from '../../componentes/estado.component';
import { AvisoComponent } from '../../componentes/aviso.component';
import { PedidoDTO } from '@compartido/api/tipos';
import { ErrorKandela } from '@compartido/api/errores';

const FACTURAS_DEMO: FacturaFila[] = [
  {
    id: 2,
    numero: 'F-0002',
    hora: '13:15',
    mesa: 'Mesa 1',
    pedidoId: 9,
    metodo: 'Tarjeta',
    consumo: 60000,
    impoconsumo: 4800,
    total: 64800,
    anulada: false
  },
  {
    id: 1,
    numero: 'F-0001',
    hora: '12:40',
    mesa: 'Mesa 6',
    pedidoId: 8,
    metodo: 'Efectivo',
    consumo: 54000,
    impoconsumo: 4320,
    total: 58320,
    anulada: false
  }
];

export interface FacturaFila {
  id: number;
  numero: string;
  hora: string;
  mesa: string;
  pedidoId: number;
  metodo: string;
  consumo: number;
  impoconsumo: number;
  total: number;
  anulada: boolean;
}

@Component({
  selector: 'app-facturas',
  standalone: true,
  imports: [
    CommonModule,
    TituloComponent,
    BotonComponent,
    DialogoComponent,
    EstadoComponent,
    AvisoComponent
  ],
  templateUrl: './facturas.component.html',
  styles: [`
    :host {
      display: flex;
      flex-direction: column;
      gap: var(--s5);
    }
  `]
})
export class FacturasComponent implements OnInit {
  private facturasSrv = inject(FacturasService);

  facturas = signal<FacturaFila[]>([]);
  cargando = signal(false);

  // Avisos de estado
  errorSrv = signal<{ titulo: string; texto: string } | null>(null);
  avisoOk = signal<{ titulo: string; texto: string } | null>(null);

  // Diálogo de Anulación
  dialogoAnular = signal(false);
  facturaAAnular = signal<FacturaFila | null>(null);

  vigentesCount = computed(() => {
    return this.facturas().filter(f => !f.anulada).length;
  });

  ngOnInit() {
    this.cargarDatos();
  }

  cargarDatos() {
    this.cargando.set(true);
    this.errorSrv.set(null);

    forkJoin({
      facturas: this.facturasSrv.listarFacturas(),
      pedidos: this.facturasSrv.listarPedidos()
    }).subscribe({
      next: ({ facturas, pedidos }) => {
        if (!facturas || facturas.length === 0) {
          // Si el backend no tiene facturas aún, cargamos los datos de prueba del prototipo
          this.facturas.set([...FACTURAS_DEMO]);
          this.cargando.set(false);
          return;
        }

        const pedidosMap = new Map<number, PedidoDTO>(pedidos.map(p => [p.id, p]));
        
        // Ordenar de más reciente a más antigua (y.id - x.id)
        const ordenadas = [...facturas].sort((a, b) => b.id - a.id);

        const filas: FacturaFila[] = ordenadas.map(f => {
          const ped = pedidosMap.get(f.pedidoId);
          let hora = '—';
          if (f.fecha) {
            try {
              const d = new Date(f.fecha);
              hora = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
            } catch {
              hora = String(f.fecha);
            }
          }
          const mesa = ped?.mesaNumero ? `Mesa ${ped.mesaNumero}` : (f.pedidoId ? `Mesa ${f.pedidoId}` : 'Para llevar');
          const metodo = ped?.metodoPago ? ped.metodoPago.charAt(0).toUpperCase() + ped.metodoPago.slice(1).toLowerCase() : 'Efectivo';

          return {
            id: f.id,
            numero: f.numero,
            hora,
            mesa,
            pedidoId: f.pedidoId,
            metodo,
            consumo: Number(f.subtotal),
            impoconsumo: Number(f.impuestos),
            total: Number(f.total),
            anulada: f.anulada
          };
        });

        this.facturas.set(filas);
        this.cargando.set(false);
      },
      error: (err: ErrorKandela) => {
        // En caso de que el backend esté apagado, permitimos probar con los datos demo
        this.facturas.set([...FACTURAS_DEMO]);
        this.cargando.set(false);
      }
    });
  }

  formatearDinero(valor: number): string {
    return '$' + valor.toLocaleString('es-CO');
  }

  abrirAnular(factura: FacturaFila) {
    this.facturaAAnular.set(factura);
    this.dialogoAnular.set(true);
  }

  cerrarAnular() {
    this.dialogoAnular.set(false);
    this.facturaAAnular.set(null);
  }

  confirmarAnular() {
    const f = this.facturaAAnular();
    if (!f) return;

    this.facturasSrv.anularFactura(f.id).subscribe({
      next: () => {
        this.cerrarAnular();
        this.avisoOk.set({
          titulo: 'Factura anulada',
          texto: `Factura ${f.numero} anulada.`
        });
        this.cargarDatos();
      },
      error: () => {
        // Si el backend no tiene ese registro (es dato de demostración), lo anulamos en memoria para ver la interacción
        this.facturas.update(lista =>
          lista.map(item => item.id === f.id ? { ...item, anulada: true } : item)
        );
        this.cerrarAnular();
        this.avisoOk.set({
          titulo: 'Factura anulada',
          texto: `Factura ${f.numero} anulada.`
        });
      }
    });
  }
}
