import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home implements OnInit {
  categories: any[] = [];
  featuredProducts: any[] = [];
  aiProducts: any[] = [];
  flashSaleProducts: any[] = []; // Thêm biến này
  searchQuery = '';
  

  constructor(
    private productService: ProductService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit() {
    this.loadCategories();
    this.loadFeaturedProducts();
    this.loadFlashSaleProducts();   // Gọi API mới
    this.loadAISuggestedProducts(); // Gọi API mới
  }

  loadCategories() {
    this.productService.getAllCategories().subscribe({
      next: (res) => { this.categories = res.data; this.cdr.detectChanges(); }
    });
  }

  loadFeaturedProducts() {
    this.productService.getFeaturedProducts().subscribe({
      next: (res) => { this.featuredProducts = res.data; this.cdr.detectChanges(); }
    });
  }

  loadFlashSaleProducts() {
    this.productService.getFlashSaleProducts().subscribe({
      next: (res) => { this.flashSaleProducts = res.data; this.cdr.detectChanges(); }
    });
  }

  loadAISuggestedProducts() {
    this.productService.getAISuggestedProducts().subscribe({
      next: (res) => { this.aiProducts = res.data; this.cdr.detectChanges(); }
    });
  }

  formatPrice(price: number): string {
    return price ? price.toLocaleString('vi-VN') + ' ₫' : 'Liên hệ';
  }

  getFinalPrice(price: number, discount: number): number {
    if (!discount || discount === 0) return price; // Không giảm thì giữ nguyên
    return price - (price * discount / 100);
  }

  onSearch() {
    if (this.searchQuery.trim()) {
      this.router.navigate(['/products'], { queryParams: { search: this.searchQuery } });
    }
  }
}