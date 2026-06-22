import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class OrderHistoryService {
  // Thay đổi domain và cổng nếu backend của bạn chạy ở link khác
  private apiUrl = 'http://localhost:5000/api/order-history'; 

  constructor(private http: HttpClient) {}

  // Truyền userId trực tiếp vào đường dẫn URL
  getOrderHistory(status: string = 'all'): Observable<any> {
    let params = new HttpParams();
    if (status && status !== 'all') {
      params = params.set('status', status);
    }
    
    // 1. Cố gắng lấy userId trực tiếp nếu bạn lưu là 'userId'
    let userId = localStorage.getItem('userId'); 
    
    // 2. Nếu không có, tìm trong object 'user' (dành cho trường hợp bạn lưu cả cục data user)
    if (!userId) {
      const userRaw = localStorage.getItem('user');
      if (userRaw) {
        try {
          const userObj = JSON.parse(userRaw);
          // Quét các tên biến Id thông dụng
          userId = userObj.User_id || userObj.id || userObj._id; 
        } catch (error) {
          console.error('Lỗi khi đọc thông tin user từ localStorage', error);
        }
      }
    }

    // 3. Cơ chế dự phòng: Nếu chưa đăng nhập hoặc lỗi, tạm lấy USR_002 để API không bị crash
    if (!userId) {
      userId = "USR_002"; 
    }
    
  // Nối ID vào URL thành dạng: http://localhost:5000/api/order-history/USR_003
  const url = `${this.apiUrl}/${userId}`;
  
  return this.http.get<any>(url, { params });
  }

  markOrderReceived(orderId: string): Observable<any> {
    return this.http.patch<any>(`${this.apiUrl}/${encodeURIComponent(orderId)}/received`, {});
  }
}
