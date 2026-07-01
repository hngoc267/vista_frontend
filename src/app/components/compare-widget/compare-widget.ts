import { Component, OnInit, OnDestroy, ChangeDetectorRef} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { Subscription } from 'rxjs';
import { CompareService, CompareItem } from '../../services/compare';
import { NotificationService } from '../../components/notification/notification.service';

@Component({
  selector: 'app-compare-widget',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: './compare-widget.html',
  styleUrls: ['./compare-widget.scss']
})
export class CompareWidgetComponent implements OnInit, OnDestroy {
  
  items: CompareItem[] = [];
  isExpanded: boolean = false;   
  isVisible: boolean = false;
  private itemsSubscription?: Subscription;
  private routerSubscription?: Subscription;
  private justAddedSubscription?: Subscription;

  constructor(
    private compareService: CompareService,
    private notificationService: NotificationService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.itemsSubscription = this.compareService.items$.subscribe(items => {
      this.items = items;
      this.isVisible = this.shouldShowWidget();
      this.cdr.detectChanges();
    });

    // 🔥 Lắng nghe sự kiện vừa thêm → tự động mở rộng widget
    this.justAddedSubscription = this.compareService.justAdded$.subscribe(justAdded => {
      if (justAdded && this.items.length > 0) {
        this.isExpanded = true;
        this.cdr.detectChanges();
      }
    });

    this.routerSubscription = this.router.events.subscribe(() => {
      this.isVisible = this.shouldShowWidget();
      this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
    this.itemsSubscription?.unsubscribe();
    this.routerSubscription?.unsubscribe();
    this.justAddedSubscription?.unsubscribe();
  }

  private shouldShowWidget(): boolean {
    const currentUrl = this.router.url;
    const isProductPage = currentUrl.startsWith('/products') || currentUrl.startsWith('/product');
    const isComparePage = currentUrl.includes('/compare');
    return isProductPage && !isComparePage && this.items.length > 0;
  }

  get count(): number {
    return this.items.length;
  }

  toggleExpand(): void {
    this.isExpanded = !this.isExpanded;
    if (!this.isExpanded) {
      this.compareService.resetJustAdded();
    }
  }

  removeItem(variantId: string, productName: string): void {
    this.compareService.removeItem(variantId);
    this.notificationService.info(`Đã xóa "${productName}" khỏi danh sách so sánh.`);
  }

  clearAll(): void {
    if (this.items.length === 0) return;
    this.compareService.clearAll();
    this.notificationService.info('Đã xóa tất cả sản phẩm khỏi danh sách so sánh.');
  }

  goToCompare(): void {
    if (this.items.length < 2) {
      this.notificationService.error('Vui lòng chọn ít nhất 2 sản phẩm để so sánh.');
      return;
    }
    this.router.navigate(['/compare']);
  }
}