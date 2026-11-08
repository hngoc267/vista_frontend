import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { CartService, CartApiItem } from '../../services/cart';
import { CartStateService } from '../../services/cart-state.service';
import { GuestCartItem, GuestCartService } from '../../services/guest-cart.service';
import { ProductService } from '../../services/product';
import { NotificationService } from '../../components/notification/notification.service';

interface CartItem {
  id: string;
  productVariantId: string;
  productId: string | null;
  name: string;
  variantName: string;
  specs: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  qty: number;
  stock: number;
  img: string;
  selected: boolean;
  variantOptions: {
    productVariantId: string;
    variantName: string;
    price: number;
    originalPrice?: number;
    discountPercent?: number;
    stock: number;
  }[];
}

@Component({
  selector: 'app-cart',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule],
  templateUrl: './cart.html',
  styleUrl: './cart.scss',
})
export class Cart implements OnInit {
  items: CartItem[] = [];

  constructor(
    private cdr: ChangeDetectorRef,
    private cartService: CartService,
    private cartState: CartStateService,
    private guestCart: GuestCartService,
    private productService: ProductService,
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCart();

    if (this.guestCart.isGuest()) {
      this.refreshGuestItems();
    }
  }

  get itemCount(): number {
    return this.items.length;
  }

  get selectedItemsCount(): number {
    return this.items.reduce((sum, item) => (item.selected ? sum + item.qty : sum), 0);
  }

  get grandTotal(): number {
    return this.subtotal();
  }

  formatPrice(value: number): string {

    if (value === 0 || value === undefined || value === null) {
      return '0 đ';
    }


    return value.toLocaleString('vi-VN').replace(/,/g, '.') + ' đ';
  }

  toggleAll(checked: boolean): void {
    this.items.forEach((item) => (item.selected = checked));
    this.cdr.detectChanges();
  }

  isAllSelected(): boolean {
    return this.items.length > 0 && this.items.every((item) => item.selected);
  }

  toggleItem(item: CartItem, checked: boolean): void {
    item.selected = checked;
    this.cdr.detectChanges();
  }

  changeQuantity(item: CartItem, delta: number): void {
    const nextQuantity = item.qty + delta;
    if (nextQuantity < 1 || (item.stock > 0 && nextQuantity > item.stock)) return;

    item.qty = nextQuantity;
    const selectedIds = this.getSelectedItemIds();

    if (this.guestCart.isGuest()) {
      this.guestCart.setQuantity(item.id, nextQuantity);
      this.loadCart(true, selectedIds);
      return;
    }
    
    this.cartService.updateCartItem(item.id, nextQuantity).subscribe({
      next: () => {
        this.loadCart(true, selectedIds);
        this.cartState.updateCountFromItems(this.items as any);
      },
      error: () => {
        this.notificationService.error('Không thể cập nhật số lượng sản phẩm');
        this.loadCart(true, selectedIds);
      },
    });
  }

  onQuantityBlur(item: CartItem): void {
    let nextQuantity = Number.parseInt(String(item.qty), 10);
    if (!Number.isFinite(nextQuantity) || nextQuantity < 1) nextQuantity = 1;
    if (item.stock > 0 && nextQuantity > item.stock) nextQuantity = item.stock;

    item.qty = nextQuantity;

    const selectedIds = this.getSelectedItemIds();

    if (this.guestCart.isGuest()) {
      this.guestCart.setQuantity(item.id, nextQuantity);
      this.loadCart(true, selectedIds);
      return;
    }

    this.cartService.updateCartItem(item.id, nextQuantity).subscribe({
      next: () => {
        this.loadCart(true, selectedIds);
        this.cartState.updateCountFromItems(this.items as any);
      },
      error: () => {
        this.notificationService.error('Không thể cập nhật số lượng sản phẩm');
        this.loadCart(true, selectedIds);
      },
    });
  }

  trackByItemId(_index: number, item: CartItem): string {
    return item.id;
  }

  lineTotal(item: CartItem): number {
    return item.price * item.qty;
  }

  originalLineTotal(item: CartItem): number {
    return (item.originalPrice || item.price) * item.qty;
  }

  hasItemDiscount(item: CartItem): boolean {
    return Number(item.originalPrice || 0) > Number(item.price || 0);
  }

  subtotal(): number {
    return this.items.reduce((sum, item) => (item.selected ? sum + this.lineTotal(item) : sum), 0);
  }

  removeItem(item: CartItem): void {
    const selectedIds = this.getSelectedItemIds();

    if (this.guestCart.isGuest()) {
      this.guestCart.removeItems([item.id]);
      this.loadCart(true, selectedIds.filter((id) => id !== item.id));
      this.notificationService.success('Đã xóa sản phẩm khỏi giỏ hàng');
      return;
    }

    this.cartService.removeCartItem(item.id).subscribe({
      next: () => {
        this.loadCart(true, selectedIds);
        this.cartState.updateCountFromItems(this.items as any);
        this.notificationService.success('Đã xóa sản phẩm khỏi giỏ hàng');
      },
      error: () => {
        this.notificationService.error('Không thể xóa sản phẩm khỏi giỏ hàng');
        this.loadCart(true, selectedIds);
      },
    });
  }

  removeSelected(): void {
    const selectedIds = this.getSelectedItemIds();
    if (selectedIds.length === 0) return;

    const userId = this.cartService.getCurrentUserId();
    if (!userId) {
      this.guestCart.removeItems(selectedIds);
      this.loadCart(true, selectedIds);
      this.notificationService.success('Đã xóa sản phẩm đã chọn');
      return;
    }

    this.cartService.removeSelectedItems(userId, selectedIds).subscribe({
      next: () => {
        this.loadCart(true, selectedIds);
        this.cartState.updateCountFromItems(this.items as any);
        this.notificationService.success('Đã xóa sản phẩm đã chọn');
      },
      error: () => {
        this.notificationService.error('Không thể xóa các sản phẩm đã chọn');
        this.loadCart(true, selectedIds);
      },
    });
  }

  checkout(): void {
    const selectedItems = this.items.filter((item) => item.selected);
    if (selectedItems.length === 0) return;

    // Guest vẫn thêm / sửa giỏ hàng được, nhưng đặt hàng và thanh toán phải đăng nhập
    if (this.guestCart.isGuest()) {
      this.guestCart.requireLogin(
        'Bạn cần đăng nhập để đặt hàng và thanh toán. Các sản phẩm trong giỏ hàng sẽ được giữ lại.',
        '/cart'
      );
      return;
    }

    sessionStorage.setItem('vista_checkout_items', JSON.stringify(selectedItems));
    sessionStorage.setItem('vista_checkout_source', JSON.stringify({ type: 'cart' }));
    this.router.navigate(['/order']);
  }

  private loadCart(preserveSelection = false, selectedIds: string[] = []): void {
    const userId = this.cartService.getCurrentUserId();
    if (!userId) {
      this.loadGuestCart(preserveSelection, selectedIds);
      return;
    }

    // Đã đăng nhập nhưng giỏ hàng tạm của Guest còn sản phẩm: gộp vào giỏ hàng tài khoản trước khi hiển thị
    if (this.guestCart.hasItems()) {
      this.guestCart.mergeIntoAccount(userId).subscribe((result) => {
        const notice = this.guestCart.describeMerge(result);
        if (notice) {
          this.notificationService.info(notice);
        }
        this.loadServerCart(userId, preserveSelection, selectedIds);
      });
      return;
    }

    this.loadServerCart(userId, preserveSelection, selectedIds);
  }

  private loadGuestCart(preserveSelection = false, selectedIds: string[] = []): void {
    const selectedSet = new Set(selectedIds);
    this.items = this.guestCart.getItems().map((item) => this.mapGuestItem(item, preserveSelection, selectedSet));
    this.cartState.setCount(this.guestCart.getTotalQuantity());
    this.cdr.detectChanges();
  }

  /** Cập nhật giá / tồn kho mới nhất cho các sản phẩm trong giỏ hàng Guest (dữ liệu lưu tạm có thể đã cũ). */
  private refreshGuestItems(): void {
    const productIds = [
      ...new Set(
        this.guestCart
          .getItems()
          .map((item) => item.productId)
          .filter((id): id is string => !!id)
      ),
    ];
    if (productIds.length === 0) return;

    forkJoin(
      productIds.map((id) => this.productService.getProductById(id).pipe(catchError(() => of(null))))
    ).subscribe((responses) => {
      const variantMap = new Map<string, { product: any; variant: any }>();
      responses.forEach((res) => {
        const product = res?.data;
        (product?.variants || []).forEach((variant: any) => {
          variantMap.set(variant.Product_variant_id, { product, variant });
        });
      });

      const refreshed = this.guestCart.getItems().map((item): GuestCartItem => {
        const found = variantMap.get(item.productVariantId);
        if (!found) return item;

        const discount = Math.max(0, Math.min(100, Number(found.product?.Discount) || 0));
        const originalPrice = Number(found.variant.Price) || item.originalPrice;
        const stock = Number(found.variant.Stock_quantity) || 0;

        return {
          ...item,
          name: found.product?.Product_name || item.name,
          variantName: found.variant.Variant_name || item.variantName,
          specs: found.variant.Variant_name || item.specs,
          image: found.product?.Images?.[0] || item.image,
          originalPrice,
          price: Math.round((originalPrice * (100 - discount)) / 100),
          discountPercent: discount,
          stock,
          quantity: stock > 0 ? Math.min(item.quantity, stock) : item.quantity,
        };
      });

      this.guestCart.saveItems(refreshed);
      this.loadGuestCart(true, this.getSelectedItemIds());
    });
  }

  private loadServerCart(userId: string, preserveSelection: boolean, selectedIds: string[]): void {
    const selectedSet = new Set(selectedIds);
    this.cartService.getCart(userId).subscribe({
      next: (res) => {
        const apiItems = res.data?.items || [];
        this.items = apiItems.map((item: CartApiItem) => this.mapApiItem(item, preserveSelection, selectedSet));
        this.cartState.setCount(res.data?.cart?.Total_product ?? this.cartState.getTotalQuantity(this.items as any));
        this.cdr.detectChanges();
      },
      error: () => {
        this.items = [];
        this.cartState.setCount(0);
        this.notificationService.error('Không thể tải giỏ hàng');
      },
    });
  }

  private mapApiItem(item: CartApiItem, preserveSelection: boolean, selectedIds: Set<string>): CartItem {
    return {
      id: item.cartItemId,
      productVariantId: item.productVariantId,
      productId: item.productId,
      name: item.productName,
      variantName: item.variantName || item.specs || '',
      specs: item.variantName || '',
      price: Number(item.unitPrice) || 0,
      originalPrice: Number(item.originalUnitPrice || item.unitPrice) || 0,
      discountPercent: Number(item.discountPercent) || 0,
      qty: Number(item.quantity) || 0,
      stock: Number(item.stockQuantity) || 0,
      img: this.resolveImageSrc(item.image),
      selected: preserveSelection ? selectedIds.has(item.cartItemId) : true,
      variantOptions: item.variantOptions || [],
    };
  }

  private mapGuestItem(item: GuestCartItem, preserveSelection: boolean, selectedIds: Set<string>): CartItem {
    return {
      id: item.productVariantId,
      productVariantId: item.productVariantId,
      productId: item.productId,
      name: item.name,
      variantName: item.variantName || item.specs || '',
      specs: item.variantName || '',
      price: item.price,
      originalPrice: item.originalPrice || item.price,
      discountPercent: item.discountPercent,
      qty: item.quantity,
      stock: item.stock,
      img: this.resolveImageSrc(item.image),
      selected: preserveSelection ? selectedIds.has(item.productVariantId) : true,
      variantOptions: item.variantOptions,
    };
  }

  private getSelectedItemIds(): string[] {
    return this.items.filter((item) => item.selected).map((item) => item.id);
  }

  private resolveImageSrc(image?: string): string {
    if (!image) return '/assets/images/asus-vivobook-15-indie-black.jpg';
    if (image.startsWith('http')) return image;
    return `/assets/images/${image}`;
  }
}
