import { Component, OnInit, OnDestroy, ChangeDetectorRef, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged, finalize } from 'rxjs/operators';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideUsers,
  lucideSearch,
  lucideEye,
  lucideLock,
  lucideUnlock,
  lucideX,
  lucideRefreshCw,
  lucideShoppingBag,
  lucideCheckCircle2,
  lucideClock,
  lucideXCircle,
  lucideDollarSign,
  lucideMapPin,
  lucideInfo,
  lucideAlertCircle,
  lucideMail,
  lucidePhone,
  lucideCalendar,
  lucideChevronDown,
  lucideStar,
  lucideRotateCcw,
  lucideExternalLink,
  lucidePackage,
  lucideMessageSquare,
  lucideUserCheck,
  lucideUserX
} from '@ng-icons/lucide';
import {
  AdminCustomerService,
  AdminCustomerItem,
  AdminCustomerAddress,
  AdminCustomerOrderStats,
  AdminCustomerStats,
  AdminCustomerOrderDetail,
  AdminCustomerReviewItem,
  AdminCustomerReturnItem
} from '../../services/admin-customer';
import { getAdminRole, AdminRole } from '../../../guards/admin-guard';
import { ResizableDrawerDirective } from '../../directives/resizable-drawer.directive';
import Swal from 'sweetalert2';

export type CustomerDetailTab = 'info' | 'orders' | 'reviews' | 'returns';

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon, ResizableDrawerDirective],
  providers: [
    provideIcons({
      lucideUsers,
      lucideSearch,
      lucideEye,
      lucideLock,
      lucideUnlock,
      lucideX,
      lucideRefreshCw,
      lucideShoppingBag,
      lucideCheckCircle2,
      lucideClock,
      lucideXCircle,
      lucideDollarSign,
      lucideMapPin,
      lucideInfo,
      lucideAlertCircle,
      lucideMail,
      lucidePhone,
      lucideCalendar,
      lucideChevronDown,
      lucideStar,
      lucideRotateCcw,
      lucideExternalLink,
      lucidePackage,
      lucideMessageSquare,
      lucideUserCheck,
      lucideUserX
    })
  ],
  templateUrl: './admin-customers.html',
  styleUrls: ['./admin-customers.scss']
})
export class AdminCustomersComponent implements OnInit, OnDestroy {
  readonly pageSizeOptions = [10, 20, 50];

  // Phân quyền
  role: AdminRole | null = null;
  isManager = false;

  // Dữ liệu danh sách
  customers: AdminCustomerItem[] = [];
  stats: AdminCustomerStats | null = null;
  total = 0;
  page = 1;
  limit = 10;
  totalPages = 0;

  // Bộ lọc & Tìm kiếm
  searchKeyword = '';
  selectedStatus = '';
  private searchSubject = new Subject<string>();
  private searchSubscription?: Subscription;

  // Trạng thái giao diện
  isLoading = false;
  errorMessage = '';
  isSubmittingAction = false;

  // Drawer chi tiết
  isDrawerOpen = false;
  activeTab: CustomerDetailTab = 'info';
  selectedCustomer: AdminCustomerItem | null = null;
  selectedAddresses: AdminCustomerAddress[] = [];
  selectedOrderStats: AdminCustomerOrderStats | null = null;
  selectedOrders: AdminCustomerOrderDetail[] = [];
  selectedReviews: AdminCustomerReviewItem[] = [];
  selectedReturns: AdminCustomerReturnItem[] = [];
  isDetailLoading = false;
  detailError = '';

  constructor(
    private customerService: AdminCustomerService,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private ngZone: NgZone
  ) {}

  ngOnInit(): void {
    this.role = getAdminRole();
    this.isManager = this.role === 'Manager';

    // Thiết lập debounce tìm kiếm 400ms
    this.searchSubscription = this.searchSubject
      .pipe(debounceTime(400), distinctUntilChanged())
      .subscribe(() => {
        this.page = 1;
        this.loadCustomers();
      });

    this.loadCustomers();
  }

  ngOnDestroy(): void {
    if (this.searchSubscription) {
      this.searchSubscription.unsubscribe();
    }
  }

  get hasActiveFilters(): boolean {
    return Boolean(this.searchKeyword.trim() || this.selectedStatus);
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchKeyword);
  }

  onStatusChange(): void {
    this.page = 1;
    this.loadCustomers();
  }

  onPageSizeChange(): void {
    this.page = 1;
    this.loadCustomers();
  }

  clearFilters(): void {
    this.searchKeyword = '';
    this.selectedStatus = '';
    this.page = 1;
    this.loadCustomers();
  }

  loadCustomers(): void {
    this.isLoading = true;
    this.errorMessage = '';

    this.customerService
      .getCustomers({
        keyword: this.searchKeyword.trim(),
        status: this.selectedStatus,
        page: this.page,
        limit: this.limit
      })
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (res: any) => {
          if (res && (res.success || Array.isArray(res.items) || Array.isArray(res.data?.items))) {
            const rawItems = res.items || res.data?.items || [];
            this.customers = rawItems;
            this.stats = res.stats || res.data?.stats || null;
            this.total = res.total ?? res.data?.total ?? rawItems.length;
            this.page = res.page ?? res.data?.page ?? 1;
            this.limit = res.limit ?? res.data?.limit ?? 10;
            this.totalPages = res.totalPages ?? res.data?.totalPages ?? Math.ceil(this.total / this.limit);
            this.errorMessage = '';
          } else {
            this.customers = [];
            this.errorMessage = res?.message || 'Không thể tải danh sách khách hàng.';
          }
        },
        error: (err) => {
          this.customers = [];
          this.errorMessage =
            err.error?.message || err.message || 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.';
        }
      });
  }

  goToPage(p: number): void {
    if (p < 1 || p > this.totalPages || p === this.page || this.isLoading) {
      return;
    }
    this.page = p;
    this.loadCustomers();
  }

  getPaginationRange(): number[] {
    const range: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.page - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      range.push(i);
    }
    return range;
  }

  // --- DRAWER CHI TIẾT ---

  openDetail(customer: AdminCustomerItem): void {
    this.selectedCustomer = customer;
    this.activeTab = 'info';
    this.isDrawerOpen = true;
    this.selectedAddresses = [];
    this.selectedOrderStats = null;
    this.selectedOrders = [];
    this.selectedReviews = [];
    this.selectedReturns = [];
    this.detailError = '';
    this.isDetailLoading = true;

    this.customerService
      .getCustomerDetail(customer.User_id)
      .pipe(
        finalize(() => {
          this.ngZone.run(() => {
            this.isDetailLoading = false;
            this.cdr.markForCheck();
          });
        })
      )
      .subscribe({
        next: (res: any) => {
          this.ngZone.run(() => {
            if (res && res.success) {
              const data = res.data || res;
              this.selectedCustomer = data.customer || res.customer;
              this.selectedAddresses = data.addresses || res.addresses || [];
              this.selectedOrderStats = data.orderStats || res.orderStats || null;
              this.selectedOrders = data.orders || res.orders || [];
              this.selectedReviews = data.reviews || res.reviews || [];
              this.selectedReturns = data.returns || res.returns || [];
            } else {
              this.detailError = res?.message || 'Không thể tải chi tiết khách hàng.';
            }
            this.cdr.markForCheck();
          });
        },
        error: (err) => {
          this.ngZone.run(() => {
            this.detailError =
              err.error?.message || err.message || 'Không thể tải chi tiết khách hàng.';
            this.cdr.markForCheck();
          });
        }
      });
  }

  closeDrawer(): void {
    this.isDrawerOpen = false;
    this.selectedCustomer = null;
    this.selectedAddresses = [];
    this.selectedOrderStats = null;
    this.selectedOrders = [];
    this.selectedReviews = [];
    this.selectedReturns = [];
    this.detailError = '';
    this.cdr.detectChanges();
  }

  navigateToOrder(orderId: string): void {
    if (!orderId) return;
    this.router.navigate(['/admin/orders'], { queryParams: { orderId } });
  }

  getOrderStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending_payment: 'Chờ thanh toán',
      pending_confirmation: 'Chờ xác nhận',
      processing: 'Đang xử lý',
      shipping: 'Đang giao',
      delivering: 'Đang giao',
      delivered: 'Hoàn tất',
      review: 'Hoàn tất',
      cancelled: 'Đã hủy',
      returning: 'Hoàn hàng'
    };
    return map[status] || status;
  }

  getOrderStatusClass(status: string): string {
    if (['delivered', 'review'].includes(status)) return 'badge-success';
    if (['processing', 'shipping', 'delivering'].includes(status)) return 'badge-warning';
    if (status === 'cancelled') return 'badge-danger';
    if (status === 'returning') return 'badge-purple';
    return 'badge-secondary';
  }

  getReviewStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Chờ duyệt',
      approved: 'Đã duyệt',
      rejected: 'Đã ẩn'
    };
    return map[status] || status;
  }

  getReturnStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Chờ duyệt',
      approved: 'Đã chấp thuận',
      rejected: 'Từ chối',
      completed: 'Hoàn tất',
      refunded: 'Đã hoàn tiền'
    };
    return map[status] || status;
  }

  getStarArray(rating: number): number[] {
    const count = Math.max(0, Math.min(5, Math.round(rating || 0)));
    return Array.from({ length: count }, (_, i) => i + 1);
  }

  getEmptyStarArray(rating: number): number[] {
    const count = Math.max(0, 5 - Math.max(0, Math.min(5, Math.round(rating || 0))));
    return Array.from({ length: count }, (_, i) => i + 1);
  }

  selectTab(tab: CustomerDetailTab): void {
    this.activeTab = tab;
  }

  // --- XỬ LÝ KHÓA / MỞ KHÓA ---

  toggleLock(customer: AdminCustomerItem): void {
    if (!this.isManager) {
      Swal.fire({
        icon: 'error',
        title: 'Từ chối quyền',
        text: 'Chỉ Quản lý (Manager) mới có quyền khóa hoặc mở khóa tài khoản khách hàng.'
      });
      return;
    }

    if (this.isSubmittingAction) {
      return;
    }

    const isLocking = customer.Status === 'active';
    const actionText = isLocking ? 'khóa' : 'mở khóa';
    const confirmBtnText = isLocking ? 'Xác nhận khóa' : 'Xác nhận mở khóa';
    const confirmBtnColor = isLocking ? '#ef4444' : '#10b981';

    Swal.fire({
      title: isLocking ? 'Khóa tài khoản khách hàng?' : 'Mở khóa tài khoản khách hàng?',
      text: isLocking
        ? `Bạn có chắc chắn muốn khóa tài khoản "${customer.Full_name || customer.Username}" (${customer.User_id})? Khách hàng sẽ không thể đăng nhập hoặc đặt hàng.`
        : `Bạn có chắc chắn muốn mở khóa tài khoản "${customer.Full_name || customer.Username}" (${customer.User_id})? Khách hàng sẽ có thể đăng nhập và hoạt động bình thường.`,
      icon: isLocking ? 'warning' : 'question',
      showCancelButton: true,
      confirmButtonText: confirmBtnText,
      cancelButtonText: 'Hủy thao tác',
      confirmButtonColor: confirmBtnColor,
      cancelButtonColor: '#6b7280',
      focusCancel: true
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }

      this.isSubmittingAction = true;
      const apiCall = isLocking
        ? this.customerService.lockCustomer(customer.User_id)
        : this.customerService.unlockCustomer(customer.User_id);

      apiCall.subscribe({
        next: (res) => {
          this.isSubmittingAction = false;
          if (res.success) {
            Swal.fire({
              icon: 'success',
              title: 'Thành công',
              text: res.message || `Đã ${actionText} tài khoản khách hàng thành công.`,
              timer: 2000,
              showConfirmButton: false
            });

            // Cập nhật ngay trong mảng danh sách
            const index = this.customers.findIndex((c) => c.User_id === customer.User_id);
            if (index !== -1 && res.customer) {
              this.customers[index] = { ...this.customers[index], ...res.customer };
            }

            // Cập nhật selectedCustomer nếu drawer đang mở
            if (this.selectedCustomer && this.selectedCustomer.User_id === customer.User_id && res.customer) {
              this.selectedCustomer = { ...this.selectedCustomer, ...res.customer };
            }

            // Tải lại danh sách để đồng bộ dữ liệu từ server
            this.loadCustomers();
          } else {
            Swal.fire({
              icon: 'error',
              title: 'Thao tác không thành công',
              text: res.message || `Không thể ${actionText} tài khoản khách hàng.`
            });
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isSubmittingAction = false;
          Swal.fire({
            icon: 'error',
            title: 'Lỗi xử lý',
            text: err.error?.message || err.message || `Đã xảy ra lỗi khi ${actionText} tài khoản.`
          });
          this.cdr.detectChanges();
        }
      });
    });
  }

  // --- TIỆN ÍCH HIỂN THỊ ---

  getInitials(name: string, username?: string): string {
    const target = (name || username || '').trim();
    if (!target) return 'KH';
    const parts = target.split(/\s+/);
    if (parts.length === 1) {
      return parts[0].substring(0, 2).toUpperCase();
    }
    const first = parts[0].charAt(0);
    const last = parts[parts.length - 1].charAt(0);
    return `${first}${last}`.toUpperCase();
  }

  formatCurrency(value?: number | null): string {
    if (value === undefined || value === null || isNaN(value)) {
      return '0 ₫';
    }
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  }
}
