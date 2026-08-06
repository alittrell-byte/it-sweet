import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, from, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

const PUBLIC_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const token = authService.getAccessToken();
  const isPublic = PUBLIC_PATHS.some((p) => req.url.includes(p));

  const authedReq = token && !isPublic ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authedReq).pipe(
    catchError((err: HttpErrorResponse) => {
      if (err.status !== 401 || isPublic) {
        return throwError(() => err);
      }
      // Access token expired mid-session: refresh once via the httpOnly cookie and retry.
      return from(authService.refreshAccessToken()).pipe(
        switchMap((newToken) => next(req.clone({ setHeaders: { Authorization: `Bearer ${newToken}` } }))),
        catchError((refreshErr) => throwError(() => refreshErr))
      );
    })
  );
};
