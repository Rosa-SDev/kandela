import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { SesionService } from './sesion.service';

export const rolGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const sesionService = inject(SesionService);
  const usuario = sesionService.usuarioActual();

  if (usuario && usuario.rol === 'ADMINISTRADOR') {
    return true;
  }

  // Si no es administrador o no hay sesión, lo expulsamos al login
  return router.createUrlTree(['/login']);
};
