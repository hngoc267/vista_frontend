import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
// Nhớ chỉnh lại đường dẫn service cho khớp với thư mục của bạn
import { OrderHistoryService } from '../../services/order-history';

@Component({
  selector: 'app-order-history',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './order-history.html',
  styleUrls: ['./order-history.scss']
})
export class OrderHistory implements OnInit {
  orders: any[] = [];
  filteredOrders: any[] = [];
  paginatedOrders: any[] = [];

  searchKeyword: string = '';
  selectedStatus: string = 'all';

  currentPage: number = 1;
  pageSize: number = 5;
  totalPages: number = 1;
  pageNumbers: number[] = [];
  productPreviewLimit: number = 3;
  expandedOrders: Set<string> = new Set();
  selectedOrder: any = null;

  tabs = [
    { label: 'Tất cả', value: 'all' },
    { label: 'Chờ thanh toán', value: 'pending_payment' },
    { label: 'Đang xử lý', value: 'processing' },
    { label: 'Đang giao', value: 'shipping' },
    { label: 'Đánh giá', value: 'review' },
    { label: 'Đã hủy', value: 'cancelled' }
  ];

  constructor(
    private orderHistoryService: OrderHistoryService,
    private cdr: ChangeDetectorRef // Tiêm công cụ ép vẽ lại giao diện
  ) {}

  ngOnInit() {
    this.loadOrders();
  }

  loadOrders() {
    this.orderHistoryService.getOrderHistory('all').subscribe({
      next: (res) => {
        if (res.success) {
          this.orders = res.data || [];
          this.applyFilters();
          
          // LỆNH QUAN TRỌNG: Ép Angular vẽ lại danh sách ngay lập tức!
          this.cdr.detectChanges(); 
        }
      },
      error: (err) => {
        console.error('Lỗi tải đơn hàng', err);
        this.orders = [];
        this.applyFilters();
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
      temp = temp.filter(o => o.Status === this.selectedStatus);
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
    const tab = this.tabs.find(t => t.value === order.Status);
    return tab ? tab.label : 'Không xác định';
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

  // --- NÚT BẤM VÀ MODAL ---
  openOrderDetail(order: any): void { this.selectedOrder = order; }
  closeOrderDetail(): void { this.selectedOrder = null; }

  payOrder(order: any): void { alert('Chuyển đến trang thanh toán cho đơn: ' + order.Order_code); }
  cancelOrder(order: any): void { alert('Hủy đơn hàng: ' + order.Order_code); }
  returnOrder(order: any): void { alert('Yêu cầu trả hàng đơn: ' + order.Order_code); }
  buyAgain(order: any): void { alert('Thêm các sản phẩm của đơn ' + order.Order_code + ' vào giỏ'); }
  reviewNow(order: any): void { alert('Mở trang đánh giá đơn: ' + order.Order_code); }
  viewReview(order: any): void { alert('Xem đánh giá đơn: ' + order.Order_code); }
}