import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { AiCompareService, AiCriterion, AiResult } from '../../../services/ai-compare';

// ── Trọng số gán theo thứ hạng user chạm chọn ──────────────────
// Hạng 1 (chạm đầu tiên) = quan trọng nhất = 90%
// Từ hạng 5 trở đi, giữ mức sàn 30%
const RANK_WEIGHTS = [90, 75, 60, 50, 40];
const FALLBACK_WEIGHT = 30;

@Component({
  selector: 'app-criteria-page',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './criteria-page.html',
  styleUrls: ['./criteria-page.scss']
})
export class CriteriaPage implements OnInit {

  products: any[] = [];
  criteria: AiCriterion[] = [];

  // Thứ tự key theo lần user chạm chọn — vị trí trong mảng = thứ hạng
  selectedKeys: string[] = [];

  isLoading = false;

  constructor(
    private aiCompareService: AiCompareService,
    private router: Router,
    private location: Location
  ) {}

  ngOnInit(): void {
    this.products = this.aiCompareService.getProducts();
    if (!this.products || this.products.length === 0) {
      this.router.navigate(['/compare']);
      return;
    }

    const categoryId = this.products[0]?.Category_id || 'default';
    const preset = this.aiCompareService.getPresetCriteria(categoryId);

    // Bắt đầu với tất cả tiêu chí ở trạng thái CHƯA chọn (enabled = false)
    // User tự tap để xếp hạng — không có gì được chọn sẵn
    this.criteria = preset.map((c: AiCriterion) => ({
      ...c,
      enabled: false,
      weight: 0,
    }));
  }

  // ── Tap để chọn / bỏ chọn 1 tiêu chí ──────────────────────────
  toggleCriterion(key: string): void {
    const idx = this.selectedKeys.indexOf(key);
    if (idx === -1) {
      this.selectedKeys.push(key);
    } else {
      this.selectedKeys.splice(idx, 1);
    }
    this.recalcFromRanking();
  }

  // ── Gán lại weight cho toàn bộ criteria dựa theo thứ hạng tap ──
  private recalcFromRanking(): void {
    this.criteria = this.criteria.map(c => {
      const rank = this.selectedKeys.indexOf(c.key);
      if (rank === -1) {
        return { ...c, enabled: false, weight: 0 };
      }
      const weight = RANK_WEIGHTS[rank] ?? FALLBACK_WEIGHT;
      return { ...c, enabled: true, weight };
    });
  }

  isSelected(key: string): boolean {
    return this.selectedKeys.includes(key);
  }

  // Trả về thứ hạng hiển thị (1, 2, 3...) — 0 nghĩa là chưa chọn
  getRank(key: string): number {
    return this.selectedKeys.indexOf(key) + 1;
  }

  // Sắp xếp hiển thị: đã chọn (theo thứ hạng) lên trước, chưa chọn xuống dưới
  getDisplayList(): AiCriterion[] {
    const selected = this.selectedKeys
      .map(key => this.criteria.find(c => c.key === key))
      .filter((c): c is AiCriterion => !!c);

    const unselected = this.criteria.filter(c => !this.selectedKeys.includes(c.key));

    return [...selected, ...unselected];
  }

  // Nhãn các tiêu chí đã chọn, theo đúng thứ hạng — dùng cho tóm tắt + prompt AI
  getSelectedLabels(): string[] {
    return this.selectedKeys
      .map(key => this.criteria.find(c => c.key === key)?.label)
      .filter((l): l is string => !!l);
  }

  get hasSelection(): boolean {
    return this.selectedKeys.length > 0;
  }

// criteria-page.ts
  
  onAnalyze(): void {
    if (this.isLoading || !this.hasSelection) return;
    this.isLoading = true;
    
    // Lấy categoryId từ sản phẩm đang so sánh
    const categoryId = this.products[0]?.Category_id || 'default';

    // Truyền categoryId thay vì mảng getSelectedLabels()
    this.aiCompareService.analyze(this.products, this.criteria, categoryId)
      .subscribe({
        error: (err: any) => {
          this.isLoading = false;
          alert('❌ Có lỗi xảy ra khi phân tích. Vui lòng thử lại sau.');
          console.error('Lỗi phân tích AI:', err);
        }
      });
    this.router.navigate(['/ai-result']);
  }

  onSkip(): void {
    if (this.isLoading) return;
    this.isLoading = true;
    
    // Lấy categoryId từ sản phẩm đang so sánh
    const categoryId = this.products[0]?.Category_id || 'default';
    const preset = this.aiCompareService.getPresetCriteria(categoryId);
    
    // Truyền categoryId thay vì mảng rỗng []
    this.aiCompareService.analyze(this.products, preset, categoryId)
      .subscribe({
        error: (err: any) => {
          this.isLoading = false;
          alert('❌ Có lỗi xảy ra khi phân tích. Vui lòng thử lại sau.');
          console.error('Lỗi phân tích AI:', err);
        }
      });
    this.router.navigate(['/ai-result']);
  }

  goBack(): void {
    this.location.back();
  }

  clearSelection(): void {
  this.selectedKeys = [];
  this.recalcFromRanking();
}

  getWeightByRank(index: number): number {
    const weight = RANK_WEIGHTS[index] ?? FALLBACK_WEIGHT;
    return weight;
  }
}