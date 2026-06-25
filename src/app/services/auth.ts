import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:5000/api';
  private currentUserSubject = new BehaviorSubject<any>(this.getUserFromStorage());
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {}

// 4. Hàm đọc dữ liệu an toàn (THAY THẾ HÀM CŨ BẰNG HÀM NÀY)
  private getUserFromStorage(): any {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      try {
        let parsedUser = JSON.parse(user);
        if (parsedUser) {
          // Khớp lệnh: Lấy Total_spent từ MongoDB gán cho Angular
          parsedUser.totalSpent = parsedUser.Total_spent || parsedUser.totalSpent || 0;
          const tierInfo = this.calculateTier(parsedUser.totalSpent);
          parsedUser.tierName = tierInfo.name;
          parsedUser.tierLevel = tierInfo.level;
        }
        return parsedUser;
      } catch (e) {
        return null;
      }
    }
    return null;
  }

  // Đăng ký
  register(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, data).pipe(
      tap((res: any) => {
        if (res.success) {
          localStorage.setItem('token', res.token);
          this.updateLocalUser(res.user);
        }
      })
    );
  }

  // Đăng nhập
  login(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login`, data).pipe(
      tap((res: any) => {
        if (res.success) {
          localStorage.setItem('token', res.token);
          this.updateLocalUser(res.user);
        }
      })
    );
  }

  // Đăng xuất
  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  private getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  getMe(): Observable<any> {
    return this.http.get(`${this.apiUrl}/auth/me`, { headers: this.getAuthHeaders() }).pipe(
      tap((res: any) => {
        if (res.success) {
           this.updateLocalUser(res.data);
        }
      })
    );
  }

  updateProfile(data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/auth/profile`, data, { headers: this.getAuthHeaders() }).pipe(
      tap((res: any) => {
        if (res.success) {
          this.updateLocalUser(res.data);
        }
      })
    );
  }

  changePassword(data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/auth/change-password`, data, { headers: this.getAuthHeaders() });
  }

  forgotPassword(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/forgot-password`, data);
  }

  verifyOTP(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/verify-otp`, data);
  }

  resetPassword(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/reset-password`, data);
  }

  // =======================================================
  // THÊM LOGIC: QUẢN LÝ ĐIỂM VÀ HẠNG THÀNH VIÊN
  // =======================================================

  // Hàm tính toán Hạng dựa vào tổng tiền chi tiêu
  public calculateTier(spent: number) {
    if (spent >= 100000000) return { name: 'Diamond', level: 3 }; // Trên 100tr
    if (spent >= 50000000) return { name: 'Gold', level: 2 };     // 50tr - 100tr
    if (spent >= 10000000) return { name: 'Silver', level: 1 };   // 10tr - 50tr
    return { name: 'Bronze', level: 0 };                          // Dưới 10tr
  }

  // Hàm cộng điểm khi khách đánh giá đơn hàng thành công
  public addPoints(amount: number): void {
    const user = this.currentUserSubject.value;
    if (!user) return;

    // Cộng dồn tiền
    user.totalSpent = (user.totalSpent || 0) + amount;
    
    // Tính lại hạng
    const newTier = this.calculateTier(user.totalSpent);
    user.tierName = newTier.name;
    user.tierLevel = newTier.level;

    // Cập nhật State & LocalStorage
    this.updateLocalUser(user);

    // Gửi lên Backend để lưu vào Database (Tái sử dụng api updateProfile)
    this.updateProfile({ totalSpent: user.totalSpent }).subscribe({
      next: () => console.log('Đã đồng bộ điểm lên Server'),
      error: (err) => console.error('Lỗi khi đồng bộ điểm', err)
    });
  }

  // Helper function để tái sử dụng việc lưu LocalStorage và BehaviorSubject
  private updateLocalUser(userData: any): void {
    // Khớp lệnh: Lấy Total_spent từ MongoDB gán cho Angular
    userData.totalSpent = userData.Total_spent || userData.totalSpent || 0;
    const tierInfo = this.calculateTier(userData.totalSpent);
    userData.tierName = tierInfo.name;
    userData.tierLevel = tierInfo.level;

    localStorage.setItem('user', JSON.stringify(userData));
    this.currentUserSubject.next(userData);
  }
}