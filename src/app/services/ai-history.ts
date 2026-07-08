import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AuthService } from './auth';
import { AiHistoryItem, AiResult, AiCriterion, AiSavedProduct } from './ai-compare';
export type { AiHistoryItem, AiResult, AiCriterion } from './ai-compare';

@Injectable({ providedIn: 'root' })
export class AiHistoryService {

  private readonly MAX_ITEMS = 20;
  private _history$ = new BehaviorSubject<AiHistoryItem[]>([]);
  public history$ = this._history$.asObservable();

  constructor(private authService: AuthService) {

    this.loadFromStorage();


    this.authService.currentUser$.subscribe(() => {
      this.loadFromStorage();
    });
  }


  private getStorageKey(): string {
    const user = this.authService['currentUserSubject']?.getValue();
    const userId = user?.User_id || user?.userId || 'guest';
    return `vista_ai_history_${userId}`;
  }


  getAll(): AiHistoryItem[] {
    return this._history$.getValue();
  }


  getById(id: string): AiHistoryItem | undefined {
    return this.getAll().find(item => item.id === id);
  }


  private resolvePrice(p: any): number {
    const variantPrice =
      p.selectedVariant?.Price ??
      (Array.isArray(p.variants) && p.variants.length > 0 ? p.variants[0]?.Price : undefined);

    return Number(variantPrice ?? p.min_price ?? p.price ?? 0) || 0;
  }


  save(
    products: any[],
    criteria: AiCriterion[],
    result: AiResult,
    categoryName: string
  ): AiHistoryItem {

    const savedProducts: AiSavedProduct[] = products.map(p => ({
      Product_name: p.Product_name ?? '',
      Category_id: p.Category_id ?? '',
      Images: Array.isArray(p.Images) ? p.Images : [],
      Discount: Number(p.Discount) || 0,
      min_price: Number(p.min_price) || 0,
      price: this.resolvePrice(p), 
      selectedVariantId: p.selectedVariantId ?? p.selectedVariant?.Product_variant_id ?? null,
      selectedVariant: p.selectedVariant
        ? {
            Price: Number(p.selectedVariant.Price) || 0,
            Variant_name: p.selectedVariant.Variant_name ?? '',
            Product_variant_id: p.selectedVariant.Product_variant_id ?? undefined,
          }
        : null,
    }));

    const newItem: AiHistoryItem = {
      id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      productNames: products.map(p => p.Product_name),
      categoryName,
      criteria,
      result,
      savedProducts,
    };

    const updated = [newItem, ...this.getAll()].slice(0, this.MAX_ITEMS);
    this.updateStorage(updated);
    return newItem;
  }


  remove(id: string): void {
    const updated = this.getAll().filter(item => item.id !== id);
    this.updateStorage(updated);
  }


  clearAll(): void {
    this.updateStorage([]);
  }


  private updateStorage(items: AiHistoryItem[]): void {
    this._history$.next(items);
    try {
      localStorage.setItem(this.getStorageKey(), JSON.stringify(items));
    } catch (e) {
      console.warn('Không thể lưu lịch sử AI:', e);
    }
  }

  private loadFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.getStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          this._history$.next(parsed);
          return;
        }
      }

      this._history$.next([]);
    } catch (e) {
      console.warn('Không thể đọc lịch sử AI:', e);
      this._history$.next([]);
    }
  }
}