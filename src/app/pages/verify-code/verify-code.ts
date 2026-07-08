import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import Swal from 'sweetalert2';
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-verify-code',
  imports: [CommonModule, FormsModule],
  templateUrl: './verify-code.html',
  styleUrl: './verify-code.scss'
})
export class VerifyCode implements OnInit {
  email = '';
  otpCode = '';

  constructor(
    private route: ActivatedRoute,
    private authService: AuthService, 
    private router: Router
  ) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      this.email = params['email'] || '';
    });
  }

  onSubmit() {
    if (this.otpCode.length < 6) {
      Swal.fire({ icon: 'warning', title: 'Cảnh báo', text: 'Vui lòng nhập đủ mã OTP gồm 6 chữ số!', confirmButtonColor: '#2563B0' });
      return;
    }

    const verifyData = {
      Email: this.email,
      otpCode: this.otpCode
    };

    this.authService.verifyOTP(verifyData).subscribe({
      next: (res) => {
        Swal.fire({
          icon: 'success',
          title: 'Mã xác nhận hợp lệ!',
          showConfirmButton: false,
          timer: 1500
        }).then(() => {
          this.router.navigate(['/reset-password'], { queryParams: { email: this.email, code: this.otpCode } });
        });
      },
      error: (err) => {
        Swal.fire({
          icon: 'error',
          title: 'Xác thực thất bại',
          text: err.error?.message || 'Mã OTP không đúng hoặc đã hết hạn!',
          confirmButtonColor: '#2563B0'
        });
      }
    });
  }
}