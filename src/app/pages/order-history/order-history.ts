import { Component, OnDestroy, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { OrderHistory as OrderHistoryApi } from '../../services/order-history';
import { OrderService } from '../../services/order';
import { NotificationService } from '../../components/notification/notification.service';
import Swal from 'sweetalert2';

// 1. IMPORT AUTHO SERVICE VÀO ĐÂY
import { AuthService } from '../../services/auth';

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
  isCancelModalOpen = false;
  cancelOrderTarget: any = null;
  cancelReason = '';
  cancelError = '';
  isCancellingOrder = false;
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

  readonly cancelReasons = [
    'Tôi muốn cập nhật địa chỉ/SĐT nhận hàng',
    'Tôi muốn thêm/thay đổi mã giảm giá',
    'Tôi muốn thay đổi sản phẩm (kích thước, màu sắc, số lượng...)',
    'Thủ tục thanh toán rắc rối',
    'Tôi tìm thấy chỗ mua khác tốt hơn (rẻ hơn, uy tín hơn, giao nhanh hơn...)',
    'Tôi không có nhu cầu mua nữa',
    'Tôi không tìm thấy lý do hủy phù hợp',
  ];
  private statusTimers: ReturnType<typeof setTimeout>[] = [];
  private readonly processingAutoShipMs = 90 * 1000;
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
    private orderHistoryService: OrderHistoryApi,
    private orderService: OrderService,
    private notificationService: NotificationService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef,
    // 2. TIÊM AUTHO SERVICE VÀO CONSTRUCTOR
    private authService: AuthService
  ) {}

  ngOnInit() {
    const requestedStatus = this.route.snapshot.queryParamMap.get('status') || history.state?.status || 'all';
    if (this.tabs.some((tab) => tab.value === requestedStatus)) {
      this.selectedStatus = requestedStatus;
    }

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
      temp = temp.filter(o => {
        const matchCode = (o.Order_code || '').toLowerCase().includes(keyword);
        const items: any[] = Array.isArray(o?.Items) ? o.Items : [];
        const matchName = items.some(item =>
          (item?.Product_name || '').toLowerCase().includes(keyword)
        );
        return matchCode || matchName;
      });
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

  trackByOrderCode(index: number, order: any): string {
    return String(order?.Order_code || order?.Order_id || index);
  }

  trackByProductVariant(index: number, item: any): string {
    return String(item?.Product_variant_id || item?.productVariantId || item?.Product_id || index);
  }

  trackByEvidence(index: number, evidence: string): string {
    return `${index}-${String(evidence || '').slice(0, 80)}`;
  }
  // --- CÁC HÀM TIỆN ÍCH HIỂN THỊ HTML ---
  getTotalQuantity(order: any): number {
    const items = this.isReturningOrder(order) ? this.getReturningItems(order) : (order.Items || []);
    return items.reduce((sum: number, item: any) => sum + this.getDisplayItemQuantity(order, item), 0);
  }

  getTotal(order: any): number {
    const items = this.isReturningOrder(order) ? this.getReturningItems(order) : (order.Items || []);
    return items.reduce((sum: number, item: any) => sum + this.getDisplayItemLineTotal(order, item), 0);
  }

  formatPrice(price: number): string {
    return new Intl.NumberFormat('vi-VN').format(price) + ' đ';
  }

  getStatusLabel(order: any): string {
    const status = this.normalizeStatus(order.Status);

    if (status === 'review' || status === 'delivered') {
      return this.isReviewedOrder(order) ? 'Đã được đánh giá' : 'Chưa đánh giá';
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
    if (this.normalizeReviewStatus(order?.Review_status) === 'reviewed') {
      return true;
    }

    const items: any[] = Array.isArray(order?.Items) ? order.Items : [];
  return items.length > 0 && items.every((item: any) => this.isReviewedOrderItem(item));
  }

  isCancelledOrder(order: any): boolean {
    return this.normalizeStatus(order.Status) === 'cancelled';
  }
  
  isReturningOrder(order: any): boolean {
    return this.normalizeStatus(order?.Status) === 'returning';
  }

  getVisibleItems(order: any): any[] {
    const items = this.getOrderDisplayItems(order);
    if (this.isExpanded(order)) return items;
    return items.slice(0, this.productPreviewLimit);
  }

  getHiddenItemCount(order: any): number {
    return Math.max(this.getOrderDisplayItems(order).length - this.productPreviewLimit, 0);
  }

  getOrderDisplayItems(order: any): any[] {
    return this.isReturningOrder(order) ? this.getReturningItems(order) : (Array.isArray(order?.Items) ? order.Items : []);
  }

  getReturningItems(order: any): any[] {
    const items = Array.isArray(order?.Items) ? order.Items : [];
    const returnedItems = items.filter((item: any) => item?.Is_returned_item || Number(item?.Return_quantity || 0) > 0);
    return returnedItems.length ? returnedItems : items;
  }

  getDisplayItemQuantity(order: any, item: any): number {
    if (this.isReturningOrder(order)) {
      return Math.max(1, Number(item?.Return_quantity || item?.Quantity || 1) || 1);
    }

    return Math.max(1, Number(item?.Quantity || 1) || 1);
  }

  getDisplayItemLineTotal(order: any, item: any): number {
    return (Number(item?.Price || 0) || 0) * this.getDisplayItemQuantity(order, item);
  }

  getReturnProductSubtotal(order: any): number {
    return this.getReturningItems(order).reduce((sum: number, item: any) => {
      return sum + this.getDisplayItemLineTotal(order, item);
    }, 0);
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
            ? this.getCancelReason(order)
            : this.getReturnTimelineDescription(order),
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
        title: this.isReviewedOrder(order) ? 'Đã được đánh giá' : 'Hoàn tất đơn hàng',
        description:
          this.isReviewedOrder(order)
            ? 'Đơn hàng đã hoàn tất và đã được đánh giá.'
            : (status === 'delivered' || status === 'review')
              ? 'Đơn hàng đã hoàn tất. Bạn có thể đánh giá sản phẩm hoặc yêu cầu hoàn hàng.'
              : 'Bạn có thể đánh giá hoặc yêu cầu trả hàng sau khi nhận hàng.',
      },
    ];

    return steps.map((step, index) => ({
      ...step,
      active: index <= currentIndex,
    }));
  }

  openOrderDetail(order: any): void { this.selectedOrder = order; }
  closeOrderDetail(): void { this.selectedOrder = null; }

  canCancelOrder(order: any): boolean {
    return ['pending_payment', 'processing'].includes(this.normalizeStatus(order?.Status));
  }

  getCancelReason(order: any): string {
    return String(order?.Cancel_reason || order?.CancelReason || order?.cancelReason || '').trim()
      || 'Không có lý do hủy.';
  }

  getReturnTimelineDescription(order: any): string {
    const reason = String(order?.Return_reason || '').trim();
    const statusLabel = this.getReturnStatusLabel(order);

    if (reason) {
      return 'Lý do hoàn trả: ' + reason + '. Trạng thái xử lý: ' + statusLabel + '.';
    }

    return 'VISTA đang xử lý yêu cầu hoàn trả cho đơn hàng này.';
  }

  getReturnStatusLabel(order: any): string {
    const status = String(order?.Return_status || 'pending').trim().toLowerCase();

    if (status === 'approved') {
      return 'Đã duyệt yêu cầu';
    }

    if (status === 'rejected') {
      return 'Từ chối hoàn trả';
    }

    if (status === 'completed' || status === 'refunded') {
      return 'Đã hoàn tiền';
    }

    return 'Đang xử lý';
  }

  getReturnEvidence(order: any): string[] {
    return Array.isArray(order?.Return_evidence_images) ? order.Return_evidence_images : [];
  }

  getReturnDescription(order: any): string {
    const rawDescription = String(order?.Return_description || '').trim();
    return rawDescription || 'Không có mô tả thêm.';
  }

  getReturnReason(order: any): string {
    const directReason = String(order?.Return_reason || '').trim();
    if (directReason) {
      return directReason;
    }

    const description = String(order?.Return_description || '').trim();
    const reasonMatch = description.match(/Lý do hoàn trả:\s*([\s\S]*?)(?:\s*Mô tả:|$)/i);
    return reasonMatch?.[1]?.trim() || 'Chưa có lý do hoàn trả.';
  }

  getReturnRequestCode(order: any): string {
    const requests = Array.isArray(order?.Return_requests) ? order.Return_requests : [];
    return String(order?.Return_order_id || requests[0]?.Return_order_id || '').trim();
  }

  getReturnPickupDate(order: any): any {
    return order?.Return_created_at || order?.Created_at || null;
  }

  getReturnTrackingNumber(order: any): string {
    const existingTracking = String(order?.Return_tracking_number || '').trim();
    if (existingTracking) {
      return existingTracking;
    }

    const codeTail = String(order?.Order_code || order?.Order_id || Date.now())
      .replace(/[^a-zA-Z0-9]/g, '')
      .slice(-9)
      .toUpperCase();

    return 'SPXRTN' + (codeTail || Date.now().toString().slice(-9));
  }

  getReturnRefundAmount(order: any): number {
    return Number(order?.Return_refund_amount || 0) || this.getTotal(order);
  }

  getReturnName(order: any): string {
    return String(order?.Return_name || order?.Receiver_name || order?.Customer_name || '').trim() || 'Chưa có thông tin';
  }

  getReturnPhone(order: any): string {
    return String(order?.Return_phone || order?.Receiver_phone || order?.Phone_number || '').trim() || 'Chưa có thông tin';
  }

  getReturnEmail(order: any): string {
    return String(order?.Return_email || order?.Email || '').trim() || 'Chưa có thông tin';
  }

  getReturnAddress(order: any): string {
    return String(order?.Return_address || order?.Address || '').trim() || 'Chưa có thông tin';
  }

  // 1. Các hàm bổ trợ về Bằng chứng hoàn hàng (Đã fix đóng ngoặc)
  isReturnEvidenceImage(evidence: string): boolean {
    const value = String(evidence || '').trim();
    return value.startsWith('data:image/') || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(value);
  }

  isReturnEvidenceVideo(evidence: string): boolean {
    const value = String(evidence || '').trim();
    return value.startsWith('data:video/') || /\.(mp4|webm|mov|avi|mkv)$/i.test(value);
  }

  getReturnEvidenceLabel(evidence: string, index: number): string {
    const value = String(evidence || '').trim();
    if (!value.startsWith('data:')) {
      return value || `Bằng chứng ${index + 1}`;
    }

    const mime = value.slice(5, value.indexOf(';'));
    return `${mime || 'Tệp đính kèm'} ${index + 1}`;
  }

  // 2. Các hàm kiểm soát Modal hủy đơn hàng từ file main của bạn
  openCancelOrderModal(order: any): void {
    if (!this.canCancelOrder(order)) {
      this.notificationService.info('Đơn hàng này không thể hủy.');
      return;
    }

    this.cancelOrderTarget = order;
    this.cancelReason = this.cancelReasons[0];
    this.cancelError = '';
    this.isCancelModalOpen = true;
  }

  closeCancelOrderModal(): void {
    if (this.isCancellingOrder) {
      return;
    }

    this.isCancelModalOpen = false;
    this.cancelOrderTarget = null;
    this.cancelReason = '';
    this.cancelError = '';
  }

  confirmCancelOrder(): void {
    const orderId = String(this.cancelOrderTarget?.Order_code || this.cancelOrderTarget?.Order_id || '').trim();
    const reason = this.cancelReason.trim();

    if (!orderId) {
      this.cancelError = 'Không tìm thấy mã đơn hàng.';
      return;
    }

    if (!reason) {
      this.cancelError = 'Vui lòng chọn lý do hủy đơn hàng.';
      return;
    }

    this.isCancellingOrder = true;
    this.cancelError = '';

    this.orderHistoryService.cancelOrder(orderId, reason).subscribe({
      next: (res) => {
        this.isCancellingOrder = false;

        if (!res.success) {
          this.cancelError = res.message || 'Không thể hủy đơn hàng.';
          this.cdr.detectChanges();
          return;
        }

        const cancelledAt = new Date().toISOString();
        this.orders = this.orders.map((order) =>
          order.Order_code === orderId
            ? { ...order, Status: 'cancelled', Cancel_reason: reason, Cancelled_at: cancelledAt }
            : order
        );

        if (this.selectedOrder?.Order_code === orderId) {
          this.selectedOrder = {
            ...this.selectedOrder,
            Status: 'cancelled',
            Cancel_reason: reason,
            Cancelled_at: cancelledAt,
          };
        }

        this.closeCancelOrderModal();
        this.selectedStatus = 'cancelled';
        this.currentPage = 1;
        this.applyFilters();
        this.notificationService.success(res.message || 'Đã hủy đơn hàng thành công.');
        this.loadOrders();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isCancellingOrder = false;
        this.cancelError = err?.error?.message || 'Không thể hủy đơn hàng. Vui lòng thử lại sau.';
        this.cdr.detectChanges();
      },
    });
  }

  // 3. Các hàm Handler thật kết nối trực tiếp với sự kiện click trên giao diện HTML
  handleCancelOrder(order: any): void {
    this.openCancelOrderModal(order);
  }

  handleReturnOrder(order: any): void {
    if (!this.isReviewOrder(order)) {
      this.notificationService.info('Chỉ đơn hàng đã giao mới có thể yêu cầu hoàn hàng.');
      return;
    }

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('vista_return_order_data', JSON.stringify(order));
    }

    this.router.navigate(['/return-order'], {
      queryParams: { orderId: order.Order_code },
      state: { order },
    });
  }

  handleReviewNow(order: any): void {
    if (!this.isReviewOrder(order)) {
      this.notificationService.info('Chỉ đơn hàng đã giao mới có thể đánh giá sản phẩm.');
      return;
    }

    if (this.isReviewedOrder(order)) {
      this.notificationService.info('Đơn hàng này đã được đánh giá.');
      return;
    }

    const items = Array.isArray(order?.Items) ? order.Items : [];
    const reviewItem = items.find((item: any) => {
      return !this.isReviewedOrderItem(item) && !!this.getReviewOrderDetailId(item);
    }) || items.find((item: any) => !!this.getReviewOrderDetailId(item));

    if (!reviewItem) {
      this.notificationService.error('Không tìm thấy mã chi tiết đơn hàng để mở trang đánh giá.');
      return;
    }

    const orderDetailId = this.getReviewOrderDetailId(reviewItem);

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('vista_review_order_data', JSON.stringify(order));
    }

    this.router.navigate(['/review'], {
      queryParams: {
        orderId: order.Order_code,
        orderDetailId,
      },
      state: {
        order,
        item: reviewItem,
      },
    });
  }

  private getReviewOrderDetailId(item: any): string {
    return String(
      item?.Order_detail_id ||
      item?.OrderDetail_id ||
      item?.orderDetailId ||
      ''
    ).trim();
  }

  private isReviewedOrderItem(item: any): boolean {
    const reviewId = String(item?.Review_id || '').trim();
    const reviewStatus = String(item?.Review_status || '').trim().toLowerCase();
    return !!reviewId || reviewStatus === 'reviewed' || item?.Reviewed === true;
  }

  async handleBuyAgain(order: any): Promise<void> {
    const checkoutItems = (Array.isArray(order?.Items) ? order.Items : [])
      .map((item: any) => this.buildBuyAgainCheckoutItem(item))
      .filter((item: any) => !!item?.productVariantId);

    if (checkoutItems.length === 0) {
      Swal.fire({
        icon: 'error',
        title: 'Không có sản phẩm hợp lệ để mua lại',
        text: 'Không thể lấy dữ liệu sản phẩm từ đơn hàng này.',
        confirmButtonColor: '#2563B0',
      });
      return;
    }

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('vista_checkout_items', JSON.stringify(checkoutItems));
      sessionStorage.setItem('vista_checkout_source', JSON.stringify({ type: 'repurchase' }));
      sessionStorage.setItem('vista_repurchase_order_prefill', JSON.stringify({
        receiver: {
          fullName: order.Receiver_name || order.Customer_name || '',
          phone: order.Receiver_phone || order.Phone_number || '',
          email: order.Email || '',
          province: order.Province || '',
          district: order.District || '',
          ward: order.Ward || '',
          specificAddress: order.Specific_address || '',
        },
        paymentId: this.normalizePaymentType(order.Payment_type) === 'cod' ? 'cod' : 'bank_transfer',
        shippingId: this.resolveShippingIdForBuyAgain(order),
        orderNotes: order.Order_notes || '',
      }));
    }

    await this.router.navigate(['/order']);
  }

  private buildBuyAgainCheckoutItem(item: any): any {
    const productVariantId = String(item.Product_variant_id || item.productVariantId || '').trim();
    const variantName = item.Variant_name || item.variantName || 'Tiêu chuẩn';
    const price = Number(item.Price || item.price || 0);
    const originalPrice = Number(item.Original_price || item.originalPrice || price);
    const discountPercent = Number(item.Discount_percent || item.discountPercent || 0);
    const quantity = Math.max(1, Number(item.Quantity || item.quantity || 1));
    const stock = Math.max(quantity, Number(item.Stock_quantity || item.stock || quantity));

    return {
      cartItemId: '',
      productVariantId,
      productId: item.Product_id || item.productId || null,
      name: item.Product_name || item.productName || 'Sản phẩm VISTA',
      variantName,
      specs: variantName,
      selectedVariantId: productVariantId,
      variantOptions: [
        { productVariantId, variantName, price, originalPrice, discountPercent, stock },
      ],
      image: item.Image || item.image || '/assets/images/default-product.png',
      price,
      originalPrice,
      discountPercent,
      quantity,
      stock,
      categoryId: item.Category_id || item.categoryId || '',
      categoryName: item.Category_name || item.categoryName || '',
      categorySlug: item.Category_slug || item.categorySlug || '',
      checkoutSource: 'repurchase',
    };
  }

  private resolveShippingIdForBuyAgain(order: any): string {
    const partner = String(order?.Shipping_partner || '').toLowerCase();

    if (partner.includes('ghn') || partner.includes('giao hàng nhanh')) {
      return 'ghn';
    }

    if (partner.includes('j&t') || partner.includes('jnt')) {
      return 'jnt';
    }

    return 'spx';
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
          this.authService.reloadUserProfile();
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

    if (value === false || value === null || value === undefined) {
      return 'not_reviewed';
    }

    const normalized = String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/_/g, ' ');

    if (['reviewed', 'da danh gia', 'da duoc danh gia', 'true'].includes(normalized)) {
      return 'reviewed';
    }

    if (['not reviewed', 'unreviewed', 'chua danh gia', 'chua duoc danh gia', 'pending', 'false', ''].includes(normalized)) {
      return 'not_reviewed';
    }

    return 'not_reviewed';
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
        return Math.max(0, this.processingAutoShipMs - (Date.now() - startTime));
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