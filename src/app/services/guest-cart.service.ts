import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, concatMap, from, map, of, switchMap, tap, toArray } from 'rxjs';
import Swal from 'sweetalert2';
import { CartApiItem, CartService } from './cart';

/**
 * Giỏ hàng của khách chưa đăng nhập (Guest), lưu tạm trong localStorage của trình duyệt.
 * Khi khách đăng nhập, các sản phẩm trong giỏ này được gộp vào giỏ hàng của tài khoản (mergeIntoAccount).
 */

export const GUEST_CART_STORAGE_KEY = 'vista_guest_cart';

export interface GuestCartVariantOption {
  productVariantId: string;
  variantName: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  stock: number;
}

export interface GuestCartItem {
  productVariantId: string;
  productId: string | null;
  name: string;
  variantName: string;
  specs: string;
  image: string;
  price: number;
  originalPrice: number;
  discountPercent: number;
  quantity: number;
  /** Tồn kho tại thời điểm thêm vào giỏ. 0 = chưa biết (sẽ được cập nhật khi mở trang giỏ hàng). */
  stock: number;
  variantOptions: GuestCartVariantOption[];
}

export type GuestCartItemInput = Omit<GuestCartItem, 'quantity'>;

export interface GuestCartResult {
  success: boolean;
  message?: string;
}

export interface GuestCartMergeResult {
  /** Số sản phẩm đã được đưa vào giỏ hàng của tài khoản */
  mergedCount: number;
  /** Các lưu ý cho khách (số lượng bị giảm, sản phẩm không còn bán...) */
  notes: string[];
}

interface MergeStep {
  added: boolean;
  note?: string;
}

@Injectable({
  providedIn: 'root',
})
export class GuestCartService {
  constructor(
    private cartService: CartService,
    private router: Router
  ) {}

  /** Chưa đăng nhập: cùng cách nhận biết với CartService.getCurrentUserId() mà các trang đang dùng */
  isGuest(): boolean {
    return !this.cartService.getCurrentUserId();
  }

  getItems(): GuestCartItem[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const parsed = JSON.parse(localStorage.getItem(GUEST_CART_STORAGE_KEY) || '[]');
      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed
        .filter((item) => item && typeof item.productVariantId === 'string' && item.productVariantId)
        .map((item): GuestCartItem => ({
          productVariantId: item.productVariantId,
          productId: item.productId || null,
          name: String(item.name || 'Sản phẩm VISTA'),
          variantName: String(item.variantName || ''),
          specs: String(item.specs || item.variantName || ''),
          image: String(item.image || ''),
          price: Number(item.price) || 0,
          originalPrice: Number(item.originalPrice || item.price) || 0,
          discountPercent: Number(item.discountPercent) || 0,
          quantity: Math.max(1, Math.floor(Number(item.quantity) || 1)),
          stock: Math.max(0, Math.floor(Number(item.stock) || 0)),
          variantOptions: Array.isArray(item.variantOptions) ? item.variantOptions : [],
        }));
    } catch {
      return [];
    }
  }

  hasItems(): boolean {
    return this.getItems().length > 0;
  }

  getTotalQuantity(): number {
    return this.getItems().reduce((total, item) => total + item.quantity, 0);
  }

  saveItems(items: GuestCartItem[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      if (items.length === 0) {
        localStorage.removeItem(GUEST_CART_STORAGE_KEY);
      } else {
        localStorage.setItem(GUEST_CART_STORAGE_KEY, JSON.stringify(items));
      }
    } catch {
      // Trình duyệt đầy hoặc chặn localStorage: bỏ qua, giỏ hàng chỉ không được lưu tạm
    }
  }

  clear(): void {
    this.saveItems([]);
  }

  /** Thêm một sản phẩm vào giỏ Guest (cộng dồn số lượng nếu đã có). Kiểm tra tồn kho giống backend. */
  addItem(input: GuestCartItemInput, quantity = 1): GuestCartResult {
    const qty = Math.max(1, Math.floor(Number(quantity) || 1));
    const items = this.getItems();
    const existing = items.find((item) => item.productVariantId === input.productVariantId);
    const nextQuantity = (existing?.quantity || 0) + qty;
    const stock = Number(input.stock) || 0;

    if (stock > 0 && nextQuantity > stock) {
      return { success: false, message: 'Số lượng vượt quá tồn kho' };
    }

    const nextItem: GuestCartItem = { ...input, quantity: nextQuantity };
    if (existing) {
      items[items.indexOf(existing)] = nextItem;
    } else {
      items.push(nextItem);
    }

    this.saveItems(items);
    return { success: true };
  }

  /** Dựng và thêm sản phẩm từ dữ liệu sản phẩm / phiên bản mà các trang đang có sẵn (API /products). */
  addProduct(product: any, variant: any, variants: any[], quantity = 1): GuestCartResult {
    if (!variant?.Product_variant_id) {
      return { success: false, message: 'Sản phẩm chưa có phiên bản cụ thể.' };
    }

    if (product?.Status && product.Status !== 'on_sale') {
      return { success: false, message: 'Sản phẩm hiện không còn được bán' };
    }

    if (Number(variant.Stock_quantity) <= 0) {
      return { success: false, message: 'Sản phẩm hiện đã hết hàng' };
    }

    return this.addItem(this.buildItem(product, variant, variants), quantity);
  }

  setQuantity(productVariantId: string, quantity: number): void {
    const nextQuantity = Math.max(1, Math.floor(Number(quantity) || 1));
    this.saveItems(
      this.getItems().map((item) =>
        item.productVariantId === productVariantId ? { ...item, quantity: nextQuantity } : item
      )
    );
  }

  removeItems(productVariantIds: string[]): void {
    const removed = new Set(productVariantIds);
    this.saveItems(this.getItems().filter((item) => !removed.has(item.productVariantId)));
  }

  /** Hiện popup thông báo sau khi thêm vào giỏ Guest (giống popup của khách đã đăng nhập). */
  showAddResult(result: GuestCartResult): void {
    if (result.success) {
      Swal.fire({
        icon: 'success',
        title: 'Đã thêm vào giỏ hàng',
        text: 'Sản phẩm đã được lưu trong giỏ hàng. Bạn cần đăng nhập khi đặt hàng.',
        confirmButtonColor: '#2563B0',
      });
      return;
    }

    Swal.fire({
      icon: 'error',
      title: 'Không thể thêm vào giỏ hàng',
      text: result.message || 'Vui lòng thử lại sau.',
      confirmButtonColor: '#2563B0',
    });
  }

  /**
   * Yêu cầu đăng nhập (đặt hàng / thanh toán). Chọn "Đăng nhập" sẽ chuyển tới trang đăng nhập
   * và quay lại returnUrl sau khi đăng nhập xong.
   */
  requireLogin(message: string, returnUrl: string, onCancel?: () => void): void {
    Swal.fire({
      icon: 'warning',
      title: 'Vui lòng đăng nhập',
      text: message,
      showCancelButton: true,
      confirmButtonText: 'Đăng nhập',
      cancelButtonText: 'Để sau',
      confirmButtonColor: '#2563B0',
    }).then((result) => {
      if (result.isConfirmed) {
        this.router.navigate(['/login'], { queryParams: { returnUrl } });
      } else if (onCancel) {
        onCancel();
      }
    });
  }

  /**
   * Gộp giỏ Guest vào giỏ hàng của tài khoản vừa đăng nhập. Từng sản phẩm được xóa khỏi giỏ Guest
   * ngay khi gộp xong; sản phẩm gặp lỗi mạng vẫn được giữ lại để thử lại lần sau (không bị mất).
   */
  mergeIntoAccount(userId: string): Observable<GuestCartMergeResult> {
    const guestItems = this.getItems();
    if (!userId || guestItems.length === 0) {
      return of({ mergedCount: 0, notes: [] });
    }

    return this.cartService.getCart(userId).pipe(
      map((res) => res.data?.items || []),
      catchError(() => of([] as CartApiItem[])),
      switchMap((serverItems) => {
        const accountQuantities = new Map<string, number>();
        serverItems.forEach((item) => {
          accountQuantities.set(item.productVariantId, Number(item.quantity) || 0);
        });

        return from(guestItems).pipe(
          concatMap((item) => this.mergeOneItem(userId, item, accountQuantities.get(item.productVariantId) || 0)),
          toArray()
        );
      }),
      map((steps) => ({
        mergedCount: steps.filter((step) => step.added).length,
        notes: steps.map((step) => step.note || '').filter(Boolean),
      }))
    );
  }

  /** Nội dung thông báo sau khi gộp giỏ (chuỗi rỗng nếu không có gì để báo). */
  describeMerge(result: GuestCartMergeResult): string {
    const lines: string[] = [];

    if (result.mergedCount > 0) {
      lines.push(`Đã chuyển ${result.mergedCount} sản phẩm trong giỏ hàng tạm vào giỏ hàng của bạn.`);
    }

    return [...lines, ...result.notes].join('\n');
  }

  private mergeOneItem(userId: string, item: GuestCartItem, accountQuantity: number): Observable<MergeStep> {
    const room = item.stock > 0 ? item.stock - accountQuantity : item.quantity;
    const quantity = Math.min(item.quantity, room);

    if (quantity < 1) {
      this.removeItems([item.productVariantId]);
      return of({
        added: false,
        note: `${item.name}: giỏ hàng của bạn đã có số lượng tối đa nên không thêm nữa.`,
      });
    }

    return this.cartService.addToCart(userId, item.productVariantId, quantity).pipe(
      tap(() => this.removeItems([item.productVariantId])),
      map((): MergeStep => ({
        added: true,
        note: quantity < item.quantity ? `${item.name}: số lượng đã được giảm còn ${quantity} do giới hạn tồn kho.` : '',
      })),
      catchError((error) => {
        // Lỗi mạng / máy chủ: giữ lại trong giỏ Guest. Lỗi nghiệp vụ (hết hàng, ngừng bán...): báo cho khách.
        if (!error?.status || error.status >= 500) {
          return of<MergeStep>({ added: false });
        }

        this.removeItems([item.productVariantId]);
        return of<MergeStep>({
          added: false,
          note: `${item.name}: ${error.error?.message || 'không thể thêm vào giỏ hàng'}.`,
        });
      })
    );
  }

  private buildItem(product: any, variant: any, variants: any[]): GuestCartItemInput {
    const discount = this.clampDiscount(product?.Discount);
    const originalPrice = Number(variant?.Price ?? product?.min_price) || 0;

    return {
      productVariantId: variant.Product_variant_id,
      productId: product?.Product_id || null,
      name: product?.Product_name || 'Sản phẩm VISTA',
      variantName: variant?.Variant_name || '',
      specs: variant?.Variant_name || '',
      image: product?.Images?.[0] || '',
      price: this.finalPrice(originalPrice, discount),
      originalPrice,
      discountPercent: discount,
      stock: Number(variant?.Stock_quantity) || 0,
      variantOptions: (variants || [])
        .filter((option) => Number(option?.Stock_quantity) > 0)
        .map((option) => ({
          productVariantId: option.Product_variant_id,
          variantName: option.Variant_name || '',
          price: this.finalPrice(Number(option.Price) || 0, discount),
          originalPrice: Number(option.Price) || 0,
          discountPercent: discount,
          stock: Number(option.Stock_quantity) || 0,
        })),
    };
  }

  private clampDiscount(value: unknown): number {
    return Math.max(0, Math.min(100, Number(value) || 0));
  }

  /** Cùng cách làm tròn với backend (cart.controller.js: getFinalPrice) */
  private finalPrice(originalPrice: number, discount: number): number {
    return Math.round((originalPrice * (100 - discount)) / 100);
  }
}
