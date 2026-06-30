import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ProductService } from '../../services/product';
import { CartService } from '../../services/cart';
import { CartStateService } from '../../services/cart-state.service';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './home.html',
  styleUrl: './home.scss'
})
export class Home implements OnInit, OnDestroy {
  categories: any[] = [];
  featuredProducts: any[] = [];
  aiProducts: any[] = [];
  flashSaleProducts: any[] = [];
  searchQuery = '';
  smartResults: any[] = [];
  searchMessage: string = '';
  searchHistory: string[] = [];
  lastSearchQuery = '';
  defaultSuggestions = ['Laptop gaming', 'Điện thoại chụp ảnh đẹp', 'Tai nghe chống ồn'];
  showDropdown = false;
  isSearching = false;
  searchDone = false;
  currentStep = 0;
  flashMainTime = {
    days: '03',
    hours: '15',
    minutes: '55',
    seconds: '37'
  };

  flashSlots = [
    { hour: 9, label: '09:00', status: 'upcoming', countdown: '' },
    { hour: 15, label: '15:00', status: 'upcoming', countdown: '' },
    { hour: 21, label: '21:00', status: 'upcoming', countdown: '' }
  ];

  private flashMainSeconds = (3 * 24 * 60 * 60) + (15 * 60 * 60) + (55 * 60) + 37;
  private countdownTimer: any;

  get displaySuggestions(): string[] {
  return this.searchHistory.length > 0 ? this.searchHistory : this.defaultSuggestions;
  }
  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private cartState: CartStateService,
    private cdr: ChangeDetectorRef,
    public router: Router
  ) {}

  ngOnInit() {
    const saved = localStorage.getItem('vista_search_history');
    this.searchHistory = saved ? JSON.parse(saved) : [];
    this.loadCategories();
    this.loadFeaturedProducts();
    this.loadFlashSaleProducts();
    this.loadAISuggestedProducts();
    this.startFlashCountdowns();
  }

  ngOnDestroy() {
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
  }

  loadCategories() {
    this.productService.getAllCategories().subscribe({
      next: (res) => {
        this.categories = res.data;
        this.cdr.detectChanges();
      }
    });
  }

  loadFeaturedProducts() {
    this.productService.getFeaturedProducts().subscribe({
      next: (res) => {
        this.featuredProducts = res.data;
        this.cdr.detectChanges();
      }
    });
  }

  loadFlashSaleProducts() {
    this.productService.getFlashSaleProducts().subscribe({
      next: (res) => {
        this.flashSaleProducts = res.data;
        this.cdr.detectChanges();
      }
    });
  }

  loadAISuggestedProducts() {
    this.productService.getAISuggestedProducts().subscribe({
      next: (res) => {
        this.aiProducts = res.data;
        this.cdr.detectChanges();
      }
    });
  }

  startFlashCountdowns() {
    this.updateFlashMainCountdown();
    this.updateFlashSlotCountdowns();

    this.countdownTimer = setInterval(() => {
      this.flashMainSeconds = Math.max(0, this.flashMainSeconds - 1);
      this.updateFlashMainCountdown();
      this.updateFlashSlotCountdowns();
      this.cdr.detectChanges();
    }, 1000);
  }

  updateFlashMainCountdown() {
    const days = Math.floor(this.flashMainSeconds / 86400);
    const hours = Math.floor((this.flashMainSeconds % 86400) / 3600);
    const minutes = Math.floor((this.flashMainSeconds % 3600) / 60);
    const seconds = this.flashMainSeconds % 60;

    this.flashMainTime = {
      days: this.padTime(days),
      hours: this.padTime(hours),
      minutes: this.padTime(minutes),
      seconds: this.padTime(seconds)
    };
  }

  updateFlashSlotCountdowns() {
    const now = new Date();

    this.flashSlots = this.flashSlots.map((slot) => {
      const start = new Date(now);
      start.setHours(slot.hour, 0, 0, 0);

      const end = new Date(start);
      end.setHours(slot.hour + 3, 0, 0, 0);

      if (now < start) {
        return { ...slot, status: 'upcoming', countdown: '' };
      }

      if (now >= end) {
        return { ...slot, status: 'ended', countdown: '' };
      }

      const diffSeconds = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));

      return {
        ...slot,
        status: 'active',
        countdown: this.formatSlotCountdown(diffSeconds)
      };
    });
  }

  formatSlotCountdown(totalSeconds: number): string {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${this.padTime(hours)} : ${this.padTime(minutes)} : ${this.padTime(seconds)}`;
  }

  padTime(value: number): string {
    return value.toString().padStart(2, '0');
  }

  addFeaturedToCart(product: any, event: Event) {
    event.preventDefault();
    event.stopPropagation();

    const userId = this.cartService.getCurrentUserId();

    if (!userId) {
      Swal.fire({
        icon: 'warning',
        title: 'Vui lòng đăng nhập',
        text: 'Bạn cần đăng nhập để thêm sản phẩm vào giỏ hàng.',
        confirmButtonColor: '#2563B0'
      });
      return;
    }

    this.productService.getProductById(product.Product_id).subscribe({
      next: (res) => {
        const detail = res.data;
        const variant = detail.variants?.[0];

        if (!variant?.Product_variant_id) {
          Swal.fire({
            icon: 'warning',
            title: 'Chưa có phiên bản',
            text: 'Sản phẩm này chưa có phiên bản để thêm vào giỏ hàng.',
            confirmButtonColor: '#2563B0'
          });
          return;
        }

        this.cartService.addToCart(userId, variant.Product_variant_id, 1).subscribe({
          next: (cartRes) => {
            const totalProducts =
              cartRes.data?.cart?.Total_product ??
              this.cartState.getTotalQuantity(cartRes.data?.items || []);

            this.cartState.setCount(totalProducts);

            Swal.fire({
              icon: 'success',
              title: 'Đã thêm vào giỏ hàng',
              text: 'Sản phẩm đã được cập nhật vào giỏ hàng của bạn.',
              confirmButtonColor: '#2563B0'
            });

            this.cdr.detectChanges();
          },
          error: (err) => {
            Swal.fire({
              icon: 'error',
              title: 'Không thể thêm vào giỏ hàng',
              text: err.error?.message || 'Vui lòng thử lại sau.',
              confirmButtonColor: '#2563B0'
            });
          }
        });
      },
      error: () => {
        Swal.fire({
          icon: 'error',
          title: 'Không thể tải sản phẩm',
          text: 'Vui lòng thử lại sau.',
          confirmButtonColor: '#2563B0'
        });
      }
    });
  }

  buyFlashSaleNow(product: any, event: Event) {
    event.preventDefault();
    event.stopPropagation();

    const userId = this.cartService.getCurrentUserId();

    if (!userId) {
      this.router.navigate(['/login']);
      return;
    }

    this.productService.getProductById(product.Product_id).subscribe({
      next: (res) => {
        const detail = res.data;
        const variants = detail.variants || [];
        const variant = variants[0];

        if (!variant?.Product_variant_id) {
          return;
        }

        const discount = Number(detail.Discount || product.Discount || 0);
        const originalPrice = Number(variant.Price || product.min_price || 0);
        const salePrice = this.getFinalPrice(originalPrice, discount);

        const checkoutItem = {
          cartItemId: '',
          productVariantId: variant.Product_variant_id,
          productId: detail.Product_id || product.Product_id || null,
          name: detail.Product_name || product.Product_name || 'Sản phẩm VISTA',
          variantName: variant.Variant_name || '',
          specs: variant.Variant_name || '',
          image: detail.Images?.[0] || product.Images?.[0] || '',
          price: salePrice,
          originalPrice: originalPrice,
          discountPercent: discount,
          quantity: 1,
          stock: Number(variant.Stock_quantity) || 0,
          categoryId: detail.category?.Category_id || detail.Category_id || product.Category_id || '',
          categoryName: detail.category?.Category_name || '',
          categorySlug: detail.category?.Category_slug || '',
          checkoutSource: 'buy_now',
          variantOptions: variants.map((item: any) => ({
            productVariantId: item.Product_variant_id,
            variantName: item.Variant_name,
            price: this.getFinalPrice(Number(item.Price) || 0, discount),
            originalPrice: Number(item.Price) || 0,
            discountPercent: discount,
            stock: Number(item.Stock_quantity) || 0
          }))
        };

        sessionStorage.setItem('vista_checkout_items', JSON.stringify([checkoutItem]));
        sessionStorage.setItem('vista_checkout_source', JSON.stringify({
          type: 'buy_now',
          categoryId: checkoutItem.categoryId,
          categoryName: checkoutItem.categoryName,
          categorySlug: checkoutItem.categorySlug
        }));

        this.router.navigate(['/order']);
      }
    });
  }

  getDiscountAmount(price: number, discount: number): number {
    return price - this.getFinalPrice(price, discount);
  }

  formatPrice(price: number): string {
    return price ? price.toLocaleString('vi-VN') + ' ₫' : 'Liên hệ';
  }

  getFinalPrice(price: number, discount: number): number {
    if (!discount || discount === 0) return price;
    return price - (price * discount / 100);
  }
  closeDropdown() {
  this.showDropdown = false;
  }

  onSearch() {
    if (!this.searchQuery.trim()) return;
    this.lastSearchQuery = this.searchQuery;
    this.searchHistory = [
      this.searchQuery,
      ...this.searchHistory.filter(s => s !== this.searchQuery)
    ].slice(0, 3);
    localStorage.setItem('vista_search_history', JSON.stringify(this.searchHistory));
    this.isSearching = true;
    this.searchDone = false;
    this.smartResults = [];
    this.currentStep = 0;

    let apiDone = false;
    let apiResults: any[] = [];

    [0, 1, 2, 3].forEach((step, i) => {
      setTimeout(() => {
        this.currentStep = step;
        this.cdr.detectChanges();
        if (step === 3 && apiDone) {
          setTimeout(() => {
            this.smartResults = apiResults;
            this.isSearching = false;
            this.searchDone = true;
            this.showDropdown = true; 
            this.cdr.detectChanges();
          }, 400);
        }
      }, i * 600);
    });

    this.productService.smartSearch(this.searchQuery).subscribe({
      next: (res) => {
        apiResults = res.data || [];
        this.searchMessage =
          res.message || 'Không tìm thấy sản phẩm phù hợp';
        apiDone = true;
        if (this.currentStep === 3) {
          setTimeout(() => {
            this.smartResults = apiResults;
            this.isSearching = false;
            this.searchDone = true;
            this.showDropdown = true;
            this.cdr.detectChanges();
          }, 400);
        }
      },
      error: () => {
        this.isSearching = false;
        this.router.navigate(['/products'], { queryParams: { search: this.searchQuery } });
      }
    });
  }
  fillSearch(text: string) {
  this.searchQuery = text;
  this.onSearch();
  }
}