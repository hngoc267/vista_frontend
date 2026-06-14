import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface CartStateItem {
  qty?: number;
  quantity?: number;
}

@Injectable({
  providedIn: 'root',
})
export class CartStateService {
  private readonly storageKey = 'vista_cart_count';
  private readonly cartCountSubject = new BehaviorSubject<number>(this.readStoredCount());

  cartCount$ = this.cartCountSubject.asObservable();

  setItems(items: CartStateItem[]): void {
    this.updateCountFromItems(items);
  }

  setCount(count: number): void {
    const nextCount = Math.max(0, Number(count) || 0);
    this.cartCountSubject.next(nextCount);
    this.storeCount(nextCount);
  }

  updateCountFromItems(items: CartStateItem[]): void {
    this.setCount(this.getTotalQuantity(items));
  }

  getTotalQuantity(items: CartStateItem[]): number {
    return (items || []).reduce((total, item) => {
      const quantity = Number(item?.qty ?? item?.quantity ?? 0);
      return total + (Number.isFinite(quantity) ? quantity : 0);
    }, 0);
  }

  private readStoredCount(): number {
    if (typeof localStorage === 'undefined') {
      return 0;
    }

    const stored = localStorage.getItem(this.storageKey);
    const parsed = Number.parseInt(stored ?? '0', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  private storeCount(count: number): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    localStorage.setItem(this.storageKey, String(Math.max(0, count)));
  }
}
