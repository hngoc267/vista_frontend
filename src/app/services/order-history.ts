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

    let userId = localStorage.getItem('userId');

    if (!userId) {
      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        try {
          const userObj = JSON.parse(userRaw);
          userId = userObj.User_id || userObj.id || userObj._id;
        } catch (error) {
          console.error('Lỗi khi đọc thông tin user từ localStorage', error);
        }
      }
    }

    // --- ĐOẠN ĐÃ SỬA ---
    if (!userId) {
      // Nếu hoàn toàn không tìm thấy userId, lập tức báo lỗi hoặc trả về danh sách rỗng
      // Không được tự ý gán thành USR_002 nữa!
      console.error('Không tìm thấy userId, chặn gọi API.');
      return throwError(() => new Error('Vui lòng đăng nhập để xem lịch sử đơn hàng.'));
      
      // Hoặc nếu muốn trả về mảng rỗng để giao diện tự hiện thông báo "Không có đơn hàng":
      // return of({ success: true, data: [] }); 
    }
    // -------------------

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

  markOrderReviewed(orderCode: string): Observable<any> {
    return this.http.put<any>(`${this.apiUrl}/mark-reviewed`, { Order_code: orderCode });
  }
}