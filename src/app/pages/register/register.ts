import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth';
import Swal from 'sweetalert2'; // <-- 1. Thêm dòng import này

@Component({
  selector: 'app-register',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './register.html',
  styleUrl: './register.scss'
})
export class Register {
  fullName = '';
  email = '';
  phoneNumber = '';
  password = '';
  confirmPassword = '';
  showPassword = false;
  showConfirmPassword = false;

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit() {
    if (this.password !== this.confirmPassword) {
      Swal.fire({
        icon: 'warning',
        title: 'Cảnh báo',
        text: 'Mật khẩu xác nhận không khớp!',
        confirmButtonColor: '#2563B0'
      });
      return;
    }

    const registerData = {
      Username: this.email.split('@')[0],
      Email: this.email,
      Password: this.password,
      Full_name: this.fullName,
      Phone_number: this.phoneNumber
    };

    this.authService.register(registerData).subscribe({
      next: (res) => {
        if (res.success) {
          // 2. Popup Đăng ký thành công
          Swal.fire({
            icon: 'success',
            title: 'Đăng ký thành công!',
            text: 'Tài khoản của bạn đã được tạo, tiến hành đăng nhập ngay.',
            confirmButtonColor: '#2563B0',
            confirmButtonText: 'Đến trang Đăng nhập'
          }).then(() => {
            this.router.navigate(['/login']);
          });
        }
      },
      error: (err) => {
        // 3. Popup Đăng ký lỗi (Email/Username trùng)
        Swal.fire({
          icon: 'error',
          title: 'Đăng ký thất bại',
          text: err.error?.message || 'Vui lòng kiểm tra lại thông tin!',
          confirmButtonColor: '#2563B0'
        });
      }
    });
  }
}