import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { firstValueFrom } from 'rxjs';
// Nhớ chỉnh lại đường dẫn service cho khớp với thư mục của bạn
import { OrderHistoryService } from '../../services/order-history';
import { OrderService } from '../../services/order';
import { CartService } from '../../services/cart';
import { CartStateService } from '../../services/cart-state.service';
import { NotificationService } from '../../components/notification/notification.service';
import Swal from 'sweetalert2';

interface BuyAgainOrderItem {
  productVariantId?: string;
  Product_variant_id?: string;
  quantity?: number;
  Quantity?: number;
}

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './order-history.html',
  styleUrls: ['./order-history.scss']
})
export class OrderHistory implements OnInit, OnDestroy {
  orders: any[] = [];
  filteredOrders: any[] = [];
  paginatedOrders: any[] = [];
  isLoading = false;
  loadError = '';

  searchKeyword: string = '';
  selectedStatus: string = 'all';

  currentPage: number = 1;
  pageSize: number = 5;
  totalPages: number = 1;
  pageNumbers: number[] = [];
  productPreviewLimit: number = 3;
  expandedOrders: Set<string> = new Set();
  selectedOrder: any = null;
  activePaymentOrder: any = null;
  isPaymentModalOpen = false;
  isProcessingPayment = false;
  paymentError = '';
  paymentSecondsLeft = 300;
  paymentCode = '';
  readonly bankInfo = {
    bankName: 'Ngân hàng TMCP Công Thương Việt Nam (VietinBank)',
    bankBin: '970415',
    accountNumber: '106887454720',
    alias: '0343422248',
    accountHolder: 'LE THANH TOAN',
  };
  private statusTimers: ReturnType<typeof setTimeout>[] = [];
  private paymentTimerId: ReturnType<typeof setInterval> | null = null;
  private paymentPollingId: ReturnType<typeof setInterval> | null = null;

  tabs = [
    { label: 'Tất cả', value: 'all' },
    { label: 'Chờ thanh toán', value: 'pending_payment' },
    { label: 'Đang xử lý', value: 'processing' },
    { label: 'Đang giao', value: 'shipping' },
    { label: 'Đánh giá', value: 'review' },
    { label: 'Hoàn hàng', value: 'returning' },
    { label: 'Đã hủy', value: 'cancelled' }
  ];

  constructor(
    private orderHistoryService: OrderHistoryService,
    private orderService: OrderService,
    private cartService: CartService,
    private cartState: CartStateService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef // Tiêm công cụ ép vẽ lại giao diện
  ) {}

  ngOnInit() {
    this.loadOrders();
  }

  ngOnDestroy(): void {
    this.clearStatusTimers();
    this.stopPaymentTimer();
    this.stopPaymentStatusPolling();
  }

  loadOrders() {
    this.clearStatusTimers();
    this.isLoading = true;
    this.loadError = '';
    this.orderHistoryService.getOrderHistory('all').subscribe({
      next: (res) => {
        if (res.success) {
          this.orders = res.data || [];
          this.loadError = '';
          if (this.selectedOrder) {
            const refreshedSelectedOrder = this.orders.find(
              (order) => order.Order_code === this.selectedOrder?.Order_code
            );
            if (refreshedSelectedOrder) {
              this.selectedOrder = refreshedSelectedOrder;
            }
          }
        } else {
          this.orders = [];
          this.loadError = res.message || 'Không thể tải lịch sử đơn hàng. Vui lòng thử lại sau.';
          this.notificationService.error(this.loadError);
        }

        this.applyFilters();
        this.scheduleDemoStatusUpdates();
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('Lỗi tải đơn hàng', err);
        this.orders = [];
        this.applyFilters();
        this.loadError = err?.error?.message || 'Không thể tải lịch sử đơn hàng. Vui lòng thử lại sau.';
        this.isLoading = false;
        this.notificationService.error(this.loadError);
        this.cdr.detectChanges();
      }
    });
  }

  setStatus(status: string) {
    this.selectedStatus = status;
    this.currentPage = 1;
    this.applyFilters();
  }

  onSearchChange() {
    this.currentPage = 1;
    this.applyFilters();
  }

  applyFilters() {
    let temp = this.orders;

    if (this.selectedStatus !== 'all') {
      temp = temp.filter((o) => {
        const status = this.normalizeStatus(o.Status);
        if (this.selectedStatus === 'review') {
          return status === 'review' || status === 'delivered';
        }

        return status === this.selectedStatus;
      });
    }

    if (this.searchKeyword && this.searchKeyword.trim() !== '') {
      const keyword = this.searchKeyword.trim().toLowerCase();
      temp = temp.filter(o => o.Order_code.toLowerCase().includes(keyword));
    }

    this.filteredOrders = temp;
    this.calculatePagination();
  }

  calculatePagination() {
    this.totalPages = Math.ceil(this.filteredOrders.length / this.pageSize);
    if (this.totalPages === 0) this.totalPages = 1;

    this.pageNumbers = [];
    for (let i = 1; i <= this.totalPages; i++) {
      this.pageNumbers.push(i);
    }

    this.updatePaginatedOrders();
  }

  updatePaginatedOrders() {
    const startIndex = (this.currentPage - 1) * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedOrders = this.filteredOrders.slice(startIndex, endIndex);
  }

  goToPage(page: number) {
    if (page >= 1 && page <= this.totalPages) {
      this.currentPage = page;
      this.updatePaginatedOrders();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // --- CÁC HÀM TIỆN ÍCH HIỂN THỊ HTML ---
  getTotalQuantity(order: any): number {
    return order.Items ? order.Items.reduce((sum: number, item: any) => sum + (item.Quantity || 0), 0) : 0;
  }

  getTotal(order: any): number {
    return order.Items ? order.Items.reduce((sum: number, item: any) => sum + ((item.Price || 0) * (item.Quantity || 0)), 0) : 0;
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN').format(price) + ' đ';
  }

  getStatusLabel(order: any): string {
    const status = this.normalizeStatus(order.Status);
    if (this.selectedStatus === 'review' && (status === 'delivered' || status === 'review')) {
      return this.isReviewedOrder(order) ? 'Đã đánh giá' : 'Chưa đánh giá';
    }

    if (status === 'delivered') {
      return 'Đã giao';
    }

    const tab = this.tabs.find(t => t?.value === status);
    return tab ? tab.label : 'Không xác định';
  }

  isShippingOrder(order: any): boolean {
    const status = this.normalizeStatus(order.Status);
    return status === 'shipping' || status === 'delivering';
  }

  isBankTransferOrder(order: any): boolean {
    return this.normalizePaymentType(order?.Payment_type) === 'banktransfer';
  }

  isPendingPaymentOrder(order: any): boolean {
    return this.normalizeStatus(order.Status) === 'pending_payment';
  }

  isPendingPaymentDetail(order: any): boolean {
    return this.isPendingPaymentOrder(order);
  }

  isProcessingOrder(order: any): boolean {
    return this.normalizeStatus(order.Status) === 'processing';
  }

  isDeliveredOrder(order: any): boolean {
    return this.normalizeStatus(order.Status) === 'delivered';
  }

  isReviewOrder(order: any): boolean {
    const status = this.normalizeStatus(order.Status);
    return status === 'review' || status === 'delivered';
  }

  isReviewedOrder(order: any): boolean {
    return this.normalizeReviewStatus(order?.Review_status) === 'reviewed';
  }

  isCancelledOrder(order: any): boolean {
    return this.normalizeStatus(order.Status) === 'cancelled';
  }
  isReturningOrder(order: any): boolean {
    return this.normalizeStatus(order?.Status) === 'returning';
  }

  getVisibleItems(order: any): any[] {
    if (this.isExpanded(order)) return order.Items;
    return order.Items.slice(0, this.productPreviewLimit);
  }

  getHiddenItemCount(order: any): number {
    return Math.max(order.Items.length - this.productPreviewLimit, 0);
  }

  toggleProducts(order: any): void {
    if (this.isExpanded(order)) {
      this.expandedOrders.delete(order.Order_code);
    } else {
      this.expandedOrders.add(order.Order_code);
    }
  }

  isExpanded(order: any): boolean {
    return this.expandedOrders.has(order.Order_code);
  }

  hideBrokenImage(event: any): void {
    event.target.src = '/assets/images/default-product.png';
  }

  isPendingQrOrder(order: any): boolean {
    return this.isBankTransferOrder(order)
      && this.isPendingPaymentOrder(order)
      && String(order?.Payment_status || '').trim().toLowerCase() !== 'paid';
  }

  openPaymentModal(order: any): void {
    if (!this.isPendingQrOrder(order)) {
      this.notificationService.info('Không thể mở thanh toán cho đơn hàng này.');
      return;
    }

    this.activePaymentOrder = order;
    this.paymentCode = this.getPaymentCode(order);
    if (!this.paymentCode) {
      this.activePaymentOrder = null;
      this.notificationService.error('Không thể tải thông tin thanh toán');
      return;
    }

    this.paymentError = '';
    this.paymentSecondsLeft = 300;
    this.isPaymentModalOpen = true;
    this.startPaymentTimer();
    this.startPaymentStatusPolling();
  }

  closePaymentModal(): void {
    this.isPaymentModalOpen = false;
    this.activePaymentOrder = null;
    this.paymentError = '';
    this.stopPaymentTimer();
    this.stopPaymentStatusPolling();
  }

  cancelPayment(): void {
    this.closePaymentModal();
  }

  getPaymentCode(order: any): string {
    return String(order?.Order_code || '').trim();
  }

  get transferContent(): string {
    return this.paymentCode;
  }

  get vietQrUrl(): string {
    const amount = Math.round(Number(this.activePaymentOrder?.Total_amount) || 0);
    const params = new URLSearchParams({
      amount: String(amount),
      addInfo: this.transferContent,
      accountName: this.bankInfo.accountHolder,
    });

    return `https://img.vietqr.io/image/${this.bankInfo.bankBin}-${this.bankInfo.accountNumber}-compact2.png?${params.toString()}`;
  }

  get paymentTimerLabel(): string {
    const minutes = Math.floor(this.paymentSecondsLeft / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (this.paymentSecondsLeft % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  downloadVietQr(): void {
    const link = document.createElement('a');
    link.href = this.vietQrUrl;
    link.download = `vista-vietqr-${this.paymentCode || 'don-hang'}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  confirmScannedPayment(): void {
    if (!this.activePaymentOrder || !this.paymentCode) {
      this.paymentError = 'Không thể tải thông tin thanh toán';
      return;
    }

    this.isProcessingPayment = true;
    this.paymentError = '';

    this.orderService.confirmBankTransferPayment({
      paymentId: this.paymentCode,
      amount: Math.round(Number(this.activePaymentOrder.Total_amount) || 0),
      transferContent: this.transferContent,
      transactionCode: `QR_${Date.now()}`,
    }).subscribe({
      next: (res) => {
        this.isProcessingPayment = false;

        if (res.success && res.data?.paymentStatus === 'paid') {
          this.notificationService.success(res.message || 'Thanh toán thành công.');
          this.selectedStatus = 'processing';
          this.closePaymentModal();
          this.loadOrders();
          return;
        }

        this.paymentError = res.message || 'Thanh toán chưa được xác nhận.';
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isProcessingPayment = false;
        this.paymentError = err?.error?.message || 'Không thể xác nhận thanh toán. Vui lòng thử lại sau.';
        this.cdr.detectChanges();
      },
    });
  }

  getDetailTimeline(order: any): Array<{
    key: string;
    title: string;
    description: string;
    active: boolean;
  }> {
    const isBankTransfer = this.isBankTransferOrder(order);
    const currentIndex = this.getDetailTimelineCurrentIndex(order, isBankTransfer);
    const status = this.normalizeStatus(order?.Status);
    if (status === 'returning' || status === 'cancelled') {
      return [
        {
          key: status,
          title: status === 'cancelled' ? 'Đã hủy đơn hàng' : 'Đang hoàn hàng',
          description: status === 'cancelled' 
            ? 'Đơn hàng này đã bị hủy.' 
            : 'Hệ thống đang xử lý yêu cầu hoàn trả cho đơn hàng này.',
          active: true,
        }
      ];
    }

    const steps = [
      {
        key: 'created',
        title: 'Đơn hàng đã được tạo',
        description: 'Hệ thống đã ghi nhận đơn hàng của bạn.',
      },
      ...(isBankTransfer
        ? [
            {
              key: 'pending_payment',
              title: 'Chờ thanh toán',
              description: 'Đơn hàng QR/chuyển khoản đang chờ thanh toán.',
            },
          ]
        : []),
      {
        key: 'processing',
        title: 'Đang xử lý',
        description: 'VISTA đang kiểm tra và chuẩn bị sản phẩm.',
      },
      {
        key: 'shipping',
        title: 'Đang giao',
        description: 'Đơn hàng đang được giao đến bạn.',
      },
      {
        key: 'completed',
        title: 'Hoàn tất đơn hàng',
        description:
          status === 'delivered' || status === 'review'
            ? 'Đơn hàng đã hoàn tất và đã được đánh giá.'
            : 'Bạn có thể đánh giá hoặc yêu cầu trả hàng.',
      },
    ];

    return steps.map((step, index) => ({
      ...step,
      active: index <= currentIndex,
    }));
  }

  // --- NÚT BẤM VÀ MODAL ---
  openOrderDetail(order: any): void { this.selectedOrder = order; }
  closeOrderDetail(): void { this.selectedOrder = null; }

  handleCancelOrder(_order: any): void {
    this.notificationService.info('Chức năng hủy đơn hàng sẽ được cập nhật sau');
  }

  handleReturnOrder(_order: any): void {
    this.notificationService.info('Chức năng trả hàng sẽ được cập nhật sau');
  }

  handleReviewNow(_order: any): void {
    this.notificationService.info('Chức năng đánh giá sẽ được cập nhật sau');
  }

  async handleBuyAgain(order: any): Promise<void> {
    const userId = this.cartService.getCurrentUserId();
    if (!userId) {
      Swal.fire({
        icon: 'warning',
        title: 'Vui lòng đăng nhập',
        text: 'Bạn cần đăng nhập để mua lại sản phẩm.',
        confirmButtonColor: '#2563B0'
      });
      return;
    }

    const orderItems: BuyAgainOrderItem[] = Array.isArray(order?.Items) ? order.Items : [];
    const validItems = orderItems.filter((item: BuyAgainOrderItem) => {
      const variantId = this.getOrderItemVariantId(item);
      return !!variantId;
    });
    const invalidCount = orderItems.length - validItems.length;

    if (validItems.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Không có sản phẩm hợp lệ để mua lại',
        text: 'Không thể thêm sản phẩm nào từ đơn hàng này vào giỏ hàng.',
        confirmButtonColor: '#2563B0'
      });
      return;
    }

    let successCount = 0;
    let failedCount = 0;

    for (const item of validItems) {
      const variantId = this.getOrderItemVariantId(item);
      const quantity = Math.max(1, Number(item.Quantity || item.quantity || 1));

      try {
        const res = await firstValueFrom(this.cartService.addToCart(userId, variantId, quantity));
        successCount += 1;

        const totalProducts = res.data?.cart?.Total_product ?? this.cartState.getTotalQuantity(res.data?.items || []);
        this.cartState.setCount(totalProducts);
      } catch (error) {
        console.error('Không thể thêm sản phẩm vào giỏ hàng', error);
        failedCount += 1;
      }
    }

    if (failedCount > 0 || invalidCount > 0) {
      Swal.fire({
        icon: 'error',
        title: 'Không thể thêm một số sản phẩm vào giỏ hàng',
        text: 'Vui lòng thử lại sau.',
        confirmButtonColor: '#2563B0'
      });
      return;
    }

    if (successCount > 0) {
      Swal.fire({
        icon: 'success',
        title: 'Đã thêm vào giỏ hàng',
        text: 'Sản phẩm đã được cập nhật vào giỏ hàng của bạn.',
        confirmButtonColor: '#2563B0'
      });
    }
  }

  markOrderReceived(order: any): void {
    const orderId = order?.Order_code;
    if (!orderId || !this.isShippingOrder(order)) {
      return;
    }

    this.orderHistoryService.markOrderReceived(orderId).subscribe({
      next: (res) => {
        if (res.success) {
          this.notificationService.success(res.message || 'Đã ghi nhận đơn hàng đã được nhận.');
          this.closeOrderDetail();
          this.selectedStatus = 'review';
          this.currentPage = 1;
          this.loadOrders();
        } else {
          this.notificationService.error(res.message || 'Không thể xác nhận đã nhận hàng.');
        }
      },
      error: (err) => {
        this.notificationService.error(err?.error?.message || 'Không thể xác nhận đã nhận hàng.');
      },
    });
  }

  private normalizeStatus(status: any): string {
    const value = String(status || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (['dang giao', 'dang van chuyen', 'delivering', 'shipping'].includes(value)) {
      return 'shipping';
    }

    if (['da giao', 'da nhan duoc hang', 'delivered'].includes(value)) {
      return 'delivered';
    }

    if (['cho xu ly', 'processing'].includes(value)) {
      return 'processing';
    }

    if (['cho thanh toan', 'pending_payment'].includes(value)) {
      return 'pending_payment';
    }

    if (['danh gia', 'review'].includes(value)) {
      return 'review';
    }

    if (['da huy', 'cancelled', 'cancel'].includes(value)) {
      return 'cancelled';
    }

    if (['tra hang', 'returning'].includes(value)) {
      return 'returning';
    }

    return value;
  }

  private normalizePaymentType(value: any): string {
    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');

    if (['cod', 'cash', 'tien mat', 'tienmat', 'thanh toan tien mat', 'thanh toan khi nhan hang'].includes(normalized)) {
      return 'cod';
    }

    if (['banktransfer', 'qr', 'chuyen khoan', 'chuyen khoan qr', 'chuyen khoan ngan hang'].includes(normalized)) {
      return 'banktransfer';
    }

    return normalized;
  }

  private normalizeReviewStatus(value: any): string {
    if (value === true) {
      return 'reviewed';
    }

    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    if (
      ['reviewed', 'da danh gia', 'da_danh_gia', 'approved', 'completed', 'true'].includes(normalized)
    ) {
      return 'reviewed';
    }

    if (
      ['not_reviewed', 'chua danh gia', 'chua_danh_gia', 'pending', 'false', ''].includes(normalized)
    ) {
      return 'not_reviewed';
    }

    return normalized ? 'reviewed' : 'not_reviewed';
  }

  private getOrderItemVariantId(item: BuyAgainOrderItem): string {
    return String(item?.productVariantId || item?.Product_variant_id || '').trim();
  }

  private getDetailTimelineCurrentIndex(order: any, isBankTransfer: boolean): number {
    const status = this.normalizeStatus(order?.Status);

    if (status === 'pending_payment') {
      return isBankTransfer ? 1 : 0;
    }

    if (status === 'processing') {
      return isBankTransfer ? 2 : 1;
    }

    if (status === 'shipping' || status === 'delivering') {
      return isBankTransfer ? 3 : 2;
    }

    if (status === 'delivered' || status === 'review') {
      return isBankTransfer ? 4 : 3;
    }

    if (status === 'returning' || status === 'cancelled') {
      return isBankTransfer ? 4 : 3;
    }

    return 0;
  }

  private startPaymentTimer(): void {
    this.stopPaymentTimer();
    this.paymentTimerId = setInterval(() => {
      this.paymentSecondsLeft = Math.max(0, this.paymentSecondsLeft - 1);
      if (this.paymentSecondsLeft === 0) {
        this.cancelPayment();
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  private stopPaymentTimer(): void {
    if (this.paymentTimerId) {
      clearInterval(this.paymentTimerId);
      this.paymentTimerId = null;
    }
  }

  private startPaymentStatusPolling(): void {
    this.stopPaymentStatusPolling();
    this.checkPaymentStatusOnce();
    this.paymentPollingId = setInterval(() => {
      this.checkPaymentStatusOnce();
    }, 3000);
  }

  private stopPaymentStatusPolling(): void {
    if (this.paymentPollingId) {
      clearInterval(this.paymentPollingId);
      this.paymentPollingId = null;
    }
  }

  private checkPaymentStatusOnce(): void {
    if (!this.activePaymentOrder || !this.paymentCode) {
      return;
    }

    this.orderService.checkPaymentStatus(this.paymentCode).subscribe({
      next: (res) => {
        const status = res.data?.paymentStatus;
        if (status === 'paid') {
          this.notificationService.success('Thanh toán thành công.');
          this.selectedStatus = 'processing';
          this.closePaymentModal();
          this.loadOrders();
        }
      },
      error: () => undefined,
    });
  }

  private scheduleDemoStatusUpdates(): void {
    this.clearStatusTimers();

    const processingOrders = this.orders.filter((order) => order.Status === 'processing');
    if (processingOrders.length === 0) {
      return;
    }

    const remainingTimes = processingOrders
      .map((order) => {
        const processingStartedAt = new Date(order.Processing_started_at || '').getTime();
        const createdAt = new Date(order.Created_at || '').getTime();
        const startTime = !Number.isNaN(processingStartedAt) && processingStartedAt > 0
          ? processingStartedAt
          : createdAt;

        if (Number.isNaN(startTime)) {
          return null;
        }
        return Math.max(0, 10000 - (Date.now() - startTime));
      })
      .filter((value): value is number => value !== null);

    if (remainingTimes.length === 0) {
      return;
    }

    const timer = setTimeout(() => {
      this.loadOrders();
    }, Math.min(...remainingTimes));

    this.statusTimers.push(timer);
  }

  private clearStatusTimers(): void {
    this.statusTimers.forEach((timer) => clearTimeout(timer));
    this.statusTimers = [];
  }
}
