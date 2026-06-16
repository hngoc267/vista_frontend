import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class VoucherService {
  // Nhớ kiểm tra xem port 5000 có đúng với port Backend của sếp đang chạy không nhé
  private apiUrl = 'http://localhost:5000/api/vouchers'; 

  constructor(private http: HttpClient) {}

  getAllVouchers(): Observable<any> {
    return this.http.get<any>(this.apiUrl);
  }
}