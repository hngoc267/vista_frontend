import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:5000/api';
  private currentUserSubject = new BehaviorSubject<any>(null);
  currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    // Kiểm tra token khi khởi động app
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      this.currentUserSubject.next(JSON.parse(user));
    }
  }

  // Đăng ký
  register(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, data).pipe(
      tap((res: any) => {
        if (res.success) {
          localStorage.setItem('token', res.token);
          localStorage.setItem('user', JSON.stringify(res.user));
          this.currentUserSubject.next(res.user);
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
          localStorage.setItem('user', JSON.stringify(res.user));
          this.currentUserSubject.next(res.user);
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

  // Lấy token
  getToken(): string | null {
    return localStorage.getItem('token');
  }

  // Kiểm tra đã đăng nhập chưa
  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  // Helper: Tạo Header chứa Token
  private getAuthHeaders(): HttpHeaders {
    const token = this.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`
    });
  }

  // Lấy thông tin user hiện tại
  getMe(): Observable<any> {
    return this.http.get(`${this.apiUrl}/auth/me`, { headers: this.getAuthHeaders() });
  }

  // Cập nhật hồ sơ
  updateProfile(data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/auth/profile`, data, { headers: this.getAuthHeaders() });
  }

  // Đổi mật khẩu
  changePassword(data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/auth/change-password`, data, { headers: this.getAuthHeaders() });
  }

  // Quên mật khẩu - Gửi email nhận OTP
  forgotPassword(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/forgot-password`, data);
  }

  // Xác thực mã OTP
  verifyOTP(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/verify-otp`, data);
  }

  // Đặt lại mật khẩu mới
  resetPassword(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/reset-password`, data);
  }
}
  