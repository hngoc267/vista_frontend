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

  private readonly legacySharedLocalStorageKeys = [
    'userId',
    'vista_active_user_key',
    'vista_saved_checkout_addresses',
    'vista_deleted_checkout_addresses',
    'vista_saved_return_addresses',
    'vista_deleted_return_addresses',
    'vista_cart_count',
  ];

  private readonly checkoutSessionKeys = [
    'vista_checkout_items',
    'vista_checkout_source',
    'vista_pending_voucher_code',
    'vista_repurchase_order_prefill',
    'vista_return_order_data',
  ];

  constructor(private http: HttpClient) {}


  private getUserFromStorage(): any {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      try {
        let parsedUser = JSON.parse(user);
        if (parsedUser) {
          
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

  register(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/register`, data).pipe(
      tap((res: any) => {
        if (res.success) {
          this.persistAuthSession(res);
        }
      })
    );
  }

  login(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/auth/login`, data).pipe(
      tap((res: any) => {
        if (res.success) {
          this.persistAuthSession(res);
        }
      })
    );
  }

  logout(): void {
    if (typeof localStorage !== 'undefined') {
      this.clearSharedAccountState();
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      localStorage.removeItem('userId');
    }

    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

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
          this.persistCurrentUser(res.data || res.user);
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

  private persistAuthSession(res: any): void {
    const nextUser = res?.user || res?.data || null;
    const previousUserKey = this.getStoredUserKey();
    const nextUserKey = this.extractUserKey(nextUser);

    if (previousUserKey && nextUserKey && previousUserKey !== nextUserKey) {
      this.clearSharedAccountState();
    }

    if (typeof localStorage !== 'undefined') {
      if (res?.token) {
        localStorage.setItem('token', res.token);
      }
      this.persistCurrentUser(nextUser);
    } else {
      this.currentUserSubject.next(nextUser);
    }
  }

  private persistCurrentUser(user: any): void {
    if (!user) {
      return;
    }

    if (typeof localStorage !== 'undefined') {
      const userId = this.extractUserId(user);
      const userKey = this.extractUserKey(user);
      localStorage.setItem('user', JSON.stringify(user));

      if (userId) {
        localStorage.setItem('userId', userId);
      } else {
        localStorage.removeItem('userId');
      }

      if (userKey) {
        localStorage.setItem('vista_active_user_key', userKey);
      } else {
        localStorage.removeItem('vista_active_user_key');
      }
    }

    this.currentUserSubject.next(user);
  }

  private getStoredUserId(): string {
    if (typeof localStorage === 'undefined') {
      return '';
    }

    const currentUserId = this.extractUserId(this.getUserFromStorage());
    return currentUserId || String(localStorage.getItem('userId') || '').trim();
  }

  private extractUserId(user: any): string {
    return String(user?.User_id || user?.userId || '').trim();
  }

  private getStoredUserKey(): string {
    if (typeof localStorage === 'undefined') {
      return '';
    }

    return this.extractUserKey(this.getUserFromStorage()) ||
      String(localStorage.getItem('vista_active_user_key') || '').trim();
  }

  private extractUserKey(user: any): string {
    const userId = this.extractUserId(user);
    const email = String(user?.Email || user?.email || '').trim().toLowerCase();
    const username = String(user?.Username || user?.username || '').trim().toLowerCase();

    if (!userId && !email && !username) {
      return '';
    }

    return [userId || 'nouser', email || username || 'noemail']
      .join('__')
      .replace(/[^a-zA-Z0-9_@.-]/g, '_');
  }

  private clearSharedAccountState(): void {
    if (typeof localStorage !== 'undefined') {
      this.legacySharedLocalStorageKeys.forEach((key) => localStorage.removeItem(key));
    }

    if (typeof sessionStorage !== 'undefined') {
      this.checkoutSessionKeys.forEach((key) => sessionStorage.removeItem(key));
    }
  }




  public calculateTier(spent: number) {
    if (spent >= 100000000) return { name: 'Diamond', level: 3 };
    if (spent >= 50000000) return { name: 'Gold', level: 2 };
    if (spent >= 10000000) return { name: 'Silver', level: 1 };
    return { name: 'Bronze', level: 0 };
  }


  public addPoints(amount: number): Observable<any> {
    const user = this.currentUserSubject.value;
    if (!user) throw new Error('Vui lòng đăng nhập!');


    user.totalSpent = (user.totalSpent || 0) + amount;
    const newTier = this.calculateTier(user.totalSpent);
    user.tierName = newTier.name;
    user.tierLevel = newTier.level;

    this.updateLocalUser(user);


    return this.updateProfile({ totalSpent: user.totalSpent });
  }


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