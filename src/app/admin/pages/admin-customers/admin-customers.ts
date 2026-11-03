import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, Subscription } from 'rxjs';
import { debounceTime, distinctUntilChanged } from 'rxjs/operators';
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
  lucideChevronDown
} from '@ng-icons/lucide';
import {
  AdminCustomerService,
  AdminCustomerItem,
  AdminCustomerAddress,
  AdminCustomerOrderStats
} from '../../services/admin-customer';
import { getAdminRole, AdminRole } from '../../../guards/admin-guard';
import Swal from 'sweetalert2';

export type CustomerDetailTab = 'info' | 'orders' | 'reviews' | 'returns';

@Component({
  selector: 'app-admin-customers',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon],
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
      lucideChevronDown
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
  isDetailLoading = false;
  detailError = '';

  constructor(
    private customerService: AdminCustomerService,
    private cdr: ChangeDetectorRef
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
      .subscribe({
        next: (res) => {
          this.isLoading = false;
          if (res.success) {
            this.customers = res.items || [];
            this.total = res.total || 0;
            this.page = res.page || 1;
            this.limit = res.limit || 10;
            this.totalPages = res.totalPages || 0;
          } else {
            this.errorMessage = res.message || 'Không thể tải danh sách khách hàng.';
          }
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isLoading = false;
          this.errorMessage =
            err.error?.message || err.message || 'Không thể kết nối đến máy chủ. Vui lòng thử lại sau.';
          this.cdr.markForCheck();
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
    this.detailError = '';
    this.isDetailLoading = true;

    this.customerService.getCustomerDetail(customer.User_id).subscribe({
      next: (res) => {
        this.isDetailLoading = false;
        if (res.success) {
          this.selectedCustomer = res.customer;
          this.selectedAddresses = res.addresses || [];
          this.selectedOrderStats = res.orderStats || null;
        } else {
          this.detailError = res.message || 'Không thể tải chi tiết khách hàng.';
        }
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.isDetailLoading = false;
        this.detailError =
          err.error?.message || err.message || 'Không thể tải chi tiết khách hàng.';
        this.cdr.markForCheck();
      }
    });
  }

  closeDrawer(): void {
    this.isDrawerOpen = false;
    this.selectedCustomer = null;
    this.selectedAddresses = [];
    this.selectedOrderStats = null;
    this.detailError = '';
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
          this.cdr.markForCheck();
        },
        error: (err) => {
          this.isSubmittingAction = false;
          Swal.fire({
            icon: 'error',
            title: 'Lỗi xử lý',
            text: err.error?.message || err.message || `Đã xảy ra lỗi khi ${actionText} tài khoản.`
          });
          this.cdr.markForCheck();
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
