import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ProductService } from '../../services/product';
import { CartService } from '../../services/cart';

@Component({
  selector: 'app-flash-sale',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './flash-sale.html',
  styleUrl: './flash-sale.scss'
})
export class FlashSale implements OnInit, OnDestroy {
  products: any[] = [];
  totalProducts = 0;
  totalPages = 0;
  currentPage = 1;
  limit = 16;
  isLoading = false;

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
  private timer: any;

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadFlashSaleProducts();
    this.startCountdowns();
  }

  ngOnDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
  }

  loadFlashSaleProducts(): void {
    this.isLoading = true;

    this.productService.getAllProducts({
      isFlashSale: 'true',
      sort: 'rating',
      page: this.currentPage,
      limit: this.limit
    }).subscribe({
      next: (res) => {
        this.products = res.data || [];
        this.totalProducts = res.pagination?.total || this.products.length;
        this.totalPages = res.pagination?.totalPages || 1;
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.products = [];
        this.totalProducts = 0;
        this.totalPages = 0;
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  startCountdowns(): void {
    this.updateFlashMainCountdown();
    this.updateFlashSlotCountdowns();

    this.timer = setInterval(() => {
      this.flashMainSeconds = Math.max(0, this.flashMainSeconds - 1);
      this.updateFlashMainCountdown();
      this.updateFlashSlotCountdowns();
      this.cdr.detectChanges();
    }, 1000);
  }

  updateFlashMainCountdown(): void {
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

  updateFlashSlotCountdowns(): void {
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

  changePage(page: number): void {
    if (page < 1 || page > this.totalPages) return;

    this.currentPage = page;
    this.loadFlashSaleProducts();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  getPageNumbers(): number[] {
    const pages = [];
    for (let i = 1; i <= this.totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }

  buyFlashSaleNow(product: any, event: Event): void {
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
}