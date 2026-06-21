import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class VoucherService {
  private readonly apiUrl = `${environment.apiUrl}/vouchers`;

  constructor(private http: HttpClient) {}

  getMyVouchers(): Observable<any> {
    return this.http.get(`${this.apiUrl}/my-vouchers`);
  }
}
