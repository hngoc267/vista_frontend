import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { CartService } from './cart';

export interface CompareItem {
  productId: string;
  variantId: string;
  productName: string;
  thumbnail: string;
  price: number;
  categoryId: string;
  categoryName: string;
  brandName?: string;
  productType?: string; 
}

@Injectable({
  providedIn: 'root'
})
export class CompareService {

  private readonly MAX_ITEMS = 3;
  // ĐÃ XÓA BIẾN STORAGE_KEY CŨ BỊ CỐ ĐỊNH Ở ĐÂY

  private itemsSubject = new BehaviorSubject<CompareItem[]>([]);
  public items$ = this.itemsSubject.asObservable();

  // Subject để báo hiệu vừa thêm sản phẩm (dùng cho widget mở rộng)
  private justAddedSubject = new BehaviorSubject<boolean>(false);
  public justAdded$ = this.justAddedSubject.asObservable();

  constructor(private cartService: CartService) {
    this.loadFromStorage();
  }

  // ==========================================
  // 1. TẠO KEY LƯU TRỮ ĐỘNG THEO USER
  // ==========================================
  private getStorageKey(): string {
    const userId = this.cartService.getCurrentUserId(); 
    if (userId) {
      return `vista_compare_items_${userId}`; // Lưu riêng cho user đăng nhập
    }
    return 'vista_compare_items_guest';       // Lưu cho khách vãng lai
  }

  // ==========================================
  // 2. CÁC HÀM LẤY DỮ LIỆU & KIỂM TRA
  // ==========================================
  getCurrentItems(): CompareItem[] {
    const key = this.getStorageKey();
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.warn('Lỗi đọc LocalStorage:', error);
      return [];
    }
  }

  getCount(): number {
    return this.getCurrentItems().length;
  }

  isFull(): boolean {
    return this.getCount() >= this.MAX_ITEMS;
  }

  isInCompare(variantId: string): boolean {
    return this.getCurrentItems().some(item => item.variantId === variantId);
  }

  isSameCategory(categoryId: string): boolean {
    const items = this.getCurrentItems();
    if (items.length === 0) return true;
    return items[0].categoryId === categoryId;
  }
  
  // ==========================================
  // 3. CÁC HÀM THAO TÁC THÊM / XÓA
  // ==========================================
  addItem(item: CompareItem): { success: boolean; message?: string; needConfirm?: boolean; typeMismatch?: boolean } {
    const currentItems = this.getCurrentItems();

    // 3.1. Kiểm tra đã đầy 3 sản phẩm chưa
    if (currentItems.length >= this.MAX_ITEMS) {
      return { success: false, message: `Chỉ được so sánh tối đa ${this.MAX_ITEMS} sản phẩm.` };
    }

    // 3.2. Kiểm tra trùng lặp
    if (this.isInCompare(item.variantId)) {
      return { success: false, message: 'Sản phẩm này đã có trong danh sách so sánh.' };
    }

    // 3.3. Xử lý Logic Loại thiết bị và Danh mục
    if (currentItems.length > 0) {
      const existingType = currentItems[0].productType || 'Khác';
      const newType = item.productType || 'Khác';

      if (existingType !== 'Khác' && newType !== 'Khác' && existingType !== newType) {
        return {
          success: false,
          message: `Bạn đang so sánh [${existingType}]. Không thể ghép chung với [${newType}] vào cùng một bảng.`,
          needConfirm: true
        };
      }

      // 2. NẾU CÙNG LOẠI -> Bỏ qua check danh mục
      if (existingType !== 'Khác' && newType !== 'Khác' && existingType === newType) {
        // Hợp lệ, cho phép qua
      } 
      // 3. Nếu chưa rõ loại, mới dùng Category để cảnh báo
      else if (currentItems[0].categoryId !== item.categoryId) {
        return {
          success: false,
          message: 'Khác danh mục. Vui lòng xác nhận xóa danh sách cũ.',
          needConfirm: true
        };
      }
    }

    // 3.4. Thêm mới thành công
    const newItems = [...currentItems, item];
    this.updateItems(newItems);
    this.justAddedSubject.next(true); 
    return { success: true };
  }

  removeItem(variantId: string): void {
    const currentItems = this.getCurrentItems();
    const newItems = currentItems.filter(item => item.variantId !== variantId);
    this.updateItems(newItems);
  }

  clearAll(): void {
    this.updateItems([]);
    this.justAddedSubject.next(false);
  }

  addItemAfterClear(item: CompareItem): void {
    this.updateItems([item]); // Xóa sạch và thêm 1 item mới
    this.justAddedSubject.next(true);
  }

  resetJustAdded(): void {
    this.justAddedSubject.next(false);
  }

  openWidget(): void {
    this.justAddedSubject.next(true);
  }

  // ==========================================
  // 4. LÕI XỬ LÝ LƯU TRỮ DỮ LIỆU ĐÃ ĐƯỢC GỘP CHUNG
  // ==========================================
  private updateItems(items: CompareItem[]): void {
    this.saveToStorage(items);     // Lưu vào trình duyệt trước
    this.itemsSubject.next(items); // Rồi mới cập nhật ra giao diện
  }

  private saveToStorage(items: CompareItem[]): void {
    try {
      const key = this.getStorageKey(); // Luôn lấy đúng chìa khóa của User hiện tại
      localStorage.setItem(key, JSON.stringify(items));
    } catch (error) {
      console.warn('Không thể lưu danh sách so sánh:', error);
    }
  }

  public loadFromStorage(): void {
    try {
      const key = this.getStorageKey();
      const stored = localStorage.getItem(key);
      if (stored) {
        const items = JSON.parse(stored);
        if (Array.isArray(items)) {
          this.itemsSubject.next(items);
        }
      } else {
        this.itemsSubject.next([]); // Nếu user khác đăng nhập chưa có dữ liệu thì reset về mảng rỗng
      }
    } catch (error) {
      console.warn('Không thể tải danh sách so sánh:', error);
    }
  }
}