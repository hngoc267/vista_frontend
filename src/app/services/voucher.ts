import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http'; 
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class VoucherService {
  private readonly apiUrl = `${environment.apiUrl}/vouchers`;

  constructor(private http: HttpClient) {}

  getMyVouchers(userId?: string): Observable<any> {
    let params = new HttpParams();
    
    if (userId) {
      params = params.set('userId', userId);
    }

    return this.http.get(`${this.apiUrl}/my-vouchers`, { params });
  }
}