import { Component, OnInit, OnDestroy, inject, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, debounceTime, distinctUntilChanged, Subscription } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucidePlus,
  lucideEye,
  lucidePencil,
  lucideTrash2,
  lucidePlay,
  lucidePause,
  lucideX,
  lucideCalendar,
  lucideChevronLeft,
  lucideChevronRight,
  lucideTag,
  lucideTicket,
  lucidePercent,
  lucideDollarSign,
  lucideCheckCircle2,
  lucideXCircle,
  lucideAlertCircle,
  lucideClock,
  lucideCheck,
  lucideChevronDown,
  lucideLayers,
  lucideRefreshCw,
  lucideGift,
  lucideArrowRight,
  lucideInbox
} from '@ng-icons/lucide';
import {
  AdminPromotionService,
  AdminPromotion,
  PromotionStatus,
  PromotionType,
  PromotionScope,
  PromotionStats
} from '../../services/admin-promotion';
import { getAdminRole, clearAdminSession } from '../../../guards/admin-guard';
import { ResizableDrawerDirective } from '../../directives/resizable-drawer.directive';
import Swal from 'sweetalert2';

interface PromotionFormData {
  id?: string;
  code: string;
  title: string;
  description: string;
  type: PromotionType;
  discountValue: number | null;
  maxDiscountAmount: number | null;
  minOrderValue: number | null;
  usageLimit: number | null;
  usageLimitPerCustomer: number | null;
  scope: PromotionScope;
  applicableCategories: string[];
  startDate: string;
  endDate: string;
  status: PromotionStatus;
}

@Component({
  selector: 'app-admin-promotions',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon, ResizableDrawerDirective],
  providers: [
    provideIcons({
      lucideSearch,
      lucidePlus,
      lucideEye,
      lucidePencil,
      lucideTrash2,
      lucidePlay,
      lucidePause,
      lucideX,
      lucideCalendar,
      lucideChevronLeft,
      lucideChevronRight,
      lucideTag,
      lucideTicket,
      lucidePercent,
      lucideDollarSign,
      lucideCheckCircle2,
      lucideXCircle,
      lucideAlertCircle,
      lucideClock,
      lucideCheck,
      lucideChevronDown,
      lucideLayers,
      lucideRefreshCw,
      lucideGift,
      lucideArrowRight,
      lucideInbox
    })
  ],
  templateUrl: './admin-promotions.html',
  styleUrl: './admin-promotions.scss'
})
export class AdminPromotionsComponent implements OnInit, OnDestroy {
  private promotionService = inject(AdminPromotionService);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private searchSubject = new Subject<string>();
  private searchSub?: Subscription;
  private querySub?: Subscription;
  private promotionsRequestId = 0;
  private detailRequestId = 0;

  // Phân quyền
  role: 'Staff' | 'Manager' | 'Admin' = 'Staff';
  isManager = false;

  // Dữ liệu danh sách & Thống kê
  promotions: AdminPromotion[] = [];
  stats: PromotionStats = {
    total: 0,
    active: 0,
    upcoming: 0,
    expired: 0,
    paused: 0,
    draft: 0
  };
  isLoading = false;
  errorMessage = '';

  // Bộ lọc
  searchKeyword = '';
  selectedStatus = 'all';
  selectedType = 'all';
  selectedDateFilter = 'all';

  // Phân trang
  readonly pageSizeOptions = [10, 20, 50];
  page = 1;
  limit = 10;
  total = 0;
  totalPages = 1;

  // Drawer xem chi tiết
  isDetailOpen = false;
  selectedPromotion: AdminPromotion | null = null;
  isDetailLoading = false;

  // Modal Tạo / Chỉnh sửa
  isFormOpen = false;
  isEditMode = false;
  formSubmitting = false;
  formErrors: Record<string, string> = {};
  formData: PromotionFormData = this.getEmptyFormData();

  // Modal xác nhận hành động
  confirmModalType: 'activate' | 'pause' | 'delete' | null = null;
  targetPromotion: AdminPromotion | null = null;
  isConfirmLoading = false;

  // Danh mục sản phẩm khả dụng cho phạm vi khuyến mãi
  readonly availableCategories = [
    'Laptop',
    'Smartphone',
    'Tablet',
    'Thiết bị âm thanh',
    'Phụ kiện công nghệ',
    'Thiết bị gaming'
  ];

  // Options lọc trạng thái
  readonly statusOptions = [
    { value: 'all', label: 'Tất cả trạng thái' },
    { value: 'active', label: 'Đang diễn ra' },
    { value: 'upcoming', label: 'Sắp diễn ra' },
    { value: 'paused', label: 'Tạm ngừng' },
    { value: 'draft', label: 'Bản nháp' },
    { value: 'expired', label: 'Đã kết thúc' }
  ];

  // Options lọc loại ưu đãi
  readonly typeOptions = [
    { value: 'all', label: 'Tất cả loại ưu đãi' },
    { value: 'percent', label: 'Giảm theo phần trăm (%)' },
    { value: 'fixed_amount', label: 'Giảm số tiền cố định (₫)' },
    { value: 'free_shipping', label: 'Miễn phí vận chuyển' }
  ];

  get hasActiveFilters(): boolean {
    return (
      Boolean(this.searchKeyword.trim()) ||
      this.selectedStatus !== 'all' ||
      this.selectedType !== 'all' ||
      this.selectedDateFilter !== 'all'
    );
  }

  get rangeStart(): number {
    return this.total === 0 ? 0 : (this.page - 1) * this.limit + 1;
  }

  get rangeEnd(): number {
    return this.total === 0 ? 0 : Math.min(this.page * this.limit, this.total);
  }

  ngOnInit(): void {
    const roleFromStorage = getAdminRole();
    this.role = roleFromStorage || 'Staff';
    this.isManager = this.role === 'Manager';

    // Debounce tìm kiếm 350ms
    this.searchSub = this.searchSubject
      .pipe(debounceTime(350), distinctUntilChanged())
      .subscribe(() => {
        this.page = 1;
        this.loadPromotions();
      });

    // Mở trực tiếp khuyến mãi nếu có query parameter id hoặc code (?id=... hoặc ?code=...)
    this.querySub = this.route.queryParamMap.subscribe((params) => {
      const targetId = params.get('id')?.trim() || params.get('code')?.trim();
      if (targetId) {
        this.openDetailById(targetId);
      }
    });

    this.loadPromotions();
  }

  ngOnDestroy(): void {
    this.searchSub?.unsubscribe();
    this.querySub?.unsubscribe();
  }

  // Tải danh sách khuyến mãi từ Backend API thực tế
  loadPromotions(): void {
    const requestId = ++this.promotionsRequestId;
    this.isLoading = true;
    this.errorMessage = '';

    this.promotionService
      .getPromotions({
        keyword: this.searchKeyword.trim() || undefined,
        status: this.selectedStatus !== 'all' ? this.selectedStatus : undefined,
        type: this.selectedType !== 'all' ? this.selectedType : undefined,
        dateFilter: this.selectedDateFilter !== 'all' ? this.selectedDateFilter : undefined,
        page: this.page,
        limit: this.limit
      })
      .subscribe({
        next: (res) => {
          if (requestId !== this.promotionsRequestId) return;
          if (res?.success && res?.data) {
            this.promotions = (res.data.items || []).map((promo) =>
              this.mergePromotionUsage(promo)
            );
            this.total = res.data.total ?? this.promotions.length;
            this.totalPages = res.data.totalPages ?? Math.max(1, Math.ceil(this.total / this.limit));
            if (res.data.stats) {
              this.stats = res.data.stats;
            }
            this.errorMessage = '';
          } else {
            this.promotions = [];
            this.total = 0;
            this.totalPages = 1;
          }
          this.isLoading = false;
          this.cdr.detectChanges();
        },
        error: (err) => {
          if (requestId !== this.promotionsRequestId) return;
          this.promotions = [];
          this.total = 0;
          this.totalPages = 1;
          this.errorMessage = this.parseErrorMessage(err, 'Không thể tải danh sách chương trình khuyến mãi.');
          this.isLoading = false;
          this.cdr.detectChanges();
        }
      });
  }

  onSearchChange(): void {
    this.searchSubject.next(this.searchKeyword);
  }

  onFilterChange(): void {
    this.page = 1;
    this.loadPromotions();
  }

  clearFilters(): void {
    this.searchKeyword = '';
    this.selectedStatus = 'all';
    this.selectedType = 'all';
    this.selectedDateFilter = 'all';
    this.page = 1;
    this.loadPromotions();
  }

  // Phân trang
  goToPage(p: number): void {
    if (p >= 1 && p <= this.totalPages && p !== this.page) {
      this.page = p;
      this.loadPromotions();
    }
  }

  onPageSizeChange(): void {
    this.page = 1;
    this.loadPromotions();
  }

  // --- DRAWER CHI TIẾT ---
  openDetail(promo: AdminPromotion): void {
    this.detailRequestId++;
    this.selectedPromotion = { ...promo };
    this.isDetailOpen = true;
    this.isDetailLoading = false;
  }

  openDetailById(idOrCode: string): void {
    const requestId = ++this.detailRequestId;
    const fallback = this.selectedPromotion &&
      (this.selectedPromotion.id === idOrCode ||
        this.selectedPromotion.code.toLowerCase() === idOrCode.toLowerCase())
      ? this.selectedPromotion
      : undefined;
    if (!fallback) {
      this.selectedPromotion = null;
    }
    this.isDetailLoading = true;
    this.isDetailOpen = true;
    this.promotionService.getPromotionById(idOrCode).subscribe({
      next: (res) => {
        if (requestId !== this.detailRequestId) return;
        if (res?.data) {
          this.selectedPromotion = this.mergePromotionUsage(res.data, fallback);
        }
        this.isDetailLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        if (requestId !== this.detailRequestId) return;
        this.isDetailLoading = false;
        this.isDetailOpen = false;
        this.showToast(this.parseErrorMessage(err, 'Không tìm thấy chi tiết khuyến mãi.'), 'error');
        this.cdr.detectChanges();
      }
    });
  }

  closeDetail(): void {
    this.detailRequestId++;
    this.isDetailOpen = false;
    this.selectedPromotion = null;
    this.isDetailLoading = false;
  }

  // --- FORM TẠO / SỬA (CHỈ MANAGER) ---
  openCreateForm(): void {
    if (!this.isManager) return;
    this.isEditMode = false;
    this.formData = this.getEmptyFormData();
    this.formErrors = {};
    this.isFormOpen = true;
  }

  openEditForm(promo: AdminPromotion): void {
    if (!this.isManager) return;
    this.isEditMode = true;
    this.formData = {
      id: promo.id,
      code: promo.code,
      title: promo.title,
      description: promo.description || '',
      type: promo.type,
      discountValue: promo.discountValue,
      maxDiscountAmount: promo.maxDiscountAmount ?? null,
      minOrderValue: promo.minOrderValue,
      usageLimit: promo.usageLimit,
      usageLimitPerCustomer: promo.usageLimitPerCustomer,
      scope: promo.scope,
      applicableCategories: promo.applicableCategories ? [...promo.applicableCategories] : [],
      startDate: this.formatDateForInput(promo.startDate),
      endDate: this.formatDateForInput(promo.endDate),
      status: promo.status
    };
    this.formErrors = {};
    this.isFormOpen = true;
  }

  closeForm(): void {
    this.isFormOpen = false;
  }

  toggleCategorySelection(cat: string): void {
    const idx = this.formData.applicableCategories.indexOf(cat);
    if (idx > -1) {
      this.formData.applicableCategories.splice(idx, 1);
    } else {
      this.formData.applicableCategories.push(cat);
    }
  }

  isCategorySelected(cat: string): boolean {
    return this.formData.applicableCategories.includes(cat);
  }

  validateForm(): boolean {
    this.formErrors = {};

    if (!this.formData.title.trim()) {
      this.formErrors['title'] = 'Vui lòng nhập tên chương trình.';
    }

    if (!this.formData.code.trim()) {
      this.formErrors['code'] = 'Vui lòng nhập mã khuyến mãi.';
    } else if (!/^[A-Z0-9_-]{3,20}$/i.test(this.formData.code.trim())) {
      this.formErrors['code'] = 'Mã chỉ chứa chữ, số, gạch nối (3-20 ký tự).';
    }

    if (this.formData.discountValue === null || this.formData.discountValue <= 0) {
      this.formErrors['discountValue'] = 'Giá trị giảm phải lớn hơn 0.';
    } else if (this.formData.type === 'percent' && this.formData.discountValue > 100) {
      this.formErrors['discountValue'] = 'Giảm theo % không được vượt quá 100%.';
    }

    if (this.formData.minOrderValue === null || this.formData.minOrderValue < 0) {
      this.formErrors['minOrderValue'] = 'Đơn tối thiểu không được âm.';
    }

    if (
      this.formData.maxDiscountAmount !== null &&
      this.formData.maxDiscountAmount < 0
    ) {
      this.formErrors['maxDiscountAmount'] = 'Mức giảm tối đa không được âm.';
    }

    if (
      this.formData.usageLimit === null ||
      this.formData.usageLimit < 0 ||
      !Number.isInteger(this.formData.usageLimit)
    ) {
      this.formErrors['usageLimit'] = 'Tổng lượt sử dụng phải là số nguyên từ 0 trở lên.';
    }

    if (
      this.formData.usageLimitPerCustomer === null ||
      this.formData.usageLimitPerCustomer < 1 ||
      !Number.isInteger(this.formData.usageLimitPerCustomer)
    ) {
      this.formErrors['usageLimitPerCustomer'] = 'Giới hạn mỗi khách phải là số nguyên từ 1 trở lên.';
    }

    if (!this.formData.startDate) {
      this.formErrors['startDate'] = 'Vui lòng chọn ngày bắt đầu.';
    }

    if (!this.formData.endDate) {
      this.formErrors['endDate'] = 'Vui lòng chọn ngày kết thúc.';
    } else if (this.formData.startDate && this.formData.endDate < this.formData.startDate) {
      this.formErrors['endDate'] = 'Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.';
    }

    if (this.formData.scope === 'specific_categories' && this.formData.applicableCategories.length === 0) {
      this.formErrors['scope'] = 'Vui lòng chọn ít nhất một danh mục áp dụng.';
    }

    return Object.keys(this.formErrors).length === 0;
  }

  submitForm(): void {
    if (!this.isManager) {
      this.showToast('Bạn không có quyền quản lý khuyến mãi.', 'error');
      return;
    }

    if (!this.validateForm()) {
      return;
    }

    this.formSubmitting = true;
    const normalizedCode = this.formData.code.trim().toUpperCase();

    const payload = {
      title: this.formData.title.trim(),
      code: normalizedCode,
      description: this.formData.description.trim(),
      type: this.formData.type,
      discountValue: Number(this.formData.discountValue),
      maxDiscountAmount: this.formData.type === 'percent' && this.formData.maxDiscountAmount ? Number(this.formData.maxDiscountAmount) : 0,
      minOrderValue: Number(this.formData.minOrderValue) || 0,
      usageLimit: Number(this.formData.usageLimit) || 0,
      usageLimitPerCustomer: Number(this.formData.usageLimitPerCustomer) || 1,
      scope: this.formData.scope,
      applicableCategories: this.formData.scope === 'specific_categories' ? this.formData.applicableCategories : [],
      startDate: this.formData.startDate,
      endDate: this.formData.endDate,
      status: this.formData.status || 'draft'
    };

    if (this.isEditMode && this.formData.id) {
      this.promotionService
        .updatePromotion(this.formData.id, payload)
        .subscribe({
          next: (res) => {
            this.formSubmitting = false;
            this.closeForm();
            this.loadPromotions();
            if (this.selectedPromotion && this.selectedPromotion.id === this.formData.id) {
              this.openDetailById(this.formData.id);
            }
            this.showToast(res.message || 'Cập nhật chương trình khuyến mãi thành công!', 'success');
          },
          error: (err) => {
            this.formSubmitting = false;
            const msg = this.parseErrorMessage(err, 'Có lỗi xảy ra khi cập nhật khuyến mãi.');
            this.showToast(msg, 'error');
          }
        });
    } else {
      this.promotionService
        .createPromotion(payload)
        .subscribe({
          next: (res) => {
            this.formSubmitting = false;
            this.closeForm();
            this.page = 1;
            this.loadPromotions();
            this.showToast(res.message || 'Tạo chương trình khuyến mãi mới thành công!', 'success');
          },
          error: (err) => {
            this.formSubmitting = false;
            const msg = this.parseErrorMessage(err, 'Có lỗi xảy ra khi tạo khuyến mãi.');
            this.showToast(msg, 'error');
          }
        });
    }
  }

  // --- MODAL XÁC NHẬN HÀNH ĐỘNG (KÍCH HOẠT / TẠM NGỪNG / XÓA) ---
  openConfirmModal(type: 'activate' | 'pause' | 'delete', promo: AdminPromotion): void {
    if (!this.isManager) {
      this.showToast('Bạn không có quyền thực hiện hành động này.', 'error');
      return;
    }
    this.confirmModalType = type;
    this.targetPromotion = promo;
  }

  closeConfirmModal(): void {
    this.confirmModalType = null;
    this.targetPromotion = null;
    this.isConfirmLoading = false;
  }

  executeConfirmAction(): void {
    if (!this.isManager || !this.targetPromotion || !this.confirmModalType) {
      return;
    }

    this.isConfirmLoading = true;
    const promoId = this.targetPromotion.id;
    const promoCode = this.targetPromotion.code;

    if (this.confirmModalType === 'activate') {
      this.promotionService.changeStatus(promoId, 'active').subscribe({
        next: (res) => {
          this.isConfirmLoading = false;
          this.closeConfirmModal();
          if (this.selectedPromotion?.id === promoId) {
            this.selectedPromotion.status = 'active';
          }
          this.loadPromotions();
          this.showToast(res.message || `Đã kích hoạt chương trình "${promoCode}" thành công!`, 'success');
        },
        error: (err) => {
          this.isConfirmLoading = false;
          this.closeConfirmModal();
          this.showToast(this.parseErrorMessage(err, 'Không thể kích hoạt chương trình.'), 'error');
        }
      });
    } else if (this.confirmModalType === 'pause') {
      this.promotionService.changeStatus(promoId, 'paused').subscribe({
        next: (res) => {
          this.isConfirmLoading = false;
          this.closeConfirmModal();
          if (this.selectedPromotion?.id === promoId) {
            this.selectedPromotion.status = 'paused';
          }
          this.loadPromotions();
          this.showToast(res.message || `Đã tạm ngừng chương trình "${promoCode}".`, 'success');
        },
        error: (err) => {
          this.isConfirmLoading = false;
          this.closeConfirmModal();
          this.showToast(this.parseErrorMessage(err, 'Không thể tạm ngừng chương trình.'), 'error');
        }
      });
    } else if (this.confirmModalType === 'delete') {
      this.promotionService.deletePromotion(promoId).subscribe({
        next: (res) => {
          this.isConfirmLoading = false;
          this.closeConfirmModal();
          if (this.selectedPromotion?.id === promoId) {
            this.closeDetail();
          }
          this.loadPromotions();
          this.showToast(res.message || `Đã xóa chương trình "${promoCode}" khỏi hệ thống!`, 'success');
        },
        error: (err) => {
          this.isConfirmLoading = false;
          this.closeConfirmModal();
          this.showToast(this.parseErrorMessage(err, 'Không thể xóa chương trình khuyến mãi.'), 'error');
        }
      });
    }
  }

  // --- HELPER FORMATTING ---
  getStatusClass(status: PromotionStatus | string): string {
    switch (status) {
      case 'active':
      case 'available':
        return 'status-active';
      case 'upcoming':
        return 'status-upcoming';
      case 'paused':
        return 'status-paused';
      case 'draft':
        return 'status-draft';
      case 'expired':
      case 'out_of_quota':
      case 'used':
        return 'status-expired';
      case 'expiring':
        return 'status-warning';
      default:
        return '';
    }
  }

  getStatusLabel(status: PromotionStatus | string): string {
    switch (status) {
      case 'active':
        return 'Đang diễn ra';
      case 'upcoming':
        return 'Sắp diễn ra';
      case 'paused':
        return 'Đã tạm dừng';
      case 'draft':
        return 'Bản nháp';
      case 'expired':
        return 'Đã kết thúc';
      case 'out_of_quota':
        return 'Đã hết lượt';
      case 'available':
        return 'Khả dụng';
      case 'expiring':
        return 'Sắp hết hạn';
      case 'used':
        return 'Đã hết lượt';
      default:
        return status;
    }
  }

  getTypeLabel(type: PromotionType | string): string {
    switch (type) {
      case 'percent':
        return 'Giảm theo %';
      case 'fixed_amount':
      case 'fixed':
        return 'Giảm tiền mặt';
      case 'free_shipping':
      case 'shipping':
        return 'Freeship';
      default:
        return type;
    }
  }

  getDiscountDisplay(promo: AdminPromotion): string {
    const t = (promo.type as string) || '';
    if (t === 'percent') {
      const maxText = promo.maxDiscountAmount && promo.maxDiscountAmount > 0
        ? ` (Tối đa ${promo.maxDiscountAmount.toLocaleString('vi-VN')}₫)`
        : '';
      return `Giảm ${promo.discountValue}%${maxText}`;
    }
    if (t === 'fixed_amount' || t === 'fixed') {
      return `Giảm ${(promo.discountValue || 0).toLocaleString('vi-VN')}₫`;
    }
    if (t === 'free_shipping' || t === 'shipping') {
      if (promo.maxDiscountAmount && promo.maxDiscountAmount > 0) {
        return `Miễn phí vận chuyển (Tối đa ${promo.maxDiscountAmount.toLocaleString('vi-VN')}₫)`;
      }
      if (promo.discountValue && promo.discountValue > 0) {
        return `Miễn phí vận chuyển (Tối đa ${promo.discountValue.toLocaleString('vi-VN')}₫)`;
      }
      return 'Miễn phí vận chuyển';
    }
    return '';
  }

  getUsagePercent(used: number, limit: number): number {
    const usedCount = Number(used);
    const usageLimit = Number(limit);
    if (!Number.isFinite(usedCount) || !Number.isFinite(usageLimit) || usageLimit <= 0) return 0;
    return Math.min(100, Math.max(0, Math.round((usedCount / usageLimit) * 100)));
  }

  private mergePromotionUsage(
    promotion: AdminPromotion,
    fallback?: AdminPromotion
  ): AdminPromotion {
    const detailCount = Number(promotion.usedCount);
    const fallbackCount = Number(fallback?.usedCount);
    const usedCount = Math.max(
      0,
      Number.isFinite(detailCount) ? detailCount : 0,
      Number.isFinite(fallbackCount) ? fallbackCount : 0
    );

    return { ...fallback, ...promotion, usedCount };
  }

  private formatDateForInput(dateStr: string): string {
    if (!dateStr) return '';
    if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
      return dateStr.slice(0, 10);
    }
    // Hỗ trợ trường hợp DD/MM/YYYY
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const [d, m, y] = parts;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    return dateStr;
  }

  private parseErrorMessage(err: any, fallbackMessage: string): string {
    if (err?.status === 401) {
      clearAdminSession();
      this.router.navigate(['/admin/login']);
      return 'Phiên làm việc đã hết hạn. Vui lòng đăng nhập lại.';
    }
    if (err?.status === 403) {
      return 'Bạn không có quyền thực hiện thao tác này (yêu cầu quyền Quản lý - Manager).';
    }
    return err?.error?.message || err?.message || fallbackMessage;
  }

  private getEmptyFormData(): PromotionFormData {
    return {
      code: '',
      title: '',
      description: '',
      type: 'percent',
      discountValue: null,
      maxDiscountAmount: null,
      minOrderValue: 0,
      usageLimit: 100,
      usageLimitPerCustomer: 1,
      scope: 'all_products',
      applicableCategories: [],
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
      status: 'draft'
    };
  }

  private showToast(title: string, icon: 'success' | 'error' | 'warning'): void {
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon,
      title,
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
  }
}
