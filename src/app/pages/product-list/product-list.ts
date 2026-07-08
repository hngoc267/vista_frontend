import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product';

@Component({
  selector: 'app-product-list',
  standalone: true,
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

  filters: any = {
    category: '',
    brand: '', 
    search: '',
    minPrice: '',
    maxPrice: '',
    sort: 'newest',
    isFlashSale: '',
    isAI: '', 
    isNew: '',
    isPromo: ''
  };


  brandByCategory: { [key: string]: string[] } = {
    'Laptop': ['Apple', 'Asus', 'Dell', 'Lenovo', 'HP', 'Acer'], 
    'Smartphone': ['Apple', 'Samsung', 'Xiaomi', 'Oppo', 'Vivo'],
    'Tablet': ['Apple', 'Samsung', 'Xiaomi', 'Lenovo'],
    'Thiết bị âm thanh': ['Sony', 'JBL', 'Anker', 'Apple', 'Logitech', 'HyperX'], 
    'Phụ kiện công nghệ': ['Logitech', 'Anker', 'Apple', 'ASUS'], 
    'Thiết bị gaming': ['Razer', 'Logitech', 'HyperX', 'ASUS'] 
  };

  
  availableBrands: string[] = [];

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
        if (this.filters.category) {
          const cat = this.categories.find(c => c.Category_id === this.filters.category);
          if (cat) {
            this.availableBrands = this.brandByCategory[cat.Category_name] || [];
          }
        }
        this.cdr.detectChanges();
      }
    });


    this.route.queryParams.subscribe(params => {
      this.filters.category = params['category'] || '';
      this.filters.brand = params['brand'] || ''; 
      this.filters.search = params['search'] || '';
      this.filters.sort = params['sort'] || 'newest';
      this.filters.isFlashSale = params['isFlashSale'] || '';
      this.filters.isNew = params['isNew'] || '';
      this.filters.isPromo = params['isPromo'] || '';
      this.filters.isAI = params['filter'] === 'ai-suggested' ? 'true' : (params['isAI'] || '');
      
      this.filters.minPrice = params['minPrice'] || '';
      this.filters.maxPrice = params['maxPrice'] || '';

      const matchedRange = this.priceRanges.find(r => r.min === this.filters.minPrice && r.max === this.filters.maxPrice);
      this.selectedPriceRange = matchedRange ? matchedRange.label : '';

      this.currentPage = Number(params['page']) || 1;
      
      this.loadProducts(); 
    });
  }

  loadProducts() {
    const params: any = {
      page: this.currentPage,
      limit: 9
    };

    if (this.filters.category) params.category = this.filters.category;
    if (this.filters.brand) params.brand = this.filters.brand;
    if (this.filters.search) params.search = this.filters.search;
    if (this.filters.minPrice) params.minPrice = this.filters.minPrice;
    if (this.filters.maxPrice) params.maxPrice = this.filters.maxPrice;
    if (this.filters.sort) params.sort = this.filters.sort;
    

    if (this.filters.isAI === 'true') params.isAI = 'true';
    if (this.filters.isNew === 'true') params.isNew = 'true';
    if (this.filters.isPromo === 'true') params.isPromo = 'true';

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
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: {
        category: this.filters.category || null,
        brand: this.filters.brand || null,
        search: this.filters.search || null,
        minPrice: this.filters.minPrice || null,
        maxPrice: this.filters.maxPrice || null,
        sort: this.filters.sort !== 'newest' ? this.filters.sort : null, 
        isFlashSale: this.filters.isFlashSale || null,
        isAI: this.filters.isAI || null,
        isNew: this.filters.isNew || null,
        isPromo: this.filters.isPromo || null,
        page: this.currentPage > 1 ? this.currentPage : null
      },
      queryParamsHandling: 'merge' 
    });
  }

  selectCategory(categoryId: string) {
    if (this.filters.category === categoryId) {
      this.filters.category = '';
      this.filters.brand = '';
      this.availableBrands = [];
      this.selectLabel('all'); 
    } else {
      this.filters.category = categoryId;
      this.filters.brand = ''; 
      this.selectLabel('all'); 
      
      const cat = this.categories.find(c => c.Category_id === categoryId);
      if (cat) {
        this.availableBrands = this.brandByCategory[cat.Category_name] || [];
      } else {
        this.availableBrands = [];
      }
    }
    this.applyFilter();
  }


  selectBrand(brandName: string) {
    if (this.filters.brand === brandName || brandName === '') {
      
      this.filters.brand = '';
    } else {
      this.filters.brand = brandName;
    }
    this.applyFilter();
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


  selectLabel(labelType: string) {
    if (labelType === 'ai') {
      this.filters.isAI = this.filters.isAI === 'true' ? '' : 'true';
      this.filters.isNew = '';
      this.filters.isPromo = '';
      this.filters.isFlashSale = ''; 
    } else if (labelType === 'promo') {
      this.filters.isPromo = this.filters.isPromo === 'true' ? '' : 'true';
      this.filters.isAI = '';
      this.filters.isNew = '';
      this.filters.isFlashSale = '';
    } else if (labelType === 'new') {
      this.filters.isNew = this.filters.isNew === 'true' ? '' : 'true';
      this.filters.isAI = '';
      this.filters.isPromo = '';
      this.filters.isFlashSale = '';
    } else {
      this.filters.isAI = '';
      this.filters.isNew = '';
      this.filters.isPromo = '';
      this.filters.isFlashSale = '';
    }
    this.applyFilter();
  }


  selectSort(sortType: string) {
    if (this.filters.sort === sortType) {
      this.filters.sort = 'newest'; 
    } else {
      this.filters.sort = sortType;
    }
    this.applyFilter();
  }

  changePage(page: number) {
    if (page < 1 || page > this.totalPages) return;
    this.currentPage = page;
    this.applyFilter();
    window.scrollTo({ top: 0, behavior: 'smooth' }); 
  }

  formatPrice(price: number): string {
    return price ? price.toLocaleString('vi-VN') + ' ₫' : 'Liên hệ';
  }

  getFinalPrice(price: number, discount: number): number {
    if (!discount || discount === 0) return price;
    return price - (price * discount / 100);
  }

  getCategoryName(): string {
    if (this.filters.isPromo === 'true') return 'Ưu đãi';
    if (this.filters.isAI === 'true') return 'AI Gợi ý cho bạn';
    if (this.filters.isNew === 'true') return 'Sản phẩm mới nhất';
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