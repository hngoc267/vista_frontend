import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, throwError, of } from 'rxjs'; // Thêm throwError và of vào đây

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

    // 1. Lấy userId từ hàm tiện ích bên dưới (đã xử lý sẵn localStorage)
    const userId = this.getCurrentUserId();

    // 2. Nếu không có userId thì chặn gọi API
    if (!userId) {
      console.error('Không tìm thấy userId, chặn gọi API.');
      // Trả về mảng rỗng như cách bạn định làm ban đầu để giao diện không bị sụp
      return of({
        success: true,
        data: [],
        message: 'Vui lòng đăng nhập để xem lịch sử đơn hàng.',
      });
    }

    // 3. Nếu có userId hợp lệ thì gọi API
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

  markOrderReviewed(orderCode: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/mark-reviewed`, { Order_code: orderCode });
  }
}