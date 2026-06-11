import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product';

@Component({
  selector: 'app-product-list',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './product-list.html',
  styleUrl: './product-list.scss'
})
export class ProductList implements OnInit {
  products: any[] = [];
  categories: any[] = [];
  totalProducts = 0;
  totalPages = 0;
  currentPage = 1;
  defaultImage = 'https://placehold.co/400x400/e2e8f0/475569?text=VISTA+Product'; // Đổi màu cho đồng bộ trang chủ

  filters: any = {
    category: '',
    search: '',
    minPrice: '',
    maxPrice: '',
    sort: 'newest',
    isFlashSale: '' // THÊM MỚI: Biến hứng Flash Sale
  };

  priceRanges = [
    { label: 'Dưới 5 triệu', min: '0', max: '5000000' },
    { label: '5 - 10 triệu', min: '5000000', max: '10000000' },
    { label: '10 - 20 triệu', min: '10000000', max: '20000000' },
    { label: '20 - 40 triệu', min: '20000000', max: '40000000' },
    { label: 'Trên 40 triệu', min: '40000000', max: '' },
  ];

  selectedPriceRange = '';

  constructor(
    private productService: ProductService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.productService.getAllCategories().subscribe({
      next: (res) => {
        this.categories = res.data;
        this.cdr.detectChanges();
      }
    });

    this.route.queryParams.subscribe(params => {
      this.filters.category = params['category'] || '';
      this.filters.search = params['search'] || '';
      this.filters.sort = params['sort'] || 'newest';
      this.filters.isFlashSale = params['isFlashSale'] || ''; // THÊM MỚI: Bắt params từ URL
      this.currentPage = Number(params['page']) || 1;
      this.loadProducts();
    });
  }

  loadProducts() {
    const params = {
      ...this.filters,
      page: this.currentPage,
      limit: 9
    };

    this.productService.getAllProducts(params).subscribe({
      next: (res) => {
        this.products = res.data;
        this.totalProducts = res.pagination.total;
        this.totalPages = res.pagination.totalPages;
        this.cdr.detectChanges();
      },
      error: (err) => console.error(err)
    });
  }

  applyFilter() {
    this.currentPage = 1;
    this.loadProducts();
  }

  selectPriceRange(range: any) {
    if (this.selectedPriceRange === range.label) {
      this.selectedPriceRange = '';
      this.filters.minPrice = '';
      this.filters.maxPrice = '';
    } else {
      this.selectedPriceRange = range.label;
      this.filters.minPrice = range.min;
      this.filters.maxPrice = range.max;
    }
    this.applyFilter();
  }

  changePage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.loadProducts();
    window.scrollTo(0, 0);
  }

  formatPrice(price: number): string {
    return price ? price.toLocaleString('vi-VN') + ' ₫' : 'Liên hệ';
  }

  // THÊM MỚI: Hàm tính giá sau giảm
  getFinalPrice(price: number, discount: number): number {
    if (!discount || discount === 0) return price;
    return price - (price * discount / 100);
  }

  getCategoryName(): string {
    if (this.filters.isFlashSale === 'true') return 'Flash Sale'; // THÊM MỚI: Đổi title nếu đang ở trang Sale
    if (!this.filters.category) return 'Tất cả sản phẩm';
    const cat = this.categories.find(c => c.Category_id === this.filters.category);
    return cat ? cat.Category_name : 'Sản phẩm';
  }

  getPageNumbers(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }
}