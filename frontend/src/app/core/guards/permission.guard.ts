import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export function permissionGuard(permissionKey: string): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    if (authService.hasPermission(permissionKey)) {
      return true;
    }
    return router.createUrlTree(['/tickets']);
  };
}
