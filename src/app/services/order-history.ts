import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class OrderHistory {
  private apiUrl = 'http://localhost:5000/api/order-history';

  constructor(private http: HttpClient) {}

  getOrderHistory(status: string = 'all'): Observable<any> {
    let params = new HttpParams();
    if (status && status !== 'all') {
      params = params.set('status', status);
    }

    let userId = localStorage.getItem('userId');

    if (!userId) {
      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        try {
          const userObj = JSON.parse(userRaw);
          userId = userObj.User_id || userObj.id || userObj._id;
        } catch (error) {
          console.error('Loi khi doc thong tin user tu localStorage', error);
        }
      }
    }

    if (!userId) {
      userId = 'USR_002';
    }

    return this.http.get<any>(`${this.apiUrl}/${userId}`, { params });
  }

  markOrderReceived(orderId: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${encodeURIComponent(orderId)}/received`, {});
  }

  cancelOrder(orderId: string, reason: string): Observable<any> {
    return this.http.patch<any>(
      `${this.apiUrl}/${encodeURIComponent(orderId)}/cancel`,
      { reason }
    );
  }
  // --- THÊM HÀM NÀY ĐỂ GỌI API ĐÁNH GIÁ ---
  markOrderReviewed(orderCode: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/mark-reviewed`, { Order_code: orderCode });
  }
}
