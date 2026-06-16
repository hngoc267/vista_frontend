import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class VoucherService {
  private apiUrl = 'http://localhost:5000/api/vouchers';

  constructor(private http: HttpClient) {}

  getMyVouchers(): Observable<any> {
    return this.http.get(`${this.apiUrl}/my-vouchers`);
  }
}