import { Component, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth'; // Import Service xịn của bạn vào đây

@Component({
  selector: 'app-navbar',
  imports: [RouterLink, CommonModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss'
})
export class NavbarComponent implements OnInit {
  isLoggedIn: boolean = false;

  constructor(private authService: AuthService) {}

  ngOnInit() {
    // Lắng nghe trạng thái đăng nhập thay đổi liên tục trên toàn app
    this.authService.currentUser$.subscribe(user => {
      this.isLoggedIn = !!user; // Nếu có user thì biến thành true, nếu user là null thì thành false
    });
  }
}