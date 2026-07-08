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


  private itemsSubject = new BehaviorSubject<CompareItem[]>([]);
  public items$ = this.itemsSubject.asObservable();


  private justAddedSubject = new BehaviorSubject<boolean>(false);
  public justAdded$ = this.justAddedSubject.asObservable();

  constructor(private cartService: CartService) {
    this.loadFromStorage();
  }


  private getStorageKey(): string {
    const userId = this.cartService.getCurrentUserId(); 
    if (userId) {
      return `vista_compare_items_${userId}`; 
    }
    return 'vista_compare_items_guest';       
  }


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
  

  addItem(item: CompareItem): { success: boolean; message?: string; needConfirm?: boolean; typeMismatch?: boolean } {
    const currentItems = this.getCurrentItems();

    
    if (currentItems.length >= this.MAX_ITEMS) {
      return { success: false, message: `Chỉ được so sánh tối đa ${this.MAX_ITEMS} sản phẩm.` };
    }

    
    if (this.isInCompare(item.variantId)) {
      return { success: false, message: 'Sản phẩm này đã có trong danh sách so sánh.' };
    }

    
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

      
      if (existingType !== 'Khác' && newType !== 'Khác' && existingType === newType) {
        // Hợp lệ, cho phép qua
      } 
      else if (currentItems[0].categoryId !== item.categoryId) {
        return {
          success: false,
          message: 'Khác danh mục. Vui lòng xác nhận xóa danh sách cũ.',
          needConfirm: true
        };
      }
    }


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
    this.updateItems([item]); 
    this.justAddedSubject.next(true);
  }

  resetJustAdded(): void {
    this.justAddedSubject.next(false);
  }

  openWidget(): void {
    this.justAddedSubject.next(true);
  }


  private updateItems(items: CompareItem[]): void {
    this.saveToStorage(items);     
    this.itemsSubject.next(items); 
  }

  private saveToStorage(items: CompareItem[]): void {
    try {
      const key = this.getStorageKey(); 
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
        this.itemsSubject.next([]); 
      }
    } catch (error) {
      console.warn('Không thể tải danh sách so sánh:', error);
    }
  }
}