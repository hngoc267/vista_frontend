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

  public calculateTier(spent: number) {
    if (spent >= 100000000) return { name: 'Diamond', level: 3 };
    if (spent >= 50000000) return { name: 'Gold', level: 2 };
    if (spent >= 10000000) return { name: 'Silver', level: 1 };
    return { name: 'Bronze', level: 0 };
  }

  // 1. Sửa addPoints thành Observable để đợi API trả về
  public addPoints(amount: number): Observable<any> {
    const user = this.currentUserSubject.value;
    if (!user) throw new Error('Vui lòng đăng nhập!');

    // Cập nhật local
    user.totalSpent = (user.totalSpent || 0) + amount;
    const newTier = this.calculateTier(user.totalSpent);
    user.tierName = newTier.name;
    user.tierLevel = newTier.level;

    this.updateLocalUser(user);

    // QUAN TRỌNG: Trả về kết quả API để Component kia subscribe
    return this.updateProfile({ totalSpent: user.totalSpent });
  }

  // 2. Thêm hàm load lại data từ DB (Rất hữu ích khi cần chốt số liệu chuẩn)
  public reloadUserProfile(): void {
    this.getMe().subscribe({
      next: () => console.log('Đã làm mới dữ liệu User từ MongoDB'),
      error: (err) => console.error('Lỗi làm mới User:', err)
    });
  }

  private updateLocalUser(userData: any): void {
    userData.totalSpent = userData.Total_spent || userData.totalSpent || 0;
    const tierInfo = this.calculateTier(userData.totalSpent);
    userData.tierName = tierInfo.name;
    userData.tierLevel = tierInfo.level;

    localStorage.setItem('user', JSON.stringify(userData));
    this.currentUserSubject.next(userData);
  }
}