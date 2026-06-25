import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http'; // Thêm HttpParams ở đây
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class VoucherService {
  private readonly apiUrl = `${environment.apiUrl}/vouchers`;

  constructor(private http: HttpClient) {}

  // Cập nhật hàm này để nhận thêm userId
  getMyVouchers(userId?: string): Observable<any> {
    let params = new HttpParams();
    
    // Nếu có userId truyền vào, tự động nối thêm '?userId=...' vào cuối URL
    if (userId) {
      params = params.set('userId', userId);
    }

    return this.http.get(`${this.apiUrl}/my-vouchers`, { params });
  }
}