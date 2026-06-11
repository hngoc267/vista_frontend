import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-login',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login implements OnInit {
  email = '';
  password = '';
  
  // Biến cho con mắt
  showPassword = false;

  // Biến cho logic khóa 1 phút
  failedAttempts = 0;
  isLocked = false;
  countdown = 0;
  timerInterval: any;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit() {
    this.checkLockout(); // Kiểm tra xem user có đang bị khóa từ trước không
  }

  // Hàm đếm ngược thời gian khóa
  checkLockout() {
    const lockUntil = localStorage.getItem('lockUntil');
    if (lockUntil) {
      const timeLeft = parseInt(lockUntil) - Date.now();
      if (timeLeft > 0) {
        this.isLocked = true;
        this.startCountdown(Math.ceil(timeLeft / 1000));
      } else {
        // Đã hết 1 phút -> Mở khóa
        localStorage.removeItem('lockUntil');
        localStorage.setItem('failedAttempts', '0');
        this.failedAttempts = 0;
      }
    } else {
      this.failedAttempts = parseInt(localStorage.getItem('failedAttempts') || '0');
    }
  }

  startCountdown(seconds: number) {
    this.countdown = seconds;
    this.timerInterval = setInterval(() => {
      this.countdown--;
      if (this.countdown <= 0) {
        clearInterval(this.timerInterval);
        this.isLocked = false;
        localStorage.removeItem('lockUntil');
        localStorage.setItem('failedAttempts', '0');
        this.failedAttempts = 0;
      }
    }, 1000);
  }

  onSubmit() {
    if (this.isLocked) return;

    const loginData = { Email: this.email, Password: this.password };

    this.authService.login(loginData).subscribe({
      next: (res) => {
        if (res.success) {
          // Đăng nhập đúng -> Xóa lịch sử nhập sai
          localStorage.setItem('failedAttempts', '0');
          
          Swal.fire({
            icon: 'success',
            title: 'Đăng nhập thành công!',
            text: `Chào mừng ${res.user.Full_name}`,
            showConfirmButton: false,
            timer: 2000
          }).then(() => {
            this.router.navigate(['/']);
          });
        }
      },
      error: (err) => {
        // Xử lý khi nhập sai mật khẩu
        this.failedAttempts++;
        localStorage.setItem('failedAttempts', this.failedAttempts.toString());

        if (this.failedAttempts >= 5) {
          // Phạt khóa 1 phút (60,000 milliseconds)
          const lockTime = Date.now() + 60 * 1000;
          localStorage.setItem('lockUntil', lockTime.toString());
          this.isLocked = true;
          this.startCountdown(60);

          Swal.fire({
            icon: 'error',
            title: 'Tạm khóa đăng nhập',
            text: 'Bạn đã nhập sai 5 lần. Vui lòng thử lại sau 1 phút!',
            confirmButtonColor: '#2563B0'
          });
        } else {
          Swal.fire({
            icon: 'warning',
            title: 'Đăng nhập thất bại',
            text: `Sai mật khẩu (${this.failedAttempts}/5 lần)`,
            confirmButtonColor: '#2563B0'
          });
        }
      }
    });
  }
}