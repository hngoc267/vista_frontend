import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService, CartApiItem } from '../../services/cart';
import { CartStateService } from '../../services/cart-state.service';
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
    private notificationService: NotificationService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.loadCart();
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
      this.items = [];
      this.cartState.setCount(0);
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
    sessionStorage.setItem('vista_checkout_items', JSON.stringify(selectedItems));
    sessionStorage.setItem('vista_checkout_source', JSON.stringify({ type: 'cart' }));
    this.router.navigate(['/order']);
  }

  private loadCart(preserveSelection = false, selectedIds: string[] = []): void {
    const userId = this.cartService.getCurrentUserId();
    if (!userId) {
      this.items = [];
      this.cartState.setCount(0);
      return;
    }

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

  private getSelectedItemIds(): string[] {
    return this.items.filter((item) => item.selected).map((item) => item.id);
  }

  private resolveImageSrc(image?: string): string {
    if (!image) return '/assets/images/asus-vivobook-15-indie-black.jpg';
    if (image.startsWith('http')) return image;
    return `/assets/images/${image}`;
  }
}
