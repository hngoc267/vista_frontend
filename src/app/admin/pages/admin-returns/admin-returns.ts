import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize, Subject, debounceTime, distinctUntilChanged, Subscription } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideEye,
  lucideCheckCircle2,
  lucideXCircle,
  lucideAlertCircle,
  lucideX,
  lucideCalendar,
  lucideChevronLeft,
  lucideChevronRight,
  lucideInbox,
  lucideExternalLink,
  lucideClock,
  lucideCheck,
  lucideChevronDown,
  lucideArrowRight,
  lucideMaximize2,
  lucideRefreshCw,
  lucideTriangleAlert
} from '@ng-icons/lucide';
import {
  AdminReturnService,
  AdminReturnSummary,
  AdminReturnDetail,
  AdminReturnFilters,
  ReturnStatus
} from '../../services/admin-return';
import { getAdminRole } from '../../../guards/admin-guard';
import { ResizableDrawerDirective } from '../../directives/resizable-drawer.directive';
import Swal from 'sweetalert2';

@Component({
  selector: 'app-admin-returns',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon, ResizableDrawerDirective],
  providers: [
    provideIcons({
      lucideSearch,
      lucideEye,
      lucideCheckCircle2,
      lucideXCircle,
      lucideAlertCircle,
      lucideX,
      lucideCalendar,
      lucideChevronLeft,
      lucideChevronRight,
      lucideInbox,
      lucideExternalLink,
      lucideClock,
      lucideCheck,
      lucideChevronDown,
      lucideArrowRight,
      lucideMaximize2,
      lucideRefreshCw,
  lucideTriangleAlert
    })
  ],
  templateUrl: './admin-returns.html',
  styleUrl: './admin-returns.scss'
})
export class AdminReturnsComponent implements OnInit, OnDestroy {
  private returnService = inject(AdminReturnService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private searchSubject = new Subject<string>();
  private queryParamsSubscription?: Subscription;

  // Phân quyền
  role: 'Staff' | 'Manager' | 'Admin' = 'Staff';
  staffName: string = 'Nguyễn Minh Anh';

  // Trạng thái dữ liệu
  returns: AdminReturnSummary[] = [];
  selectedReturn: AdminReturnDetail | null = null;
  isLoading = false;
  isDetailLoading = false;
  isActionLoading = false;
  errorMessage = '';

  // Drawer & Modals state
  isDrawerOpen = false;
  activeModal: 'approve' | 'reject' | 'accept_goods' | 'reject_goods' | null = null;
  rejectReasonInput = '';
  modalTargetItem: AdminReturnSummary | AdminReturnDetail | null = null;

  // Image Preview Modal
  previewImageSrc: string | null = null;

  // Bộ lọc
  searchKeyword = '';
  selectedStatus = 'all';
  selectedReason = 'all';
  selectedDateFilter = 'all'; // all, today, 7days, 30days
  startDate = '';
  endDate = '';

  // Phân trang & Số dòng mỗi trang
  readonly pageSizeOptions = [10, 20, 50];
  page = 1;
  limit = 10;
  total = 0;
  totalPages = 1;

  // Danh mục lý do chuẩn
  readonly reasonOptions = [
    { value: 'all', label: 'Tất cả lý do' },
    { value: 'Đổi nhu cầu', label: 'Đổi nhu cầu' },
    { value: 'Lỗi sản phẩm', label: 'Lỗi sản phẩm' },
    { value: 'Thiếu phụ kiện', label: 'Thiếu phụ kiện' },
    { value: 'Giao sai hàng', label: 'Giao sai hàng' },
    { value: 'Quá hạn đổi trả', label: 'Quá hạn đổi trả' },
    { value: 'Khác', label: 'Lý do khác' },
  ];

  readonly statusOptions = [
    { value: 'all', label: 'Tất cả trạng thái' },
    { value: 'pending', label: 'Chờ xử lý' },
    { value: 'approved', label: 'Đã duyệt' },
    { value: 'completed', label: 'Đã hoàn tất' },
    { value: 'rejected', label: 'Từ chối' },
  ];

  ngOnInit(): void {
    const currentRole = getAdminRole();
    if (currentRole === 'Manager' || currentRole === 'Staff') {
      this.role = currentRole;
    }
    const savedName = localStorage.getItem('vista_admin_name') || localStorage.getItem('vista_user_name');
    if (savedName) {
      this.staffName = savedName;
    }

    // Debounce tìm kiếm 350ms tránh gọi API liên tục gây lag
    this.searchSubject
      .pipe(
        debounceTime(350),
        distinctUntilChanged()
      )
      .subscribe(() => {
        this.page = 1;
        this.loadReturns();
      });

    // Hỗ trợ mở trực tiếp từ thông báo hoặc dashboard: /admin/returns?returnId=... hoặc ?status=...
    this.queryParamsSubscription = this.route.queryParamMap.subscribe((params) => {
      const returnId = params.get('returnId')?.trim() || params.get('id')?.trim();
      if (returnId) {
        this.openDetailById(returnId);
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
        return;
      }
      const statusParam = params.get('status')?.trim();
      if (statusParam) {
        this.selectedStatus = statusParam;
      }
      this.loadReturns();
    });
  }

  ngOnDestroy(): void {
    this.searchSubject.complete();
    this.queryParamsSubscription?.unsubscribe();
  }

  onLimitChange(): void {
    this.page = 1;
    this.loadReturns();
  }

  get hasActiveFilters(): boolean {
    return !!(
      this.searchKeyword.trim() ||
      this.selectedStatus !== 'all' ||
      this.selectedReason !== 'all' ||
      this.selectedDateFilter !== 'all' ||
      this.startDate ||
      this.endDate
    );
  }

  clearFilters(): void {
    this.searchKeyword = '';
    this.selectedStatus = 'all';
    this.selectedReason = 'all';
    this.selectedDateFilter = 'all';
    this.startDate = '';
    this.endDate = '';
    this.page = 1;
    this.loadReturns();
  }

  loadReturns(silent = false): void {
    if (!silent) {
      this.isLoading = true;
      this.errorMessage = '';
      this.cdr.detectChanges();
    }

    const filters: AdminReturnFilters = {
      page: this.page,
      limit: this.limit,
      search: this.searchKeyword.trim() || undefined,
      status: this.selectedStatus !== 'all' ? this.selectedStatus : undefined,
      reason: this.selectedReason !== 'all' ? this.selectedReason : undefined,
    };

    if (this.selectedDateFilter === 'today') {
      const today = new Date().toISOString().split('T')[0];
      filters.startDate = today;
      filters.endDate = today;
    } else if (this.selectedDateFilter === '7days') {
      const d = new Date();
      d.setDate(d.getDate() - 7);
      filters.startDate = d.toISOString().split('T')[0];
    } else if (this.selectedDateFilter === '30days') {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      filters.startDate = d.toISOString().split('T')[0];
    }

    this.returnService.getReturns(filters)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.returns = res.data;
            this.total = res.pagination?.total ?? res.data.length;
            this.totalPages = Math.max(1, res.pagination?.totalPages ?? Math.ceil(this.total / this.limit));
            this.errorMessage = '';
          } else {
            this.returns = [];
            this.total = 0;
            this.totalPages = 1;
            this.errorMessage = res.message || 'Không có dữ liệu trả về.';
          }
        },
        error: (err) => {
          if (silent) return;
          this.returns = [];
          this.total = 0;
          this.totalPages = 1;
          this.errorMessage = err?.error?.message || err?.message || 'Không thể kết nối đến máy chủ hoặc phiên đăng nhập đã hết hạn.';
          console.error('Error fetching returns:', err);
        }
      });
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchKeyword);
  }

  onFilterChange(): void {
    this.page = 1;
    this.loadReturns();
  }

  resetFilters(): void {
    this.searchKeyword = '';
    this.selectedStatus = 'all';
    this.selectedReason = 'all';
    this.selectedDateFilter = 'all';
    this.errorMessage = '';
    this.page = 1;
    this.loadReturns();
  }

  get rangeStart(): number {
    return this.total === 0 ? 0 : (this.page - 1) * this.limit + 1;
  }

  get rangeEnd(): number {
    return this.total === 0 ? 0 : Math.min(this.page * this.limit, this.total);
  }

  goToPage(newPage: number): void {
    if (newPage < 1 || newPage > this.totalPages || newPage === this.page || this.isLoading) {
      return;
    }
    this.page = newPage;
    this.loadReturns();
  }

  onPageChange(newPage: number): void {
    this.goToPage(newPage);
  }

  get pagesArray(): number[] {
    const pages: number[] = [];
    const maxVisible = 5;
    let start = Math.max(1, this.page - Math.floor(maxVisible / 2));
    let end = Math.min(this.totalPages, start + maxVisible - 1);
    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    return pages;
  }

  // Mở Drawer chi tiết theo mã yêu cầu (hỗ trợ cả click từ bảng và deep-link URL)
  openDetailById(id: string): void {
    this.isDrawerOpen = true;
    this.isDetailLoading = true;
    this.selectedReturn = null;
    this.cdr.detectChanges();

    this.returnService.getReturnDetail(id)
      .pipe(
        finalize(() => {
          this.isDetailLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.selectedReturn = res.data;
          }
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Lỗi',
            text: err?.error?.message || 'Không thể tải chi tiết yêu cầu đổi trả.',
            confirmButtonColor: '#2563EB',
          });
        }
      });
  }

  // Tải lại chi tiết ngầm không làm giật Drawer khi duyệt/từ chối
  refreshDetail(id: string): void {
    this.returnService.getReturnDetail(id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.selectedReturn = res.data;
          this.cdr.detectChanges();
        }
      }
    });
  }

  // Mở Drawer từ bảng
  openDetail(item: AdminReturnSummary): void {
    this.openDetailById(item.Return_order_id);
  }

  closeDrawer(): void {
    this.isDrawerOpen = false;
    this.selectedReturn = null;
    this.cdr.detectChanges();
  }

  // Mở Modal xác nhận các hành động
  openModal(type: 'approve' | 'reject' | 'accept_goods' | 'reject_goods', item?: AdminReturnSummary | AdminReturnDetail): void {
    this.activeModal = type;
    this.modalTargetItem = item || this.selectedReturn;
    this.rejectReasonInput = '';
    this.cdr.detectChanges();
  }

  closeModal(): void {
    this.activeModal = null;
    this.modalTargetItem = null;
    this.rejectReasonInput = '';
    this.cdr.detectChanges();
  }

  // Xử lý Duyệt yêu cầu ban đầu (Giai đoạn 1)
  confirmApprove(): void {
    if (!this.modalTargetItem) return;
    this.isActionLoading = true;
    const id = this.modalTargetItem.Return_order_id;

    this.returnService.approveReturn(id)
      .pipe(
        finalize(() => {
          this.isActionLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (res) => {
          this.closeModal();
          Swal.fire({
            icon: 'success',
            title: 'Thành công',
            text: res.message || 'Đã phê duyệt yêu cầu đổi trả thành công!',
            confirmButtonColor: '#2563EB',
          });
          this.loadReturns(true);
          if (this.selectedReturn && this.selectedReturn.Return_order_id === id) {
            this.refreshDetail(id);
          }
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Lỗi duyệt yêu cầu',
            text: err?.error?.message || 'Không thể duyệt yêu cầu đổi trả này.',
            confirmButtonColor: '#2563EB',
          });
        }
      });
  }

  // Xử lý Từ chối yêu cầu ban đầu (Giai đoạn 1)
  confirmReject(): void {
    if (!this.modalTargetItem) return;
    if (!this.rejectReasonInput.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Chưa nhập lý do',
        text: 'Vui lòng nhập lý do từ chối trước khi xác nhận.',
        confirmButtonColor: '#2563EB',
      });
      return;
    }

    this.isActionLoading = true;
    const id = this.modalTargetItem.Return_order_id;

    this.returnService.rejectReturn(id, this.rejectReasonInput.trim())
      .pipe(
        finalize(() => {
          this.isActionLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (res) => {
          this.closeModal();
          Swal.fire({
            icon: 'success',
            title: 'Đã từ chối',
            text: res.message || 'Đã từ chối yêu cầu đổi trả thành công!',
            confirmButtonColor: '#2563EB',
          });
          this.loadReturns(true);
          if (this.selectedReturn && this.selectedReturn.Return_order_id === id) {
            this.refreshDetail(id);
          }
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Lỗi từ chối',
            text: err?.error?.message || 'Có lỗi xảy ra khi từ chối yêu cầu.',
            confirmButtonColor: '#2563EB',
          });
        }
      });
  }

  // Xử lý Xác nhận hàng đạt (Giai đoạn 2)
  confirmAcceptGoods(): void {
    if (!this.modalTargetItem) return;
    this.isActionLoading = true;
    const id = this.modalTargetItem.Return_order_id;

    this.returnService.acceptGoods(id)
      .pipe(
        finalize(() => {
          this.isActionLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (res) => {
          this.closeModal();
          Swal.fire({
            icon: 'success',
            title: 'Hoàn tất đổi trả',
            text: res.message || 'Hàng đạt điều kiện! Đã cộng lại kho và ghi nhận hoàn tiền.',
            confirmButtonColor: '#2563EB',
          });
          this.loadReturns(true);
          if (this.selectedReturn && this.selectedReturn.Return_order_id === id) {
            this.refreshDetail(id);
          }
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Lỗi xác nhận hàng',
            text: err?.error?.message || 'Có lỗi xảy ra khi xác nhận hàng đạt.',
            confirmButtonColor: '#2563EB',
          });
        }
      });
  }

  // Xử lý Từ chối hoàn tiền khi hàng không đạt (Giai đoạn 2)
  confirmRejectGoods(): void {
    if (!this.modalTargetItem) return;
    if (!this.rejectReasonInput.trim()) {
      Swal.fire({
        icon: 'warning',
        title: 'Chưa nhập lý do',
        text: 'Vui lòng nhập lý do hàng không đạt trước khi xác nhận.',
        confirmButtonColor: '#2563EB',
      });
      return;
    }

    this.isActionLoading = true;
    const id = this.modalTargetItem.Return_order_id;

    this.returnService.rejectGoods(id, this.rejectReasonInput.trim())
      .pipe(
        finalize(() => {
          this.isActionLoading = false;
          this.cdr.detectChanges();
        })
      )
      .subscribe({
        next: (res) => {
          this.closeModal();
          Swal.fire({
            icon: 'success',
            title: 'Đã từ chối hoàn tiền',
            text: res.message || 'Đã ghi nhận từ chối hoàn tiền do sản phẩm không đạt điều kiện.',
            confirmButtonColor: '#2563EB',
          });
          this.loadReturns(true);
          if (this.selectedReturn && this.selectedReturn.Return_order_id === id) {
            this.refreshDetail(id);
          }
        },
        error: (err) => {
          Swal.fire({
            icon: 'error',
            title: 'Lỗi từ chối hoàn tiền',
            text: err?.error?.message || 'Có lỗi xảy ra khi từ chối hoàn tiền.',
            confirmButtonColor: '#2563EB',
          });
        }
      });
  }

  // Xem ảnh minh chứng phóng to
  openImagePreview(src: string): void {
    this.previewImageSrc = src;
    this.cdr.detectChanges();
  }

  closeImagePreview(): void {
    this.previewImageSrc = null;
    this.cdr.detectChanges();
  }

  // Helpers hiển thị Badge trạng thái
  getStatusLabel(status: string): string {
    switch (status) {
      case 'pending': return 'Chờ xử lý';
      case 'approved': return 'Đã duyệt';
      case 'completed':
      case 'refunded': return 'Đã hoàn tất';
      case 'rejected': return 'Từ chối';
      default: return status || 'Chờ xử lý';
    }
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'pending': return 'status-pending';
      case 'approved': return 'status-approved';
      case 'completed':
      case 'refunded': return 'status-completed';
      case 'rejected': return 'status-rejected';
      default: return 'status-pending';
    }
  }

  formatCurrency(value?: number): string {
    if (!value && value !== 0) return '0 đ';
    return Number(value).toLocaleString('vi-VN') + ' đ';
  }

  // Chuẩn hóa đường dẫn ảnh sản phẩm đồng bộ với admin-products
  getProductImageUrl(image?: string | null): string {
    const img = (image || '').trim();
    if (!img) return '/assets/images/default-product.png';
    if (/^https?:\/\//i.test(img) || img.startsWith('/') || img.startsWith('data:image/')) {
      return img;
    }
    if (/^(public\/)?assets\//i.test(img)) {
      return `/${img.replace(/^public\//i, '')}`;
    }
    if (/^(uploads|static)\//i.test(img)) {
      return `/${img}`;
    }
    return `/assets/images/${img.replace(/^\.\//, '')}`;
  }

  // Chuẩn hóa ảnh minh chứng khách hàng tải lên (hỗ trợ cả base64 và url)
  getEvidenceImageUrl(image?: string | null): string {
    const img = (image || '').trim();
    if (!img) return '/assets/images/default-product.png';
    if (/^https?:\/\//i.test(img) || img.startsWith('/') || img.startsWith('data:image/')) {
      return img;
    }
    if (/^(public\/)?assets\//i.test(img)) {
      return `/${img.replace(/^public\//i, '')}`;
    }
    if (/^(uploads|static)\//i.test(img)) {
      return `/${img}`;
    }
    return `/assets/images/${img.replace(/^\.\//, '')}`;
  }

  getCustomerName(item?: any): string {
    if (!item) return '';
    return item.Customer_name || item.Customer?.Name || '';
  }

  getProductName(item?: any): string {
    if (!item) return '';
    return item.Product_name || item.Product_info?.Product_name || '';
  }

  getSku(item?: any): string {
    if (!item) return '';
    return item.SKU || item.Product_info?.SKU || item.Variant_name || item.Product_info?.Variant_name || '';
  }

  getOrderId(item?: any): string {
    if (!item) return '';
    return item.Order_id || item.Order_info?.Order_id || '';
  }

  getOrderStatusLabel(status?: string): string {
    if (!status || status === 'delivered' || status === 'returning' || status === 'completed') {
      return 'Đã giao';
    }
    if (status === 'shipping') return 'Đang giao hàng';
    if (status === 'processing') return 'Đang xử lý';
    if (status === 'cancelled') return 'Đã hủy';
    return status;
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target && !target.src.includes('default-product.png')) {
      target.src = '/assets/images/default-product.png';
    }
  }
}
