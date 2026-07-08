import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { Location } from '@angular/common';
import { AiCompareService, AiCriterion, AiResult } from '../../../services/ai-compare';

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

    this.criteria = preset.map((c: AiCriterion) => ({
      ...c,
      enabled: false,
      weight: 0,
    }));
  }

  toggleCriterion(key: string): void {
    const idx = this.selectedKeys.indexOf(key);
    if (idx === -1) {
      this.selectedKeys.push(key);
    } else {
      this.selectedKeys.splice(idx, 1);
    }
    this.recalcFromRanking();
  }

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

  getRank(key: string): number {
    return this.selectedKeys.indexOf(key) + 1;
  }

  getDisplayList(): AiCriterion[] {
    const selected = this.selectedKeys
      .map(key => this.criteria.find(c => c.key === key))
      .filter((c): c is AiCriterion => !!c);

    const unselected = this.criteria.filter(c => !this.selectedKeys.includes(c.key));

    return [...selected, ...unselected];
  }

  getSelectedLabels(): string[] {
    return this.selectedKeys
      .map(key => this.criteria.find(c => c.key === key)?.label)
      .filter((l): l is string => !!l);
  }

  get hasSelection(): boolean {
    return this.selectedKeys.length > 0;
  }

  
  onAnalyze(): void {
    if (this.isLoading || !this.hasSelection) return;
    this.isLoading = true;
    
    const categoryId = this.products[0]?.Category_id || 'default';

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
    
    const categoryId = this.products[0]?.Category_id || 'default';
    const preset = this.aiCompareService.getPresetCriteria(categoryId);
    
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