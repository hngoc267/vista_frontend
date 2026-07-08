// src/app/pages/ai-compare/result-page/result-page.ts
import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { Subscription } from 'rxjs';
import { AiCompareService, AiResult } from '../../../services/ai-compare';
import { AiHistoryService } from '../../../services/ai-history';
import { CartService } from '../../../services/cart';
import { CartStateService } from '../../../services/cart-state.service';
import { ChangeDetectorRef } from '@angular/core';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-result-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './result-page.html',
  styleUrls: ['./result-page.scss']
})
export class ResultPage implements OnInit, OnDestroy {

  result: AiResult | null = null;
  products: any[] = [];
  isLoading = false;
  private subs: Subscription[] = [];
  private saved = false;
  private hasResult = false;
  private hasProducts = false;

  constructor(
    private aiCompareService: AiCompareService,
    private aiHistoryService: AiHistoryService,
    private router: Router,
    private location: Location,
    private cartService: CartService,
    private cartState: CartStateService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.products = this.aiCompareService.getProducts();
    this.subs.push(
      this.aiCompareService.result$.subscribe(r => {
        this.result = r;
        this.hasResult = !!r;
        if (r && this.hasProducts && !this.saved) {
          this.saveHistory(r);
        }
        this.cdr.detectChanges();
      })
    );

    this.subs.push(
      this.aiCompareService.products$.subscribe(p => {
        this.products = p;
        this.hasProducts = p.length > 0;
        if (this.hasResult && this.hasProducts && !this.saved && this.result) {
          this.saveHistory(this.result);
        }
        this.cdr.detectChanges();
      })
    );

    this.subs.push(
    this.aiCompareService.loading$.subscribe(l => {
      this.isLoading = l;
      this.cdr.detectChanges(); 
    })
  );

    if (!this.aiCompareService.getResult() && !this.isLoading) {
      this.router.navigate(['/compare']);
    }
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  private saveHistory(result: AiResult): void {
    if (this.products.length === 0) return;
    const categoryName = this.products[0]?.Category_name || this.products[0]?.Category_id || 'Sản phẩm';
    const criteria = this.aiCompareService['_criteria$']?.getValue() || [];
    this.aiHistoryService.save(this.products, criteria, result, categoryName);
    this.saved = true;
    console.log('✅ Đã lưu lịch sử:', result.recommendation);
  }

  private resolveVariantId(product: any): string | null {
    if (product.selectedVariantId) return product.selectedVariantId;

    if (product.selectedVariant?.Product_variant_id) {
      return product.selectedVariant.Product_variant_id;
    }

    if (Array.isArray(product.variants) && product.variants.length > 0) {
      return product.variants[0]?.Product_variant_id ?? null;
    }

    return null;
  }

  private resolveVariant(product: any, variantId: string | null): any {
    
    if (product.selectedVariant) {
      if (!variantId || product.selectedVariant.Product_variant_id === variantId) {
        return product.selectedVariant;
      }
    }

    
    if (Array.isArray(product.variants) && product.variants.length > 0) {
      if (variantId) {
        const found = product.variants.find((v: any) => v.Product_variant_id === variantId);
        if (found) return found;
      }
      return product.variants[0];
    }

    
    return product.selectedVariant ?? null;
  }

getProductImage(index: number): string {
  const p = this.products[index];
  if (p?.Images && p.Images.length > 0) {
    const img = p.Images[0];
    return img.startsWith('http') ? img : `/assets/images/${img}`;
  }
  return 'assets/default-product.png';
}

  
  getProductPrice(index: number): string {
    const p = this.products[index];
    if (!p) return '0đ';

    let price: number;

    if (typeof p.price === 'number' && p.price > 0) {
      price = p.price;
    } else {
      const variantId = this.resolveVariantId(p);
      const variant   = this.resolveVariant(p, variantId);
      price = Number(variant?.Price) || Number(p.min_price) || Number(p.price) || 0;
    }

    const discount   = Number(p.Discount) || 0;
    const finalPrice = discount > 0 ? price * (1 - discount / 100) : price;
    return Math.round(finalPrice).toLocaleString('vi-VN') + 'đ';
  }

  onAdjust(): void {
    this.router.navigate(['/ai-compare']);
  }

  onChooseOther(): void {
    this.router.navigate(['/compare']);
  }

  goBack(): void {
    this.location.back();
  }

  goToHistory(): void {
    this.router.navigate(['/ai-history']);
  }

  goToProductDetail(index: number): void {
    const product = this.products[index];
    const productId = product?.Product_id;

    if (!productId) {
      Swal.fire({
        icon: 'info',
        title: 'Không thể xem chi tiết',
        text: 'Sản phẩm này được phục hồi từ lịch sử nên thiếu thông tin để mở trang chi tiết.',
        confirmButtonColor: '#2563B0'
      });
      return;
    }

    this.router.navigate(['/products', productId]);
  }

  addToCart(index: number): void {
    const product = this.products[index];
    if (!product) return;

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

    const variantId = this.resolveVariantId(product);
    if (!variantId) {
      Swal.fire({
        icon: 'warning',
        title: 'Chưa có phiên bản',
        text: 'Sản phẩm chưa có phiên bản cụ thể.',
        confirmButtonColor: '#2563B0'
      });
      return;
    }

    this.cartService.addToCart(userId, variantId, 1).subscribe({
      next: (res: any) => {
        const totalProducts = res.data?.cart?.Total_product ?? this.cartState.getTotalQuantity(res.data?.items || []);
        this.cartState.setCount(totalProducts);
        Swal.fire({
          icon: 'success',
          title: 'Đã thêm vào giỏ hàng',
          text: 'Sản phẩm đã được cập nhật vào giỏ hàng của bạn.',
          confirmButtonColor: '#2563B0'
        });
      },
      error: (err: any) => {
        Swal.fire({
          icon: 'error',
          title: 'Không thể thêm vào giỏ hàng',
          text: err.error?.message || 'Vui lòng thử lại sau.',
          confirmButtonColor: '#2563B0'
        });
      }
    });
  }

  buyNow(index: number): void {
    const product = this.products[index];
    if (!product) return;

    const userId = this.cartService.getCurrentUserId();
    if (!userId) {
      Swal.fire({
        icon: 'warning',
        title: 'Vui lòng đăng nhập',
        text: 'Bạn cần đăng nhập để đặt mua sản phẩm.',
        confirmButtonColor: '#2563B0'
      });
      return;
    }

    const variantId = this.resolveVariantId(product);
    if (!variantId) {
      Swal.fire({
        icon: 'warning',
        title: 'Chưa có phiên bản',
        text: 'Sản phẩm chưa có phiên bản cụ thể.',
        confirmButtonColor: '#2563B0'
      });
      return;
    }

    const variant = this.resolveVariant(product, variantId);

    let price = Number(variant?.Price) || Number(product.min_price) || 0;
    const discount = Number(product.Discount) || 0;
    const finalPrice = discount > 0 ? price * (1 - discount / 100) : price;

    const checkoutItem = {
      cartItemId: '',
      productVariantId: variantId,
      productId: product.Product_id || null,
      name: product.Product_name || 'Sản phẩm VISTA',
      variantName: variant?.Variant_name || '',
      specs: variant?.Variant_name || '',
      image: product.Images?.[0] || '',
      price: finalPrice,
      originalPrice: price,
      discountPercent: discount,
      quantity: 1,
      stock: Number(variant?.Stock_quantity) || 0,
      categoryId: product.Category_id || '',
      categoryName: product.category?.Category_name || '',
      checkoutSource: 'buy_now',
      variantOptions: [] 
    };

    sessionStorage.setItem('vista_checkout_items', JSON.stringify([checkoutItem]));
    sessionStorage.setItem('vista_checkout_source', JSON.stringify({
      type: 'buy_now',
      categoryId: checkoutItem.categoryId,
      categoryName: checkoutItem.categoryName
    }));

    this.router.navigate(['/order']);
  }
}