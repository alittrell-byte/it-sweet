import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Passes if the user holds ANY of the given permission keys (matches the backend's requirePermission). */
export function permissionGuard(...permissionKeys: string[]): CanActivateFn {
  return () => {
    const authService = inject(AuthService);
    const router = inject(Router);
    if (permissionKeys.some((key) => authService.hasPermission(key))) {
      return true;
    }
    return router.createUrlTree(['/tickets']);
  };
}
