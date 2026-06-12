import { Component, OnInit, ChangeDetectorRef } from '@angular/core'; 
import { RouterLink, Router } from '@angular/router'; 
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { AuthService } from '../../services/auth';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule], 
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss'
})
export class NavbarComponent implements OnInit {
  isLoggedIn: boolean = false;
  searchQuery: string = ''; 
  userName: string = ''; // Khai báo biến hứng tên khách hàng để HTML không bị lỗi

  constructor(
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef 
  ) {}

  ngOnInit() {
    this.authService.currentUser$.subscribe(user => {
      this.isLoggedIn = !!user; 
      
      if (user) {
        // Lấy tên hiển thị của khách (Dựa vào trường Full_name trong DB của bạn)
        this.userName = user.Full_name || 'Khách hàng'; 
      } else {
        this.userName = '';
      }
      
      // Ép Angular render lại giao diện Navbar lập tức
      this.cdr.detectChanges(); 
    });
  }

  onSearch() {
    if (this.searchQuery.trim()) {
      this.router.navigate(['/products'], { queryParams: { search: this.searchQuery } });
    }
  }
}