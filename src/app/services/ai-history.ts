// ============================================================
// AI HISTORY SERVICE
// Đặt tại: src/app/services/ai-history.service.ts
// ============================================================
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
    // Load lịch sử của user hiện tại ngay khi service khởi động
    this.loadFromStorage();

    // Khi user đổi (login/logout) → load lại lịch sử đúng người
    this.authService.currentUser$.subscribe(() => {
      this.loadFromStorage();
    });
  }

  // ── KEY động theo userId ─────────────────────────────────
  // Tài khoản A và B sẽ có key khác nhau → không đụng dữ liệu nhau
  private getStorageKey(): string {
    const user = this.authService['currentUserSubject']?.getValue();
    const userId = user?.User_id || user?.userId || 'guest';
    return `vista_ai_history_${userId}`;
  }

  // ── LẤY TOÀN BỘ LỊCH SỬ ────────────────────────────────
  getAll(): AiHistoryItem[] {
    return this._history$.getValue();
  }

  // ── LẤY 1 BẢN GHI THEO ID ───────────────────────────────
  getById(id: string): AiHistoryItem | undefined {
    return this.getAll().find(item => item.id === id);
  }

  // ── RESOLVE GIÁ GỐC TẠI THỜI ĐIỂM LƯU ──────────────────
  // Sản phẩm gốc từ compare-page có thể mang giá ở nhiều "hình dạng"
  // khác nhau: selectedVariant (object đơn), variants (mảng), hoặc
  // min_price/price (số trực tiếp trên product). Vì lúc lưu ta có đầy
  // đủ dữ liệu gốc, nên resolve & chốt luôn 1 con số ở đây — tránh việc
  // result-page phải "đoán lại" từ snapshot rút gọn (đã từng gây bug
  // hiện 0đ khi shape không khớp).
  private resolvePrice(p: any): number {
    const variantPrice =
      p.selectedVariant?.Price ??
      (Array.isArray(p.variants) && p.variants.length > 0 ? p.variants[0]?.Price : undefined);

    return Number(variantPrice ?? p.min_price ?? p.price ?? 0) || 0;
  }

  // ── LƯU KẾT QUẢ MỚI ────────────────────────────────────
  save(
    products: any[],
    criteria: AiCriterion[],
    result: AiResult,
    categoryName: string
  ): AiHistoryItem {
    // Snapshot nhẹ — chỉ giữ field cần thiết để result-page hiển thị
    // lại ảnh và giá khi user xem từ lịch sử. Không lưu toàn bộ product
    // tránh localStorage bị phình to.
    const savedProducts: AiSavedProduct[] = products.map(p => ({
      Product_name: p.Product_name ?? '',
      Category_id: p.Category_id ?? '',
      Images: Array.isArray(p.Images) ? p.Images : [],
      Discount: Number(p.Discount) || 0,
      min_price: Number(p.min_price) || 0,
      price: this.resolvePrice(p), // giá gốc đã resolve sẵn — nguồn chính khi restore
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

  // ── XÓA 1 BẢN GHI ───────────────────────────────────────
  remove(id: string): void {
    const updated = this.getAll().filter(item => item.id !== id);
    this.updateStorage(updated);
  }

  // ── XÓA TẤT CẢ (của user hiện tại thôi) ────────────────
  clearAll(): void {
    this.updateStorage([]);
  }

  // ── INTERNAL ─────────────────────────────────────────────
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
      // Không có dữ liệu → reset về mảng rỗng
      this._history$.next([]);
    } catch (e) {
      console.warn('Không thể đọc lịch sử AI:', e);
      this._history$.next([]);
    }
  }
}