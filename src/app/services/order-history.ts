import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';

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

    const userId = this.getCurrentUserId();
    if (!userId) {
      return of({
        success: true,
        data: [],
        message: 'Vui long dang nhap de xem lich su don hang.',
      });
    }

    return this.http.get<any>(`${this.apiUrl}/${encodeURIComponent(userId)}`, { params });
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

  private getCurrentUserId(): string {
    if (typeof localStorage === 'undefined') {
      return '';
    }

    const rawUser = localStorage.getItem('user');
    if (!rawUser) {
      localStorage.removeItem('userId');
      return '';
    }

    try {
      const user = JSON.parse(rawUser);
      const userId = String(user?.User_id || user?.userId || '').trim();

      if (userId) {
        localStorage.setItem('userId', userId);
      } else {
        localStorage.removeItem('userId');
      }

      return userId;
    } catch (error) {
      console.error('Loi khi doc thong tin user tu localStorage', error);
      localStorage.removeItem('userId');
      return '';
    }
  }
}
