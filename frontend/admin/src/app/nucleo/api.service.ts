import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { catchError, throwError } from 'rxjs';
import { traducirError } from '@compartido/api/errores';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private http = inject(HttpClient);

  get<T>(url: string) {
    return this.http.get<T>(url).pipe(catchError(this.handleError));
  }

  post<T>(url: string, body: any) {
    return this.http.post<T>(url, body).pipe(catchError(this.handleError));
  }

  put<T>(url: string, body: any) {
    return this.http.put<T>(url, body).pipe(catchError(this.handleError));
  }

  patch<T>(url: string, body: any) {
    return this.http.patch<T>(url, body).pipe(catchError(this.handleError));
  }

  delete<T>(url: string) {
    return this.http.delete<T>(url).pipe(catchError(this.handleError));
  }

  private handleError(error: HttpErrorResponse) {
    return throwError(() => traducirError(error.status, error.error));
  }
}
