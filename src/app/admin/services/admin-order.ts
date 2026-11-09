import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export type OrderDisplayStatus =
  | 'pending_payment'
  | 'pending_confirmation'
  | 'processing'
  | 'shipping'
  | 'completed'
  | 'cancelled'
  | 'returning';

export type OrderAction =
  | 'confirm'
  | 'cancel'
  | 'hand_over'
  | 'print_label';

export interface AdminOrderSummary {
  Order_id: string;
  Customer_name: string;
  Created_at: string;
  Total_amount: number;
  Status: string;
  Display_status: OrderDisplayStatus;
  Payment_type: string;
  Payment_status: string;
  Delivery_status: string;
  Tracking_number: string;
  Available_actions: OrderAction[];
  /** Bước Staff đang phải làm và hạn xử lý (SLA) */
  Sla_stage: 'confirm' | 'hand_over' | null;
  Sla_deadline: string | null;
  Is_overdue: boolean;
}

export type BulkAction = 'confirm' | 'hand_over';

export interface CancelReason {
  code: string;
  label: string;
  requiresNote?: boolean;
}

export interface BulkUpdateResult {
  succeeded: string[];
  failed: { orderId: string; message: string }[];
}

export interface ShippingLabel {
  Order_id: string;
  Tracking_number: string;
  Shipping_partner: string;
  Receiver_name: string;
  Receiver_phone: string;
  Address: string;
  Payment_type: string;
  Payment_status: string;
  Total_amount: number;
}

export interface OrderStatusHistoryItem {
  From_status: string;
  To_status: string;
  Event: string;
  Actor_id: string;
  Actor_name: string;
  Note: string;
  Created_at: string | null;
  /** Mốc dựng lại từ dữ liệu cũ (đơn tạo trước khi có lịch sử trạng thái) */
  Is_inferred?: boolean;
}

export interface AdminOrderItem {
  Product_variant_id: string;
  Product_name: string;
  Variant_name: string;
  Image: string;
  Price: number;
  Quantity: number;
  Total_price: number;
}

export interface AdminOrderDetail extends AdminOrderSummary {
  Receiver_name: string;
  Receiver_phone: string;
  Email: string;
  Address: string;
  Order_notes: string;
  Voucher_code?: string;
  Total_items_price: number;
  Discount_amount: number;
  Shipping_fee: number;
  Cancel_reason: string;
  Shipping_partner: string;
  Tracking_number: string;
  Delivered_at: string | null;
  Status_history: OrderStatusHistoryItem[];
  Items: AdminOrderItem[];
}

export interface AdminOrderFilters {
  keyword?: string;
  status?: string;
  paymentType?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface AdminApiResponse<T = undefined> {
  success: boolean;
  message?: string;
  data?: T;
}

export interface AdminOrderListData {
  items: AdminOrderSummary[];
  total: number;
  page: number;
  limit: number;
  /** Số đơn theo từng tab: all, overdue, pending_confirmation, processing, ... */
  counts: Record<string, number>;
}

@Injectable({ providedIn: 'root' })
export class AdminOrderService {
  private readonly apiUrl = `${environment.apiUrl}/admin/orders`;

  constructor(private http: HttpClient) {}

  getOrders(filters: AdminOrderFilters): Observable<AdminApiResponse<AdminOrderListData>> {
    let params = new HttpParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });

    return this.withAuth((headers) =>
      this.http.get<AdminApiResponse<AdminOrderListData>>(this.apiUrl, { headers, params }),
    );
  }

  getOrderDetail(orderId: string): Observable<AdminApiResponse<AdminOrderDetail>> {
    return this.withAuth((headers) =>
      this.http.get<AdminApiResponse<AdminOrderDetail>>(`${this.apiUrl}/${orderId}`, { headers }),
    );
  }

  confirmOrder(orderId: string, note: string): Observable<AdminApiResponse> {
    return this.withAuth((headers) =>
      this.http.patch<AdminApiResponse>(`${this.apiUrl}/${orderId}/confirm`, { note }, { headers }),
    );
  }

  cancelOrder(orderId: string, reasonCode: string, note: string): Observable<AdminApiResponse> {
    return this.withAuth((headers) =>
      this.http.patch<AdminApiResponse>(`${this.apiUrl}/${orderId}/cancel`, { reasonCode, note }, { headers }),
    );
  }

  getCancelReasons(): Observable<AdminApiResponse<CancelReason[]>> {
    return this.withAuth((headers) =>
      this.http.get<AdminApiResponse<CancelReason[]>>(`${this.apiUrl}/cancel-reasons`, { headers }),
    );
  }

  bulkUpdate(action: BulkAction, orderIds: string[], note = ''): Observable<AdminApiResponse<BulkUpdateResult>> {
    return this.withAuth((headers) =>
      this.http.post<AdminApiResponse<BulkUpdateResult>>(`${this.apiUrl}/bulk`, { action, orderIds, note }, { headers }),
    );
  }

  getLabels(orderIds: string[]): Observable<AdminApiResponse<ShippingLabel[]>> {
    return this.withAuth((headers) =>
      this.http.post<AdminApiResponse<ShippingLabel[]>>(`${this.apiUrl}/labels`, { orderIds }, { headers }),
    );
  }

  handOverOrder(orderId: string, note: string): Observable<AdminApiResponse> {
    return this.withAuth((headers) =>
      this.http.patch<AdminApiResponse>(`${this.apiUrl}/${orderId}/hand-over`, { note }, { headers }),
    );
  }

  private withAuth<T>(request: (headers: HttpHeaders) => Observable<T>): Observable<T> {
    const token = localStorage.getItem('vista_admin_token');
    if (!token) {
      return throwError(() => new Error('Vui lòng đăng nhập lại để tiếp tục.'));
    }

    return request(new HttpHeaders({ Authorization: `Bearer ${token}` }));
  }
}
