import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subscription, debounceTime, finalize } from 'rxjs';
import { OrderRealtimeService } from '../../../services/order-realtime.service';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucidePackage,
  lucideX,
  lucideEye,
  lucideTriangleAlert,
  lucideArrowRight,
  lucideChevronLeft,
  lucideChevronRight,
  lucideRefreshCw,
  lucideClock,
  lucidePrinter,
} from '@ng-icons/lucide';
import { getAdminRole } from '../../../guards/admin-guard';
import {
  AdminApiResponse,
  AdminOrderDetail,
  AdminOrderService,
  AdminOrderSummary,
  BulkAction,
  CancelReason,
  OrderAction,
  ShippingLabel,
  OrderDisplayStatus,
  OrderStatusHistoryItem,
} from '../../services/admin-order';

import { ResizableDrawerDirective } from '../../directives/resizable-drawer.directive';

type ModalAction = Exclude<OrderAction, 'print_label'>;

const STATUS_LABELS: Record<OrderDisplayStatus, string> = {
  pending_payment: 'Chờ thanh toán',
  pending_confirmation: 'Chờ xác nhận',
  processing: 'Đang xử lý',
  shipping: 'Đang giao',
  completed: 'Hoàn tất',
  cancelled: 'Đã hủy',
  returning: 'Hoàn hàng',
};

const EVENT_LABELS: Record<string, string> = {
  order_created: 'Khách hàng đặt đơn',
  confirmed: 'Xác nhận đơn hàng',
  cancelled: 'Hủy đơn hàng',
  shipment_created: 'Tạo mã vận đơn',
  handed_over: 'Bàn giao cho ĐVVC – Đang giao',
  picked_up: 'Đơn vị vận chuyển đã lấy hàng',
  carrier_delivered: 'Đơn vị vận chuyển đã giao hàng',
  customer_received: 'Khách xác nhận đã nhận hàng',
  auto_received: 'Tự động xác nhận đã nhận hàng',
  completed: 'Hoàn tất',
  return_requested: 'Khách yêu cầu hoàn trả',
};

const PAYMENT_TYPE_LABELS: Record<string, string> = {
  COD: 'Thanh toán khi nhận hàng',
  BankTransfer: 'Chuyển khoản ngân hàng',
  MoMo: 'Ví MoMo',
  VNPay: 'VNPay',
};

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon, ResizableDrawerDirective],
  providers: [
    provideIcons({
      lucideSearch,
      lucidePackage,
      lucideX,
      lucideEye,
      lucideTriangleAlert,
      lucideArrowRight,
      lucideChevronLeft,
      lucideChevronRight,
      lucideRefreshCw,
      lucideClock,
      lucidePrinter,
    }),
  ],
  templateUrl: './admin-orders.html',
  styleUrl: './admin-orders.scss',
})
export class AdminOrders implements OnInit, OnDestroy {
  readonly canEdit = getAdminRole() === 'Staff';
  readonly statusOptions = Object.entries(STATUS_LABELS).map(([value, label]) => ({ value, label }));
  readonly paymentTypeOptions = [
    { value: '', label: 'Tất cả phương thức' },
    { value: 'COD', label: 'COD (Tiền mặt)' },
    { value: 'MoMo', label: 'Ví MoMo' },
    { value: 'VNPay', label: 'VNPay' },
    { value: 'BankTransfer', label: 'Chuyển khoản' },
  ];
  // Tab trạng thái: "" = tất cả, "overdue" = quá hạn xử lý
  readonly tabs: { value: string; label: string; countKey: string }[] = [
    { value: '', label: 'Tất cả', countKey: 'all' },
    { value: 'overdue', label: 'Quá hạn', countKey: 'overdue' },
    ...this.statusOptions.map((option) => ({ ...option, countKey: option.value })),
  ];
  readonly pageSizeOptions = [10, 20, 50];

  // Bộ lọc danh sách
  keyword = '';
  statusFilter = '';
  paymentTypeFilter = '';
  fromDate = '';
  toDate = '';
  page = 1;
  limit = 10;

  orders: AdminOrderSummary[] = [];
  total = 0;
  counts: Record<string, number> = {};
  now = Date.now();

  // Chọn nhiều đơn để thao tác hàng loạt
  selectedIds = new Set<string>();
  bulkAction: BulkAction | null = null;
  isBulkSubmitting = false;
  isPrintingLabels = false;
  isRefreshing = false;

  // Danh mục lý do hủy (Staff)
  cancelReasons: CancelReason[] = [];
  isLoadingCancelReasons = false;
  cancelReasonsError = '';
  modalReasonCode = '';
  isLoading = false;
  loadError = '';

  readonly fallbackProductImage =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60" fill="%23f1f5f9"><rect width="60" height="60" rx="6"/><path d="M30 18l12 7v14l-12 7-12-7V25l12-7z" fill="none" stroke="%2394a3b8" stroke-width="2"/><path d="M18 25l12 7 12-7M30 32v14" fill="none" stroke="%2394a3b8" stroke-width="2"/></svg>';

  // Drawer chi tiết
  isDetailOpen = false;
  isDetailLoading = false;
  detailError = '';
  detail: AdminOrderDetail | null = null;

  // Popup thao tác
  modalAction: ModalAction | null = null;
  modalNote = '';
  modalError = '';
  isSubmitting = false;

  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  private searchTimer?: ReturnType<typeof setTimeout>;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private queryParamsSubscription?: Subscription;
  private realtimeSubscription?: Subscription;
  private clockTimer?: ReturnType<typeof setInterval>;

  constructor(
    private readonly orderService: AdminOrderService,
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly orderRealtime: OrderRealtimeService,
  ) {}

  ngOnInit(): void {
    if (this.canEdit) {
      this.loadCancelReasons();
    }

    // Đồng hồ 1 phút: cập nhật thời gian còn lại / quá hạn, đơn vừa quá hạn thì tải lại để đưa lên đầu
    this.clockTimer = setInterval(() => {
      this.now = Date.now();
      const justOverdue = this.orders.some(
        (order) => !order.Is_overdue && order.Sla_deadline && new Date(order.Sla_deadline).getTime() <= this.now,
      );
      if (justOverdue) {
        this.loadOrders(true);
      } else {
        this.changeDetectorRef.detectChanges();
      }
    }, 60 * 1000);

    // Mở từ thông báo: /admin/orders?orderId=... → mở chi tiết đơn đó
    // Mở từ thông báo hoặc dashboard: /admin/orders?orderId=... hoặc ?status=... / ?paymentType=...
    this.queryParamsSubscription = this.route.queryParamMap.subscribe((params) => {
      const orderId = params.get('orderId')?.trim();
      if (orderId) {
        // Mở từ thông báo: chỉ mở chi tiết đơn, không lọc danh sách theo mã đơn,
        // rồi xóa ?orderId khỏi URL để tải lại trang không bị kẹt ở đơn đó
        this.openDetail(orderId);
        // Điều hướng này phát lại queryParamMap (không còn orderId) → danh sách tự tải ở nhánh dưới
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
        return;
      }

      const statusParam = params.get('status')?.trim();
      if (statusParam !== undefined && statusParam !== null) {
        this.statusFilter = statusParam;
      }
      const paymentTypeParam = params.get('paymentType')?.trim();
      if (paymentTypeParam !== undefined && paymentTypeParam !== null) {
        this.paymentTypeFilter = paymentTypeParam;
      }

      this.loadOrders();
    });

    // Có đơn mới / đơn đổi trạng thái → tải lại danh sách (và chi tiết đang mở) mà không nháy loading
    this.realtimeSubscription = this.orderRealtime.orderUpdated$
      .pipe(debounceTime(400))
      .subscribe((event) => {
        this.loadOrders(true);
        if (this.isDetailOpen && !this.modalAction && this.detail?.Order_id === event.orderId) {
          this.refreshDetail(event.orderId);
        }
      });
  }

  loadCancelReasons(callback?: () => void): void {
    if (this.isLoadingCancelReasons) return;
    this.isLoadingCancelReasons = true;
    this.cancelReasonsError = '';

    this.orderService.getCancelReasons().pipe(
      finalize(() => {
        this.isLoadingCancelReasons = false;
        this.changeDetectorRef.detectChanges();
      })
    ).subscribe({
      next: (response) => {
        this.cancelReasons = response.data ?? [];
        callback?.();
      },
      error: () => {
        this.cancelReasonsError = 'Không tải được danh mục lý do hủy. Vui lòng bấm Thử lại.';
      }
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
    clearTimeout(this.toastTimer);
    this.queryParamsSubscription?.unsubscribe();
    this.realtimeSubscription?.unsubscribe();
    clearInterval(this.clockTimer);
  }

  // ===== Danh sách =====

  loadOrders(silent = false, onComplete?: () => void): void {
    if (!silent) {
      this.isLoading = true;
      this.loadError = '';
    }

    this.orderService
      .getOrders({
        keyword: this.keyword.trim(),
        status: this.statusFilter,
        paymentType: this.paymentTypeFilter,
        fromDate: this.fromDate,
        toDate: this.toDate,
        page: this.page,
        limit: this.limit,
      })
      .pipe(
        finalize(() => {
          this.isLoading = false;
          onComplete?.();
          this.changeDetectorRef.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          this.orders = response.data?.items ?? [];
          this.total = response.data?.total ?? 0;
          this.counts = response.data?.counts ?? {};
          this.now = Date.now();
          this.loadError = '';
          // Bỏ chọn các đơn không còn trên trang hiện tại
          const visibleIds = new Set(this.orders.map((order) => order.Order_id));
          this.selectedIds = new Set([...this.selectedIds].filter((id) => visibleIds.has(id)));
        },
        error: () => {
          // Tải lại ngầm bị lỗi thì giữ nguyên dữ liệu đang hiển thị
          if (silent) return;
          this.orders = [];
          this.total = 0;
          this.loadError = 'Không tải được danh sách đơn hàng. Vui lòng thử lại.';
        },
      });
  }

  refreshData(): void {
    if (this.isLoading || this.isRefreshing) return;
    this.isRefreshing = true;
    this.loadOrders(false, () => {
      this.isRefreshing = false;
      this.showToast('Đã làm mới danh sách đơn hàng', 'success');
    });
  }

  onKeywordChange(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.applyFilters(), 400);
  }

  applyFilters(): void {
    this.page = 1;
    this.selectedIds.clear();
    this.loadOrders();
  }

  selectTab(value: string): void {
    if (this.statusFilter === value) return;
    this.statusFilter = value;
    this.applyFilters();
  }

  getTabCount(countKey: string): number {
    return this.counts[countKey] ?? 0;
  }

  clearFilters(): void {
    this.keyword = '';
    this.statusFilter = '';
    this.paymentTypeFilter = '';
    this.fromDate = '';
    this.toDate = '';
    this.applyFilters();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }

  // Phân trang rút gọn: 1 … 4 5 6 … 22 (null = dấu …)
  get pageItems(): (number | null)[] {
    const total = this.totalPages;
    if (total <= 7) {
      return Array.from({ length: total }, (_, index) => index + 1);
    }

    const start = Math.max(2, Math.min(this.page - 1, total - 4));
    const end = Math.min(total - 1, Math.max(this.page + 1, 5));
    const items: (number | null)[] = [1];

    if (start > 2) items.push(null);
    for (let number = start; number <= end; number++) items.push(number);
    if (end < total - 1) items.push(null);
    items.push(total);

    return items;
  }

  get rangeStart(): number {
    return this.total === 0 ? 0 : (this.page - 1) * this.limit + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.page * this.limit, this.total);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) {
      return;
    }

    this.page = page;
    this.selectedIds.clear();
    this.loadOrders();
  }

  // ===== Chi tiết =====

  openDetail(orderId: string, nextAction?: ModalAction): void {
    this.isDetailOpen = true;
    this.isDetailLoading = true;
    this.detailError = '';
    this.detail = null;

    this.orderService
      .getOrderDetail(orderId)
      .pipe(
        finalize(() => {
          this.isDetailLoading = false;
          this.changeDetectorRef.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          this.detail = response.data ?? null;
          if (nextAction && this.detail?.Available_actions.includes(nextAction)) {
            this.openModal(nextAction);
          }
        },
        error: () => {
          this.detailError = 'Không tải được chi tiết đơn hàng. Vui lòng thử lại.';
        },
      });
  }

  // Cập nhật lại chi tiết đang mở mà không xóa nội dung đang hiển thị
  private refreshDetail(orderId: string): void {
    this.orderService.getOrderDetail(orderId).subscribe({
      next: (response) => {
        if (this.isDetailOpen && this.detail?.Order_id === orderId && response.data) {
          this.detail = response.data;
          this.changeDetectorRef.detectChanges();
        }
      },
    });
  }

  closeDetail(): void {
    this.isDetailOpen = false;
    this.detail = null;
    this.closeModal();
  }

  hasAction(action: OrderAction): boolean {
    return this.canEdit && !!this.detail?.Available_actions.includes(action);
  }

  get primaryAction(): ModalAction | null {
    const actions = this.detail?.Available_actions ?? [];
    if (actions.includes('confirm')) return 'confirm';
    if (actions.includes('hand_over')) return 'hand_over';
    return null;
  }

  get historyItems(): OrderStatusHistoryItem[] {
    const rawHistory = this.detail?.Status_history ?? [];
    if (!rawHistory.length) {
      return [
        {
          From_status: '',
          To_status: this.detail?.Status ?? '',
          Event: 'order_created',
          Actor_id: '',
          Actor_name: this.detail?.Receiver_name || 'Khách hàng',
          Note: 'Đơn hàng được ghi nhận vào hệ thống',
          Created_at: this.detail?.Created_at ?? null,
        },
      ];
    }

    return [...rawHistory].sort((a, b) => {
      const timeA = a.Created_at ? new Date(a.Created_at).getTime() : 0;
      const timeB = b.Created_at ? new Date(b.Created_at).getTime() : 0;
      return timeA - timeB;
    });
  }

  // Các mốc chưa tới, hiển thị mờ ở cuối dòng thời gian
  get upcomingSteps(): string[] {
    switch (this.detail?.Display_status) {
      case 'pending_confirmation':
        return ['Đang xử lý', 'Đang giao', 'Hoàn tất'];
      case 'processing':
        return ['Đang giao', 'Hoàn tất'];
      case 'shipping':
        return ['Hoàn tất'];
      default:
        return [];
    }
  }

  // ===== Popup thao tác =====

  openModal(action: ModalAction): void {
    if (!this.canEdit) {
      return;
    }

    this.modalAction = action;
    this.modalNote = '';
    this.modalReasonCode = '';
    this.modalError = '';

    if (action === 'cancel' && (!this.cancelReasons || !this.cancelReasons.length)) {
      this.loadCancelReasons();
    }
  }

  closeModal(): void {
    if (this.isSubmitting) {
      return;
    }

    this.modalAction = null;
    this.modalNote = '';
    this.modalReasonCode = '';
    this.modalError = '';
  }

  get selectedCancelReason(): CancelReason | undefined {
    return this.cancelReasons.find((reason) => reason.code === this.modalReasonCode);
  }

  get modalTitle(): string {
    switch (this.modalAction) {
      case 'confirm':
        return 'Xác nhận đơn hàng?';
      case 'cancel':
        return 'Hủy đơn hàng?';
      case 'hand_over':
        return 'Bàn giao cho đơn vị vận chuyển?';
      default:
        return '';
    }
  }

  get modalNextStatus(): string {
    switch (this.modalAction) {
      case 'confirm':
        return 'Đang xử lý';
      case 'cancel':
        return 'Đã hủy';
      case 'hand_over':
        return 'Đang giao';
      default:
        return 'Đang xử lý';
    }
  }

  get modalSubmitLabel(): string {
    switch (this.modalAction) {
      case 'confirm':
        return 'Xác nhận đơn';
      case 'cancel':
        return 'Hủy đơn hàng';
      case 'hand_over':
        return 'Xác nhận bàn giao';
      default:
        return 'Xác nhận';
    }
  }

  get needsRefund(): boolean {
    return this.detail?.Payment_status === 'paid' && this.detail?.Payment_type !== 'COD';
  }

  submitModal(): void {
    if (!this.detail || !this.modalAction || this.isSubmitting) {
      return;
    }

    const orderId = this.detail.Order_id;
    const note = this.modalNote.trim();

    if (this.modalAction === 'cancel') {
      if (!this.modalReasonCode) {
        this.modalError = 'Vui lòng chọn lý do hủy đơn.';
        return;
      }
      if (this.selectedCancelReason?.requiresNote && !note) {
        this.modalError = 'Vui lòng ghi rõ lý do hủy đơn.';
        return;
      }
    }

    let request: Observable<AdminApiResponse<unknown>>;
    switch (this.modalAction) {
      case 'confirm':
        request = this.orderService.confirmOrder(orderId, note);
        break;
      case 'cancel':
        request = this.orderService.cancelOrder(orderId, this.modalReasonCode, note);
        break;
      default:
        request = this.orderService.handOverOrder(orderId, note);
    }

    this.isSubmitting = true;
    this.modalError = '';

    request
      .pipe(
        finalize(() => {
          this.isSubmitting = false;
          this.changeDetectorRef.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          this.isSubmitting = false;
          this.closeModal();
          this.showToast(response.message || 'Cập nhật đơn hàng thành công', 'success');
          this.openDetail(orderId);
          this.loadOrders();
        },
        error: (error: unknown) => {
          const message = this.getErrorMessage(error);
          this.modalError = message;
          this.showToast(message, 'error');

          // Đơn đã bị người khác cập nhật: tải lại dữ liệu mới nhất
          if (this.getErrorStatus(error) === 409) {
            this.isSubmitting = false;
            this.closeModal();
            this.openDetail(orderId);
            this.loadOrders();
          }
        },
      });
  }

  // In nhãn vận đơn bằng hộp thoại in của trình duyệt
  printLabel(): void {
    if (!this.detail?.Tracking_number) {
      return;
    }

    this.openPrintWindow([this.detail]);
  }

  // In qua iframe ẩn ngay trong trang: không mở thêm cửa sổ/tab phía sau,
  // khổ giấy 100x150mm (nhãn vận đơn), mỗi nhãn một trang, không có tiêu đề/URL của trình duyệt
  private openPrintWindow(labels: ShippingLabel[]): void {
    const frame = document.createElement('iframe');
    frame.setAttribute('aria-hidden', 'true');
    frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
    document.body.appendChild(frame);

    const frameWindow = frame.contentWindow;
    const frameDocument = frameWindow?.document;
    if (!frameWindow || !frameDocument) {
      frame.remove();
      this.showToast('Không mở được hộp thoại in. Vui lòng thử lại.', 'error');
      return;
    }

    const body = labels.map((label) => this.buildLabelHtml(label)).join('');
    frameDocument.open();
    frameDocument.write(`
      <html>
        <head>
          <title>&nbsp;</title>
          <style>
            @page { size: 100mm 150mm; margin: 0; }
            * { box-sizing: border-box; }
            html, body { margin: 0; padding: 0; }
            body { font-family: Arial, sans-serif; color: #0f172a; }
            .page { width: 100mm; height: 150mm; padding: 6mm; page-break-after: always; break-after: page; overflow: hidden; }
            .page:last-child { page-break-after: auto; break-after: auto; }
            .label { height: 100%; border: 2px solid #0f172a; border-radius: 6px; padding: 5mm; display: flex; flex-direction: column; }
            h1 { margin: 0 0 2mm; font-size: 16px; }
            .tracking { font-size: 22px; font-weight: 700; letter-spacing: 1.5px; margin: 2mm 0 4mm; padding-bottom: 3mm; border-bottom: 1px solid #0f172a; }
            p { margin: 1.5mm 0; font-size: 12px; line-height: 1.4; }
            .cod { margin-top: auto; padding-top: 3mm; border-top: 1px dashed #64748b; font-size: 15px; font-weight: 700; }
          </style>
        </head>
        <body>${body}</body>
      </html>
    `);
    frameDocument.close();

    const cleanup = () => setTimeout(() => frame.remove(), 500);
    frameWindow.addEventListener('afterprint', cleanup, { once: true });

    // Chờ iframe dựng xong rồi mới gọi in
    setTimeout(() => {
      frameWindow.focus();
      frameWindow.print();
      // Một số trình duyệt không bắn afterprint → dọn dẹp dự phòng
      setTimeout(() => frame.isConnected && frame.remove(), 60 * 1000);
    }, 100);
  }

  private buildLabelHtml(label: ShippingLabel): string {
    const codAmount = label.Payment_type === 'COD' && label.Payment_status !== 'paid' ? label.Total_amount : 0;

    return `
      <div class="page">
        <div class="label">
          <h1>${this.escapeHtml(label.Shipping_partner || 'Đơn vị vận chuyển')}</h1>
          <div class="tracking">${this.escapeHtml(label.Tracking_number)}</div>
          <p>Mã đơn: <strong>${this.escapeHtml(label.Order_id)}</strong></p>
          <p>Người nhận: <strong>${this.escapeHtml(label.Receiver_name)}</strong></p>
          <p>SĐT: ${this.escapeHtml(label.Receiver_phone)}</p>
          <p>Địa chỉ: ${this.escapeHtml(label.Address)}</p>
          <div class="cod">Thu hộ (COD): ${this.formatCurrency(codAmount)}</div>
        </div>
      </div>
    `;
  }

  // ===== Thao tác hàng loạt =====

  isSelected(order: AdminOrderSummary): boolean {
    return this.selectedIds.has(order.Order_id);
  }

  toggleSelect(order: AdminOrderSummary): void {
    if (this.selectedIds.has(order.Order_id)) {
      this.selectedIds.delete(order.Order_id);
    } else {
      this.selectedIds.add(order.Order_id);
    }
  }

  get isAllSelected(): boolean {
    return this.orders.length > 0 && this.orders.every((order) => this.selectedIds.has(order.Order_id));
  }

  get isPartiallySelected(): boolean {
    return this.selectedIds.size > 0 && !this.isAllSelected;
  }

  toggleSelectAll(): void {
    if (this.isAllSelected) {
      this.selectedIds.clear();
    } else {
      this.orders.forEach((order) => this.selectedIds.add(order.Order_id));
    }
  }

  clearSelection(): void {
    this.selectedIds.clear();
  }

  get selectedOrders(): AdminOrderSummary[] {
    return this.orders.filter((order) => this.selectedIds.has(order.Order_id));
  }

  // Đơn trong nhóm đã chọn làm được thao tác này
  getBulkEligible(action: BulkAction | 'print_label'): AdminOrderSummary[] {
    return this.selectedOrders.filter((order) =>
      action === 'print_label'
        ? order.Available_actions.includes('print_label') && !!order.Tracking_number
        : order.Available_actions.includes(action),
    );
  }

  openBulkModal(action: BulkAction): void {
    if (!this.canEdit || !this.getBulkEligible(action).length) return;
    this.bulkAction = action;
  }

  closeBulkModal(): void {
    if (this.isBulkSubmitting) return;
    this.bulkAction = null;
  }

  get bulkActionLabel(): string {
    return this.bulkAction === 'confirm' ? 'Xác nhận' : 'Bàn giao cho ĐVVC';
  }

  submitBulk(): void {
    if (!this.bulkAction || this.isBulkSubmitting) return;

    const orderIds = this.getBulkEligible(this.bulkAction).map((order) => order.Order_id);
    this.isBulkSubmitting = true;

    this.orderService
      .bulkUpdate(this.bulkAction, orderIds)
      .pipe(
        finalize(() => {
          this.isBulkSubmitting = false;
          this.changeDetectorRef.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          const failed = response.data?.failed ?? [];
          this.isBulkSubmitting = false;
          this.bulkAction = null;
          this.selectedIds = new Set(failed.map((item) => item.orderId));
          this.showToast(response.message || 'Đã cập nhật đơn hàng', failed.length ? 'error' : 'success');
          this.loadOrders(true);
        },
        error: (error: unknown) => {
          this.showToast(this.getErrorMessage(error), 'error');
        },
      });
  }

  printSelectedLabels(): void {
    const orderIds = this.getBulkEligible('print_label').map((order) => order.Order_id);
    if (!orderIds.length || this.isPrintingLabels) return;

    this.isPrintingLabels = true;
    this.orderService
      .getLabels(orderIds)
      .pipe(
        finalize(() => {
          this.isPrintingLabels = false;
          this.changeDetectorRef.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          const labels = response.data ?? [];
          if (labels.length) {
            this.openPrintWindow(labels);
          } else {
            this.showToast('Không có đơn nào có mã vận đơn để in.', 'error');
          }
        },
        error: (error: unknown) => {
          this.showToast(this.getErrorMessage(error), 'error');
        },
      });
  }

  // ===== SLA =====

  // Chữ hiển thị dưới trạng thái: "Quá hạn xác nhận 3 giờ" / "Còn 45 phút để xác nhận"
  getSlaText(order: AdminOrderSummary): string {
    if (!order.Sla_deadline || !order.Sla_stage) return '';

    const step = order.Sla_stage === 'confirm' ? 'xác nhận' : 'bàn giao';
    const diff = new Date(order.Sla_deadline).getTime() - this.now;

    if (diff <= 0 || order.Is_overdue) {
      return `Quá hạn ${step} ${this.formatDuration(-diff)}`;
    }

    return `Còn ${this.formatDuration(diff)} để ${step}`;
  }

  // Sắp tới hạn (dưới 30 phút) thì tô cam để Staff chú ý
  isSlaWarning(order: AdminOrderSummary): boolean {
    if (!order.Sla_deadline || order.Is_overdue) return false;
    const diff = new Date(order.Sla_deadline).getTime() - this.now;
    return diff > 0 && diff <= 30 * 60 * 1000;
  }

  private formatDuration(ms: number): string {
    const minutes = Math.max(1, Math.floor(Math.abs(ms) / 60000));
    if (minutes < 60) return `${minutes} phút`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      const rest = minutes % 60;
      return rest ? `${hours} giờ ${rest} phút` : `${hours} giờ`;
    }
    return `${Math.floor(hours / 24)} ngày`;
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.bulkAction) {
      this.closeBulkModal();
      return;
    }

    if (this.modalAction) {
      this.closeModal();
      return;
    }

    if (this.isDetailOpen) {
      this.closeDetail();
    }
  }

  // ===== Hiển thị =====

  getStatusLabel(status: OrderDisplayStatus | undefined): string {
    return status ? STATUS_LABELS[status] ?? status : '';
  }

  getPaymentLabel(paymentStatus: string | undefined): string {
    return paymentStatus === 'paid' ? 'Đã thanh toán' : 'Chưa thanh toán';
  }

  getPaymentStatusLabel(status: string | undefined): string {
    switch (status) {
      case 'paid':
        return 'Đã thanh toán';
      case 'pending':
        return 'Chưa thanh toán';
      case 'refunded':
        return 'Đã hoàn tiền';
      case 'failed':
        return 'Thất bại';
      default:
        return status ? status : 'Chưa thanh toán';
    }
  }

  getDeliveryStatusLabel(status: string | undefined, orderDisplayStatus?: string): string {
    switch (status) {
      case 'delivered':
        return 'Đã giao';
      case 'shipping':
        return 'Đang giao';
      case 'failed':
        return 'Giao thất bại';
      case 'pending':
        return orderDisplayStatus === 'pending_confirmation' ? 'Chưa bàn giao' : 'Chờ lấy hàng';
      default:
        return 'Chờ bàn giao';
    }
  }

  onImageError(event: Event): void {
    const target = event.target as HTMLImageElement;
    if (target) {
      target.onerror = null;
      target.src = this.fallbackProductImage;
    }
  }

  getPaymentTypeLabel(paymentType: string | undefined): string {
    return PAYMENT_TYPE_LABELS[paymentType ?? ''] ?? (paymentType || 'Chưa có');
  }

  getEventLabel(event: string): string {
    return EVENT_LABELS[event] ?? event;
  }

  getStatusNote(order: AdminOrderSummary): string {
    if (order.Display_status === 'shipping' && order.Delivery_status === 'delivered') {
      return 'Đã giao – chờ khách xác nhận';
    }

    return '';
  }

  formatCurrency(value: number | undefined): string {
    return `${(Number(value) || 0).toLocaleString('vi-VN')}\u00a0₫`;
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    clearTimeout(this.toastTimer);
    this.toastMessage = message;
    this.toastType = type;
    this.toastTimer = setTimeout(() => {
      this.toastMessage = '';
      this.changeDetectorRef.detectChanges();
    }, 3000);
  }

  private getErrorStatus(error: unknown): number | undefined {
    return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
      ? error.status
      : undefined;
  }

  private getErrorMessage(error: unknown): string {
    return typeof error === 'object' && error !== null &&
      'error' in error && typeof error.error === 'object' &&
      error.error !== null && 'message' in error.error &&
      typeof error.error.message === 'string'
      ? error.error.message
      : 'Cập nhật đơn hàng thất bại. Vui lòng kiểm tra kết nối và thử lại.';
  }

  private escapeHtml(value: string | undefined): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
