import { Routes } from '@angular/router';
import { rolGuard } from './nucleo/rol.guard';
import { AdminShellComponent } from './shell/admin-shell.component';
import { LoginComponent } from './acceso/login.component';

// Componentes falsos para que no falle la compilación mientras los demás hacen sus pantallas
import { Component } from '@angular/core';
import { TituloComponent } from './componentes/titulo.component';

@Component({ standalone: true, template: '<app-titulo texto="Pantalla vacía"></app-titulo>', imports: [TituloComponent] })
export class DummyComponent {}

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: '',
    component: AdminShellComponent,
    canActivate: [rolGuard],
    children: [
      { path: 'operacion/mesas', component: DummyComponent },
      { path: 'operacion/pedidos', component: DummyComponent },
      { path: 'operacion/reservas', component: DummyComponent },
      { path: 'operacion', redirectTo: 'operacion/mesas', pathMatch: 'full' },
      
      { path: 'carta', loadComponent: () => import('./operacion/carta/carta.component').then(m => m.CartaComponent) },
      { path: 'operacion/carta', redirectTo: 'carta', pathMatch: 'full' },
      { path: 'clientes', component: DummyComponent },
      { path: 'facturas', component: DummyComponent },
      { path: 'usuarios', component: DummyComponent },
      
      { path: '', redirectTo: 'operacion/mesas', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: 'operacion/mesas' }
];