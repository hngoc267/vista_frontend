import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AiHistoryService } from '../../../services/ai-history';
import { AiHistoryItem } from '../../../services/ai-compare';
import { AiCompareService } from '../../../services/ai-compare';

type HistoryItem = AiHistoryItem & { checked?: boolean };

@Component({
  selector: 'app-history-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './history-page.html',
  styleUrls: ['./history-page.scss']
})
export class HistoryPage implements OnInit {
  history: HistoryItem[] = [];
  selectedCount = 0;

  constructor(
    private historyService: AiHistoryService,
    private aiCompareService: AiCompareService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.historyService.history$.subscribe(items => {
      this.history = items.map(item => ({
        ...item,
        checked: (item as any).checked || false
      }));
      this.updateSelectedCount();
    });
  }

  // ===== CHECKBOX LOGIC =====
  toggleItem(item: HistoryItem, event: Event): void {
    event.stopPropagation();
    const input = event.target as HTMLInputElement;
    item.checked = input.checked;
    this.updateSelectedCount();
  }

  toggleAll(event: Event): void {
    const input = event.target as HTMLInputElement;
    const checked = input.checked;
    this.history.forEach(item => item.checked = checked);
    this.updateSelectedCount();
  }

  isAllSelected(): boolean {
    return this.history.length > 0 && this.history.every(item => item.checked);
  }

  private updateSelectedCount(): void {
    this.selectedCount = this.history.filter(item => item.checked).length;
  }

  // ===== REMOVE SELECTED (giống cart) =====
  removeSelected(): void {
    if (this.selectedCount === 0) return;

    const selectedIds = this.history
      .filter(item => item.checked)
      .map(item => item.id);

    if (confirm(`Bạn có chắc muốn xóa ${selectedIds.length} bản ghi đã chọn?`)) {
      selectedIds.forEach(id => this.historyService.remove(id));
      this.history = this.history.filter(item => !item.checked);
      this.updateSelectedCount();
    }
  }

  // ===== VIEW DETAIL =====
  viewDetail(item: AiHistoryItem): void {
    this.aiCompareService['_result$'].next(item.result);

    if (item.savedProducts && item.savedProducts.length > 0) {
      // Restore snapshot products → result-page hiển thị đúng ảnh và giá
      this.aiCompareService['_products$'].next(item.savedProducts);
    } else {
      // Fallback cho lịch sử cũ chưa có savedProducts:
      // tạo placeholder tối thiểu để result-page không crash,
      // ảnh sẽ dùng default, giá hiển thị 0đ.
      const placeholders = item.productNames.map(name => ({
        Product_name: name,
        Category_id: '',
        Images: [],
        Discount: 0,
        min_price: 0,
        selectedVariantId: null,
        selectedVariant: null,
      }));
      this.aiCompareService['_products$'].next(placeholders);
    }

    this.router.navigate(['/ai-result']);
  }

  // ===== REMOVE SINGLE =====
  removeItem(id: string, event: Event): void {
    event.stopPropagation();
    if (confirm('Bạn có chắc muốn xóa bản ghi này?')) {
      this.historyService.remove(id);
      this.history = this.history.filter(item => item.id !== id);
      this.updateSelectedCount();
    }
  }

  // ===== CLEAR ALL =====
  clearAll(): void {
    if (this.history.length === 0) return;
    if (confirm('Bạn có chắc muốn xóa toàn bộ lịch sử?')) {
      this.historyService.clearAll();
      this.history = [];
      this.updateSelectedCount();
    }
  }

  // ===== HELPERS =====
  getProductNames(item: AiHistoryItem): string {
    return item.productNames.join(' vs ');
  }

  getUniqueCategories(): string[] {
    const cats = this.history.map(item => item.categoryName);
    return [...new Set(cats)];
  }

  formatDate(timestamp: number): string {
    return new Date(timestamp).toLocaleString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  trackById(index: number, item: HistoryItem): string {
    return item.id || index.toString();
  }
}