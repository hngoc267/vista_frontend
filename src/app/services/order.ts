import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface AddressItem {
  Address_id: string;
  User_id: string;
  Receiver_name: string;
  Receiver_phone: string;
  Province: string;
  District: string;
  Ward: string;
  Specific_address: string;
  Is_default: boolean;
  Email?: string;
}

export interface VietnamWard {
  code: number;
  name: string;
}

export interface VietnamDistrict {
  code: number;
  name: string;
  wards: VietnamWard[];
}

export interface VietnamProvince {
  code: number;
  name: string;
  districts: VietnamDistrict[];
}

export interface VoucherItem {
  code?: string;
  title?: string;
  condition?: string;
  type?: 'percent' | 'shipping' | 'fixed' | string;
  category?: string;
  status?: string;
  expiry?: string;
  daysLeft?: number | null;
  description?: string;
  benefits?: string[];
  conditions?: string[];
  minOrderValue?: number;
  maxDiscountAmount?: number;
  discountValue?: number;
  startDate?: string;
  endDate?: string;
  usageLimit?: string | number;
  statusText?: string;
  canApply?: boolean;
  unavailableReason?: string;
}

export interface VoucherListResponse {
  success: boolean;
  data: VoucherItem[];
}

export interface ApplyVoucherResponse {
  success: boolean;
  message?: string;
  data?: {
    voucherId?: string;
    code?: string;
    title?: string;
    discountAmount?: number;
    shippingDiscount?: number;
    minOrderValue?: number;
    maxDiscountAmount?: number;
  };
}

export interface CreateOrderPayload {
  order: {
    Order_id: string;
    User_id: string;
    Voucher_id: string | null;
    Voucher_code: string;
    Voucher_title: string;
    Voucher_discount_amount: number;
    Voucher_shipping_discount: number;
    Total_items_price: number;
    Discount_amount: number;
    Total_amount: number;
    Order_notes: string;
    Created_at: string;
  };
  orderDetails: {
    Order_detail_id: string;
    Product_variant_id: string;
    Order_id: string;
    Variant_name: string;
    Price: number;
    Original_price: number;
    Discount_percent: number;
    Quantity: number;
    Total_price: number;
  }[];
  address: AddressItem;
  delivery: {
    Delivery_id: string;
    Order_id: string;
    Shipping_partner: string;
    Tracking_number: string;
    Original_shipping_fee: number;
    Shipping_discount: number;
    Shipping_fee: number;
    Estimated_delivery_date: string;
    Status: 'pending' | 'shipping' | 'delivered' | 'failed';
  };
  payment: {
    Payment_id: string;
    Order_id: string;
    Payment_type: 'BankTransfer' | 'COD';
    Payment_status: 'pending' | 'paid' | 'failed';
    Amount: number;
    Transaction_code: string;
  };
  cartItemIds: string[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

@Injectable({
  providedIn: 'root',
})
export class OrderService {
  private readonly apiUrl = environment.apiUrl;
  private readonly provincesUrl = 'https://provinces.open-api.vn/api/?depth=3';

  constructor(private http: HttpClient) {}

  getVietnamLocations(): Observable<VietnamProvince[]> {
    return this.http.get<VietnamProvince[]>(this.provincesUrl);
  }

  getUserAddresses(userId: string): Observable<ApiResponse<AddressItem[]>> {
    return this.http.get<ApiResponse<AddressItem[]>>(
      `${this.apiUrl}/addresses/${encodeURIComponent(userId)}`
    );
  }

  getAvailableVouchers(userId = '', context?: {
    totalItemsPrice: number;
    shippingFee: number;
    totalQuantity: number;
    orderItems: {
      productVariantId: string;
      quantity: number;
      price: number;
    }[];
  }): Observable<VoucherListResponse> {
    const params = new URLSearchParams();

    if (userId) {
      params.set('userId', userId);
    }

    if (context) {
      params.set('totalItemsPrice', String(context.totalItemsPrice));
      params.set('shippingFee', String(context.shippingFee));
      params.set('totalQuantity', String(context.totalQuantity));
      params.set('orderItems', JSON.stringify(context.orderItems));
    }

    const query = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<VoucherListResponse>(`${this.apiUrl}/vouchers/my-vouchers${query}`);
  }

  applyVoucher(payload: {
    voucherCode: string;
    totalItemsPrice: number;
    shippingFee: number;
    totalQuantity: number;
    userId: string;
    orderItems: {
      productVariantId: string;
      quantity: number;
      price: number;
    }[];
  }): Observable<ApplyVoucherResponse> {
    return this.http.post<ApplyVoucherResponse>(`${this.apiUrl}/vouchers/apply`, payload);
  }

  createOrder(payload: CreateOrderPayload): Observable<ApiResponse<{ orderId: string }>> {
    return this.http.post<ApiResponse<{ orderId: string }>>(`${this.apiUrl}/orders`, payload);
  }

  checkPaymentStatus(paymentId: string): Observable<ApiResponse<{
    paymentStatus: 'pending' | 'paid' | 'failed';
    amount?: number;
    transactionCode?: string;
    paidAt?: string | null;
  }>> {
    return this.http.get<ApiResponse<{
      paymentStatus: 'pending' | 'paid' | 'failed';
      amount?: number;
      transactionCode?: string;
      paidAt?: string | null;
    }>>(
      `${this.apiUrl}/payments/${encodeURIComponent(paymentId)}/status`
    );
  }

  confirmBankTransferPayment(payload: {
    paymentId: string;
    amount: number;
    transferContent: string;
    transactionCode?: string;
  }): Observable<ApiResponse<{
    paymentStatus: 'pending' | 'paid' | 'failed';
    transactionCode?: string;
    paidAt?: string | null;
  }>> {
    return this.http.post<ApiResponse<{
      paymentStatus: 'pending' | 'paid' | 'failed';
      transactionCode?: string;
      paidAt?: string | null;
    }>>(
      `${this.apiUrl}/payments/${encodeURIComponent(payload.paymentId)}/confirm`,
      payload
    );
  }
}
