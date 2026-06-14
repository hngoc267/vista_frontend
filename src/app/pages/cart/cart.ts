import { Component, ChangeDetectorRef, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CartService, CartApiItem } from '../../services/cart';
import { CartStateService } from '../../services/cart-state.service';

interface CartItem {
  id: string;
  productVariantId: string;
  name: string;
  specs: string;
  price: number;
  qty: number;
  stock: number;
  img: string;
  selected: boolean;
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
    private cartState: CartStateService
  ) {}

  ngOnInit(): void {
    this.loadCart();
  }

  get itemCount(): number {
    return this.items.length;
  }

  get selectedLineCount(): number {
    return this.items.filter((item) => item.selected).length;
  }

  get selectedItemsCount(): number {
    return this.items.reduce((sum, item) => (item.selected ? sum + item.qty : sum), 0);
  }

  get grandTotal(): number {
    return this.subtotal();
  }

  formatPrice(value: number): string {
    if (value === 0) {
      return '0 đ';
    }

    return value ? value.toLocaleString('vi-VN').replace(/,/g, '.') + ' đ' : 'Liên hệ';
  }

  toggleAll(checked: boolean): void {
    this.items.forEach((item) => {
      item.selected = checked;
    });
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
    if (nextQuantity < 1) {
      return;
    }
    if (item.stock > 0 && nextQuantity > item.stock) {
      return;
    }

    const selectedIds = this.getSelectedItemIds();
    this.cartService.updateCartItem(item.id, nextQuantity).subscribe({
      next: () => this.loadCart(true, selectedIds),
      error: () => this.loadCart(true, selectedIds),
    });
  }

  trackByItemId(_index: number, item: CartItem): string {
    return item.id;
  }

  lineTotal(item: CartItem): number {
    return item.price * item.qty;
  }

  subtotal(): number {
    return this.items.reduce((sum, item) => (item.selected ? sum + this.lineTotal(item) : sum), 0);
  }

  removeItem(item: CartItem): void {
    const selectedIds = this.getSelectedItemIds();
    this.cartService.removeCartItem(item.id).subscribe({
      next: () => this.loadCart(true, selectedIds),
      error: () => this.loadCart(true, selectedIds),
    });
  }

  removeSelected(): void {
    const selectedIds = this.getSelectedItemIds();
    if (selectedIds.length === 0) {
      return;
    }

    const userId = this.cartService.getCurrentUserId();
    if (!userId) {
      this.items = [];
      this.cartState.setCount(0);
      this.cdr.detectChanges();
      return;
    }

    this.cartService.removeSelectedItems(userId, selectedIds).subscribe({
      next: () => this.loadCart(true, selectedIds),
      error: () => this.loadCart(true, selectedIds),
    });
  }

  private loadCart(preserveSelection = false, selectedIds: string[] = []): void {
    const userId = this.cartService.getCurrentUserId();
    if (!userId) {
      this.items = [];
      this.cartState.setCount(0);
      this.cdr.detectChanges();
      return;
    }

    const selectedSet = new Set(selectedIds);
    this.cartService.getCart(userId).subscribe({
      next: (res) => {
        const apiItems = res.data?.items || [];
        this.items = apiItems.map((item: CartApiItem) => this.mapApiItem(item, preserveSelection, selectedSet));
        this.cartState.setCount(res.data?.cart?.Total_product ?? this.cartState.getTotalQuantity(this.items));
        this.cdr.detectChanges();
      },
      error: () => {
        this.items = [];
        this.cartState.setCount(0);
        this.cdr.detectChanges();
      },
    });
  }

  private mapApiItem(item: CartApiItem, preserveSelection: boolean, selectedIds: Set<string>): CartItem {
    return {
      id: item.cartItemId,
      productVariantId: item.productVariantId,
      name: item.productName,
      specs: item.specs || item.variantName || '',
      price: Number(item.unitPrice) || 0,
      qty: Number(item.quantity) || 0,
      stock: Number(item.stockQuantity) || 0,
      img: this.resolveImageSrc(item.image),
      selected: preserveSelection ? selectedIds.has(item.cartItemId) : true,
    };
  }

  private getSelectedItemIds(): string[] {
    return this.items.filter((item) => item.selected).map((item) => item.id);
  }

  private resolveImageSrc(image?: string): string {
    if (!image) {
      return '/assets/images/asus-vivobook-15-indie-black.jpg';
    }

    if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/')) {
      return image;
    }

    return `/assets/images/${image}`;
  }
}
