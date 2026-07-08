import { Component, OnInit } from '@angular/core'; 
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router'; 
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth'; 
import Swal from 'sweetalert2';

@Component({
  selector: 'app-reset-password',
  imports: [CommonModule, FormsModule],
  templateUrl: './reset-password.html',
  styleUrl: './reset-password.scss'
})
export class ResetPassword implements OnInit {
  email = '';
  otpCode = '';
  password = '';
  confirmPassword = '';
  showPassword = false;
  showConfirmPassword = false;

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.email = params['email'] || '';
      this.otpCode = params['code'] || '';
    });
  }

  onSubmit() {
    if (this.password.length < 8) {
      Swal.fire({ icon: 'warning', title: 'Mật khẩu quá ngắn', text: 'Mật khẩu mới phải từ 8 ký tự trở lên.', confirmButtonColor: '#2563B0' });
      return;
    }

    if (this.password !== this.confirmPassword) {
      Swal.fire({ icon: 'error', title: 'Lỗi', text: 'Mật khẩu xác nhận không khớp!', confirmButtonColor: '#2563B0' });
      return;
    }

    const resetData = {
      Email: this.email,
      otpCode: this.otpCode,
      Password: this.password
    };

    this.authService.resetPassword(resetData).subscribe({
      next: (res) => {
        Swal.fire({
          icon: 'success',
          title: 'Đổi mật khẩu thành công!',
          text: 'Tài khoản của bạn đã được cập nhật mật khẩu mới.',
          confirmButtonColor: '#2563B0',
          confirmButtonText: 'Đăng nhập ngay'
        }).then(() => {
          this.router.navigate(['/login']);
        });
      },
      error: (err) => {
        Swal.fire({
          icon: 'error',
          title: 'Thất bại',
          text: err.error?.message || 'Yêu cầu hết hạn, vui lòng thao tác lại từ đầu!',
          confirmButtonColor: '#2563B0'
        });
      }
    });
  }
}