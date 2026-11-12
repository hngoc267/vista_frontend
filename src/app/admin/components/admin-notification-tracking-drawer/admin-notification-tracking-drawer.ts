import {
  ChangeDetectorRef,
  Component,
  EventEmitter,
  Input,
  OnChanges,
  OnInit,
  Output,
  SimpleChanges,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideRefreshCw,
  lucideX,
  lucideChevronDown,
  lucideChevronUp,
  lucideEye,
  lucideClock,
  lucideUsers,
  lucideAlertCircle,
  lucideCircleCheck,
  lucideFilter,
  lucideArrowUpDown,
  lucideRotateCcw
} from '@ng-icons/lucide';
import {
  AdminNotificationManagementService,
  SentNotificationItem,
  SentNotificationRecipient,
  OperationalNotificationPriority
} from '../../services/admin-notification-management';
import { AdminStaffService, AdminStaffMember } from '../../services/admin-staff';
import { ResizableDrawerDirective } from '../../directives/resizable-drawer.directive';

@Component({
  selector: 'app-admin-notification-tracking-drawer',
  standalone: true,
  imports: [CommonModule, NgIcon, ResizableDrawerDirective],
  providers: [
    provideIcons({
      lucideRefreshCw,
      lucideX,
      lucideChevronDown,
      lucideChevronUp,
      lucideEye,
      lucideClock,
      lucideUsers,
      lucideAlertCircle,
      lucideCircleCheck,
      lucideFilter,
      lucideArrowUpDown,
      lucideRotateCcw
    })
  ],
  templateUrl: './admin-notification-tracking-drawer.html',
  styleUrl: './admin-notification-tracking-drawer.scss'
})
export class AdminNotificationTrackingDrawerComponent implements OnInit, OnChanges {
  @Input() isOpen = false;
  @Output() closeDrawer = new EventEmitter<void>();

  private readonly notificationService = inject(AdminNotificationManagementService);
  private readonly staffService = inject(AdminStaffService);
  private readonly cdr = inject(ChangeDetectorRef);

  items: SentNotificationItem[] = [];
  staffMap = new Map<string, AdminStaffMember>();

  isLoading = false;
  isRefreshing = false;
  errorMessage: string | null = null;
  expandedNotificationId: string | null = null;

  // Trạng thái Bộ lọc & Sắp xếp
  selectedPriorityFilter: 'all' | 'urgent' | 'important' | 'normal' = 'all';
  selectedStatusFilter: 'all' | 'fully_acknowledged' | 'pending_acknowledgment' = 'all';
  sortOrder: 'newest' | 'oldest' = 'newest';

  /**
   * Danh sách thông báo đã qua lọc và sắp xếp theo thời gian
   */
  get filteredAndSortedItems(): SentNotificationItem[] {
    let result = [...this.items];

    // 1. Lọc theo Priority
    if (this.selectedPriorityFilter !== 'all') {
      result = result.filter((item) => (item.priority || 'normal') === this.selectedPriorityFilter);
    }

    // 2. Lọc theo Trạng thái tiếp nhận
    if (this.selectedStatusFilter === 'fully_acknowledged') {
      result = result.filter((item) => {
        const total = this.getTotalRecipientCount(item);
        const ack = this.getAcknowledgedCount(item);
        return total > 0 && ack >= total;
      });
    } else if (this.selectedStatusFilter === 'pending_acknowledgment') {
      result = result.filter((item) => {
        const total = this.getTotalRecipientCount(item);
        const ack = this.getAcknowledgedCount(item);
        return total === 0 || ack < total;
      });
    }

    // 3. Sắp xếp theo thời gian (mặc định: gần nhất / mới nhất trước)
    result.sort((a, b) => {
      const timeA = new Date(a.createdAt).getTime();
      const timeB = new Date(b.createdAt).getTime();
      return this.sortOrder === 'newest' ? timeB - timeA : timeA - timeB;
    });

    return result;
  }

  setStatusFilter(status: 'all' | 'fully_acknowledged' | 'pending_acknowledgment'): void {
    this.selectedStatusFilter = status;
    this.cdr.markForCheck();
  }

  onPriorityFilterChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value as any;
    this.selectedPriorityFilter = val;
    this.cdr.markForCheck();
  }

  onSortOrderChange(event: Event): void {
    const val = (event.target as HTMLSelectElement).value as 'newest' | 'oldest';
    this.sortOrder = val;
    this.cdr.markForCheck();
  }

  resetFilters(): void {
    this.selectedPriorityFilter = 'all';
    this.selectedStatusFilter = 'all';
    this.sortOrder = 'newest';
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    if (this.isOpen) {
      this.loadData();
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen) {
      this.loadData();
    }
  }

  onClose(): void {
    this.closeDrawer.emit();
  }

  refresh(): void {
    if (this.isLoading || this.isRefreshing) return;
    this.isRefreshing = true;
    this.errorMessage = null;
    this.fetchSentAlerts();
  }

  loadData(): void {
    this.isLoading = true;
    this.errorMessage = null;

    // Tải danh sách Staff để map tên nếu chưa có
    if (this.staffMap.size === 0) {
      this.staffService.getStaffList({ role: 'Staff', limit: 100 }).subscribe({
        next: (res) => {
          (res.data?.items || []).forEach((staff) => {
            this.staffMap.set(staff.User_id, staff);
          });
          this.cdr.markForCheck();
        },
        error: () => {
          // Bỏ qua lỗi tải staff list, vẫn tiếp tục tải danh sách sent alerts
        }
      });
    }

    this.fetchSentAlerts();
  }

  private fetchSentAlerts(): void {
    this.notificationService.getSentAlerts(1, 50).subscribe({
      next: (res) => {
        this.items = res.data?.items || [];
        this.isLoading = false;
        this.isRefreshing = false;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.errorMessage = err.error?.message || 'Không thể tải danh sách thông báo đã gửi. Vui lòng thử lại.';
        this.isLoading = false;
        this.isRefreshing = false;
        this.cdr.markForCheck();
      }
    });
  }

  toggleExpand(id: string): void {
    this.expandedNotificationId = this.expandedNotificationId === id ? null : id;
    this.cdr.markForCheck();
  }

  getStaffName(userId: string): string {
    const staff = this.staffMap.get(userId);
    return staff?.Full_name || staff?.Username || userId;
  }

  getStaffEmail(userId: string): string {
    return this.staffMap.get(userId)?.Email || '';
  }

  getReadCount(item: SentNotificationItem): number {
    if (!Array.isArray(item.recipients)) return 0;
    return item.recipients.filter((r) => Boolean(r.readAt)).length;
  }

  getAcknowledgedCount(item: SentNotificationItem): number {
    if (typeof item.acknowledgedCount === 'number') return item.acknowledgedCount;
    if (!Array.isArray(item.recipients)) return 0;
    return item.recipients.filter((r) => r.status === 'acknowledged').length;
  }

  getTotalRecipientCount(item: SentNotificationItem): number {
    if (typeof item.recipientCount === 'number') return item.recipientCount;
    if (Array.isArray(item.recipients)) return item.recipients.length;
    return 0;
  }

  getPriorityLabel(priority: OperationalNotificationPriority): string {
    switch (priority) {
      case 'urgent':
        return 'Khẩn cấp';
      case 'important':
        return 'Quan trọng';
      case 'normal':
      default:
        return 'Bình thường';
    }
  }

  /**
   * Quy ước hiển thị trạng thái Staff:
   * 'Đã xác nhận' (Acknowledged) được ưu tiên hiển thị trước 'Đã đọc'.
   */
  getStaffStatusBadge(r: SentNotificationRecipient): { label: string; cssClass: string } {
    if (r.status === 'acknowledged') {
      return { label: 'Đã xác nhận', cssClass: 'badge--acknowledged' };
    }
    if (r.readAt) {
      return { label: 'Đã đọc', cssClass: 'badge--read' };
    }
    return { label: 'Chưa đọc', cssClass: 'badge--unread' };
  }
}
