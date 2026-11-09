import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import Swal from 'sweetalert2';
import { environment } from '../../environments/environment';
import { AuthService } from './auth';

export interface WishlistEntry {
  productId: string;
  addedAt: string;
}

export interface WishlistVariant {
  Product_variant_id: string;
  Variant_name: string;
  Price: number;
  Stock_quantity: number;
}

export interface WishlistProductCard {
  Product_id: string;
  Product_name: string;
  Image: string;
  Discount: number;
  Is_AI: boolean;
  Is_Flash_Sale: boolean;
  Average_rating: number;
  Technical_specs: any;
  Status: 'on_sale' | 'out_of_stock' | 'discontinued';
  Min_price: number;
  Variants: WishlistVariant[];
}

const GUEST_STORAGE_KEY = 'vista_wishlist_guest';
const USER_STORAGE_PREFIX = 'vista_wishlist_';
const MAX_ITEMS = 200;

// Đặt false nếu nhóm không chốt đồng bộ tài khoản: danh sách chỉ lưu trên trình duyệt
const ENABLE_ACCOUNT_SYNC = true;

@Injectable({
  providedIn: 'root',
})
export class WishlistService {
  private readonly apiUrl = `${environment.apiUrl}/wishlist`;

  private currentUserId: string | null = null;
  private readonly itemsSubject = new BehaviorSubject<WishlistEntry[]>([]);
  private idSet = new Set<string>();

  items$ = this.itemsSubject.asObservable();
  count$ = this.items$.pipe(map((items) => items.length));

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {
    // Đổi tài khoản (đăng nhập, đăng xuất) thì nạp lại đúng danh sách của người đó
    this.authService.currentUser$.subscribe((user) => {
      const nextUserId: string | null = user?.User_id || null;
      if (this.started && nextUserId === this.currentUserId) {
        return;
      }

      this.started = true;
      this.currentUserId = nextUserId;
      this.setItems(this.readStorage(this.storageKey()));

      if (nextUserId && ENABLE_ACCOUNT_SYNC) {
        this.mergeIntoAccount();
      }
    });
  }

  private started = false;

  getEntries(): WishlistEntry[] {
    return this.itemsSubject.value;
  }

  getCount(): number {
    return this.itemsSubject.value.length;
  }

  isInWishlist(productId: string): boolean {
    return this.idSet.has(productId);
  }

  // Bấm trái tim: chưa có thì thêm, có rồi thì bỏ. Trả về true nếu vừa thêm.
  toggle(productId: string): boolean {
    if (this.isInWishlist(productId)) {
      this.remove(productId);
      return false;
    }

    return this.add(productId);
  }

  add(productId: string, silent = false): boolean {
    const id = String(productId || '').trim();
    if (!id || this.isInWishlist(id)) {
      return true;
    }

    if (this.getCount() >= MAX_ITEMS) {
      Swal.fire({
        icon: 'warning',
        title: 'Danh sách yêu thích đã đầy',
        text: `Bạn chỉ lưu tối đa ${MAX_ITEMS} sản phẩm. Hãy bỏ bớt sản phẩm để thêm mới.`,
        confirmButtonColor: '#2563B0',
      });
      return false;
    }

    this.saveItems([{ productId: id, addedAt: new Date().toISOString() }, ...this.getEntries()]);

    if (this.currentUserId && ENABLE_ACCOUNT_SYNC) {
      this.http.post(`${this.apiUrl}/${encodeURIComponent(id)}`, {}).subscribe({ error: () => {} });
    }

    if (!silent) {
      this.toast('success', 'Đã thêm vào yêu thích');
    }
    return true;
  }

  remove(productId: string, silent = false): void {
    const id = String(productId || '').trim();
    if (!id || !this.isInWishlist(id)) {
      return;
    }

    this.saveItems(this.getEntries().filter((item) => item.productId !== id));

    if (this.currentUserId && ENABLE_ACCOUNT_SYNC) {
      this.http.delete(`${this.apiUrl}/${encodeURIComponent(id)}`).subscribe({ error: () => {} });
    }

    if (!silent) {
      this.toast('info', 'Đã bỏ khỏi yêu thích');
    }
  }

  clear(): void {
    this.saveItems([]);

    if (this.currentUserId && ENABLE_ACCOUNT_SYNC) {
      this.http.delete(this.apiUrl).subscribe({ error: () => {} });
    }
  }

  // Lấy thông tin hiển thị (tên, ảnh, giá, tồn kho, phiên bản) cho các mã sản phẩm
  lookup(productIds: string[]): Observable<WishlistProductCard[]> {
    return this.http
      .post<{ success: boolean; data: WishlistProductCard[] }>(`${this.apiUrl}/lookup`, { productIds })
      .pipe(map((res) => res.data || []));
  }

  // Sau đăng nhập: gộp danh sách trên trình duyệt (cả của Guest) vào tài khoản
  private mergeIntoAccount(): void {
    const userId = this.currentUserId;
    if (!userId) {
      return;
    }

    const guestEntries = this.readStorage(GUEST_STORAGE_KEY);
    const localEntries = this.getEntries();
    const merged = this.mergeEntries(localEntries, guestEntries);

    if (guestEntries.length > 0) {
      this.saveItems(merged);
      this.removeStorage(GUEST_STORAGE_KEY);
    }

    this.http
      .post<{ success: boolean; data: { productIds: string[] } }>(`${this.apiUrl}/merge`, {
        productIds: merged.map((item) => item.productId),
      })
      .subscribe({
        next: (res) => {
          // Người dùng đã đổi tài khoản trong lúc chờ thì bỏ qua kết quả cũ
          if (this.currentUserId !== userId) {
            return;
          }

          const serverIds = res?.data?.productIds;
          if (!Array.isArray(serverIds)) {
            return;
          }

          const addedAtById = new Map(merged.map((item) => [item.productId, item.addedAt]));
          const now = Date.now();
          this.saveItems(
            serverIds.map((id, index) => ({
              productId: id,
              addedAt: addedAtById.get(id) || new Date(now - index).toISOString(),
            }))
          );
        },
        error: () => {
          // Giữ danh sách trên trình duyệt, lần tải trang sau sẽ đồng bộ lại
        },
      });
  }

  private mergeEntries(primary: WishlistEntry[], secondary: WishlistEntry[]): WishlistEntry[] {
    const seen = new Set<string>();
    return [...primary, ...secondary]
      .filter((item) => {
        if (seen.has(item.productId)) {
          return false;
        }
        seen.add(item.productId);
        return true;
      })
      .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime())
      .slice(0, MAX_ITEMS);
  }

  private storageKey(): string {
    return this.currentUserId ? `${USER_STORAGE_PREFIX}${this.currentUserId}` : GUEST_STORAGE_KEY;
  }

  private saveItems(items: WishlistEntry[]): void {
    this.writeStorage(this.storageKey(), items);
    this.setItems(items);
  }

  private setItems(items: WishlistEntry[]): void {
    this.idSet = new Set(items.map((item) => item.productId));
    this.itemsSubject.next(items);
  }

  private readStorage(key: string): WishlistEntry[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const raw = localStorage.getItem(key);
      const parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) {
        return [];
      }

      const seen = new Set<string>();
      return parsed
        .filter((item: any) => item && typeof item.productId === 'string' && item.productId)
        .filter((item: any) => (seen.has(item.productId) ? false : (seen.add(item.productId), true)))
        .map((item: any) => ({
          productId: item.productId,
          addedAt: item.addedAt || new Date().toISOString(),
        }));
    } catch {
      return [];
    }
  }

  private writeStorage(key: string, items: WishlistEntry[]): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(key, JSON.stringify(items));
    } catch {
      // Trình duyệt chặn lưu trữ: danh sách chỉ còn trong phiên làm việc hiện tại
    }
  }

  private removeStorage(key: string): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.removeItem(key);
    } catch {
      // bỏ qua
    }
  }

  private toast(icon: 'success' | 'info', title: string): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title,
      showConfirmButton: false,
      timer: 1800,
      timerProgressBar: true,
    });
  }
}
