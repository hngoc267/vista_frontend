import { Injectable } from '@angular/core';
import { CanActivate, Router } from '@angular/router';
import { AuthService } from '../services/auth';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {
  constructor(private authService: AuthService, private router: Router) {}

  canActivate(): boolean {
    if (this.authService.isLoggedIn()) {
      return true; // Có Token -> Cho phép đi tiếp vào trang
    } else {
      this.router.navigate(['/login']); // Chưa có Token -> Đá văng ra trang Login
      return false;
    }
  }
}