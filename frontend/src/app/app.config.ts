import { APP_INITIALIZER, ApplicationConfig, provideZoneChangeDetection } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { provideQuillConfig } from 'ngx-quill/config';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { AuthService } from './core/services/auth.service';

function initializeAuth(authService: AuthService) {
  // Attempt to restore a session from the refresh cookie before the router's first
  // navigation runs, so auth guards see the correct state instead of bouncing to /login.
  return () => authService.tryRestoreSession();
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideZoneChangeDetection({ eventCoalescing: true }),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideQuillConfig({}),
    { provide: APP_INITIALIZER, useFactory: initializeAuth, deps: [AuthService], multi: true },
  ],
};
