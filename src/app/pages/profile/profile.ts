import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-profile',
  imports: [CommonModule, FormsModule],
  templateUrl: './profile.html',
  styleUrl: './profile.scss'
})
export class Profile implements OnInit {
  activeTab = 'info'; 
  user: any = null;   


  oldPassword = '';
  newPassword = '';
  confirmPassword = '';

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit() {

    this.authService.currentUser$.subscribe(currentUser => {
      if (currentUser) {
        this.user = { ...currentUser }; 
      } else {
        this.router.navigate(['/login']);
      }
    });
  }


  saveProfile() {
    const updateData = {
      Full_name: this.user.Full_name,
      Phone_number: this.user.Phone_number
    };


    this.authService.updateProfile(updateData).subscribe({
      next: (res) => {
        if (res.success) {
          localStorage.setItem('user', JSON.stringify(res.data));
          Swal.fire({
            icon: 'success',
            title: 'Thành công!',
            text: 'Thông tin cá nhân của bạn đã được cập nhật.',
            confirmButtonColor: '#2563B0'
          });
        }
      },
      error: (err) => {
        Swal.fire({ icon: 'error', title: 'Thất bại', text: err.error?.message || 'Không thể cập nhật hồ sơ!', confirmButtonColor: '#2563B0' });
      }
    });
  }

  updatePassword() {
    if (this.newPassword !== this.confirmPassword) {
      Swal.fire({ icon: 'error', title: 'Lỗi', text: 'Mật khẩu xác nhận mới không khớp!', confirmButtonColor: '#2563B0' });
      return;
    }

    const passData = {
      oldPassword: this.oldPassword,
      newPassword: this.newPassword
    };

    this.authService.changePassword(passData).subscribe({
      next: (res) => {
        if (res.success) {
          Swal.fire({
            icon: 'success',
            title: 'Đổi mật khẩu thành công!',
            text: 'Vui lòng sử dụng mật khẩu mới cho lần đăng nhập sau.',
            confirmButtonColor: '#2563B0'
          });

          this.oldPassword = '';
          this.newPassword = '';
          this.confirmPassword = '';
        }
      },
      error: (err) => {
        Swal.fire({ icon: 'error', title: 'Thất bại', text: err.error?.message || 'Mật khẩu cũ không chính xác!', confirmButtonColor: '#2563B0' });
      }
    });
  }


  logout() {
    Swal.fire({
      title: 'Bạn muốn đăng xuất?',
      text: "Hệ thống sẽ đăng xuất tài khoản của bạn khỏi phiên làm việc này.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563B0',
      cancelButtonColor: '#64748B',
      confirmButtonText: 'Đăng xuất ngay',
      cancelButtonText: 'Hủy'
    }).then((result) => {
      if (result.isConfirmed) {
        this.authService.logout(); 
        this.router.navigate(['/login']); 
      }
    });
  }
}