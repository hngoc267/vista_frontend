import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core'; 
import { RouterLink, Router } from '@angular/router'; 
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth';
import { CartStateService } from '../../services/cart-state.service';
import { CartService } from '../../services/cart';
import { ProductService } from '../../services/product';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, CommonModule, FormsModule], 
  templateUrl: './navbar.html',
  styleUrl: './navbar.scss'
})
export class NavbarComponent implements OnInit, OnDestroy {
  isLoggedIn: boolean = false;
  searchQuery: string = ''; 
  userName: string = ''; // Khai báo biến hứng tên khách hàng để HTML không bị lỗi
  cartCount = 0;
  categories: any[] = [];
  private subscriptions = new Subscription();

  constructor(
    private authService: AuthService,
    private cartState: CartStateService,
    private cartService: CartService,
    private productService: ProductService,
    private router: Router,
    private cdr: ChangeDetectorRef 
  ) {}

  ngOnInit() {
    this.loadCategories();

    this.subscriptions.add(this.authService.currentUser$.subscribe(user => {
      this.isLoggedIn = !!user; 
      
      if (user) {
        // Lấy tên hiển thị của khách (Dựa vào trường Full_name trong DB của bạn)
        this.userName = user.Full_name || 'Khách hàng'; 
        this.syncCartCount(user.User_id);
      } else {
        this.userName = '';
        this.cartState.setCount(0);
      }
      
      // Ép Angular render lại giao diện Navbar lập tức
      this.cdr.detectChanges(); 
    }));

    this.subscriptions.add(this.cartState.cartCount$.subscribe(count => {
      this.cartCount = count;
      this.cdr.detectChanges();
    }));
  }

  ngOnDestroy() {
    this.subscriptions.unsubscribe();
  }

  onSearch() {
    if (this.searchQuery.trim()) {
      this.router.navigate(['/products'], { queryParams: { search: this.searchQuery } });
    }
  }

  private syncCartCount(userId: string): void {
    if (!userId) {
      this.cartState.setCount(0);
      return;
    }

    this.subscriptions.add(this.cartService.getCart(userId).subscribe({
      next: (res) => {
        const totalProducts = res.data?.cart?.Total_product ?? this.cartState.getTotalQuantity(res.data?.items || []);
        this.cartState.setCount(totalProducts);
      },
      error: () => {
        this.cartState.setCount(0);
      }
    }));
  }

  private loadCategories(): void {
    this.productService.getAllCategories().subscribe({
      next: (res) => {
        this.categories = Array.isArray(res?.data) ? res.data : [];
        this.cdr.detectChanges();
      },
      error: () => {
        this.categories = [];
        this.cdr.detectChanges();
      }
    });
  }
}
