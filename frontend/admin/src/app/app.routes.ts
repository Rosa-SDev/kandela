import { Routes } from '@angular/router';
import { rolGuard } from './nucleo/rol.guard';
import { AdminShellComponent } from './shell/admin-shell.component';

// Componentes falsos para que no falle la compilación mientras los demás hacen sus pantallas
import { Component } from '@angular/core';
import { TituloComponent } from './componentes/titulo.component';

@Component({ standalone: true, template: '<app-titulo texto="Inicio de Sesión"></app-titulo>', imports: [TituloComponent] })
export class LoginFakeComponent {}

@Component({ standalone: true, template: '<app-titulo texto="Pantalla vacía"></app-titulo>', imports: [TituloComponent] })
export class DummyComponent {}

export const routes: Routes = [
  { path: 'login', component: LoginFakeComponent },
  {
    path: '',
    component: AdminShellComponent,
    canActivate: [rolGuard],
    children: [
      { path: 'operacion/mesas', component: DummyComponent },
      { path: 'operacion/pedidos', component: DummyComponent },
      { path: 'operacion/reservas', component: DummyComponent },
      { path: 'operacion', redirectTo: 'operacion/mesas', pathMatch: 'full' },
      
      { path: 'carta', component: DummyComponent },
      { path: 'clientes', component: DummyComponent },
      { path: 'facturas', component: DummyComponent },
      { path: 'usuarios', component: DummyComponent },
      
      { path: '', redirectTo: 'operacion/mesas', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: 'operacion/mesas' }
];