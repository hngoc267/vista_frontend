import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import Swal from 'sweetalert2';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-forgot-password',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss'
})
export class ForgotPassword {
  email = '';

  constructor(
    private authService: AuthService, 
    private router: Router
  ) {}

  onSubmit() {
    if (!this.email) return;

  
    Swal.fire({
      title: 'Đang gửi mã...',
      text: 'Vui lòng đợi trong giây lát',
      allowOutsideClick: false,
      didOpen: () => { Swal.showLoading(); }
    });

    
    this.authService.forgotPassword({ Email: this.email }).subscribe({
      next: (res) => {
        Swal.fire({
          icon: 'success',
          title: 'Đã gửi mã xác nhận!',
          text: 'Vui lòng kiểm tra hộp thư đến hoặc thư rác của email: ' + this.email,
          confirmButtonColor: '#2563B0',
          confirmButtonText: 'Nhập mã ngay'
        }).then(() => {
          this.router.navigate(['/verify-code'], { queryParams: { email: this.email } });
        });
      },
      error: (err) => {
        Swal.fire({
          icon: 'error',
          title: 'Lỗi hệ thống',
          text: err.error?.message || 'Không thể gửi mã OTP lúc này!',
          confirmButtonColor: '#2563B0'
        });
      }
    });
  }
}