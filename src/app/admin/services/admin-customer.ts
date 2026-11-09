import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export type CustomerStatus = 'active' | 'blocked';

export interface AdminCustomerItem {
  User_id: string;
  Username: string;
  Full_name: string;
  Email: string;
  Phone_number: string;
  Status: CustomerStatus;
  Created_at: string;
  order_count?: number;
  total_spent?: number;
}

export interface AdminCustomerOrderDetail {
  Order_id: string;
  Total_amount: number;
  Status: string;
  Created_at: string;
  Payment_type: string;
  Payment_status: string;
  item_count: number;
}

export interface AdminCustomerReviewItem {
  Review_id: string;
  Order_id: string;
  Product_name: string;
  Variant_name: string;
  Product_image?: string;
  Rating: number;
  Comment: string;
  Images?: string[];
  Moderation_status: 'pending' | 'approved' | 'rejected';
  Reply_content?: string;
  Replied_at?: string;
  Created_at: string;
}

export interface AdminCustomerReturnItem {
  Return_order_id: string;
  Order_id: string;
  Product_name: string;
  Variant_name: string;
  Product_image?: string;
  Return_quantity: number;
  Reason_type: string;
  Reason_codes?: string[];
  Description?: string;
  Evidence_images?: string[];
  Refund_amount: number;
  Status: string;
  Created_at: string;
}

export interface AdminCustomerStats {
  total: number;
  active: number;
  blocked: number;
}

export interface AdminCustomerFilters {
  keyword?: string;
  status?: string;
  page?: number;
  limit?: number;
}

export interface AdminCustomerListResponse {
  success: boolean;
  items: AdminCustomerItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  stats: AdminCustomerStats;
  message?: string;
}

export interface AdminCustomerAddress {
  Address_id: string;
  Receiver_name: string;
  Receiver_phone: string;
  Email: string;
  Province: string;
  District: string;
  Ward: string;
  Specific_address: string;
  Is_default: boolean;
}

export interface AdminCustomerOrderStats {
  total: number;
  completed: number;
  processing: number;
  cancelled: number;
  totalSpent: number;
}

export interface AdminCustomerDetailResponse {
  success: boolean;
  customer: AdminCustomerItem;
  addresses: AdminCustomerAddress[];
  orderStats: AdminCustomerOrderStats;
  orders?: AdminCustomerOrderDetail[];
  reviews?: AdminCustomerReviewItem[];
  returns?: AdminCustomerReturnItem[];
  message?: string;
}

export interface AdminCustomerActionResponse {
  success: boolean;
  message: string;
  customer: AdminCustomerItem;
}

@Injectable({ providedIn: 'root' })
export class AdminCustomerService {
  private readonly apiUrl = `${environment.apiUrl}/admin/customers`;

  constructor(private http: HttpClient) {}

  getCustomers(filters: AdminCustomerFilters): Observable<AdminCustomerListResponse> {
    let params = new HttpParams();
    if (filters.keyword && filters.keyword.trim()) {
      params = params.set('keyword', filters.keyword.trim());
    }
    if (filters.status && filters.status.trim()) {
      params = params.set('status', filters.status.trim());
    }
    if (filters.page && filters.page > 0) {
      params = params.set('page', String(filters.page));
    }
    if (filters.limit && filters.limit > 0) {
      params = params.set('limit', String(filters.limit));
    }

    return this.withAuth((headers) =>
      this.http.get<AdminCustomerListResponse>(this.apiUrl, { headers, params })
    );
  }

  getCustomerDetail(userId: string): Observable<AdminCustomerDetailResponse> {
    const cleanId = encodeURIComponent(userId.trim());
    return this.withAuth((headers) =>
      this.http.get<AdminCustomerDetailResponse>(`${this.apiUrl}/${cleanId}`, { headers })
    );
  }

  lockCustomer(userId: string): Observable<AdminCustomerActionResponse> {
    const cleanId = encodeURIComponent(userId.trim());
    return this.withAuth((headers) =>
      this.http.patch<AdminCustomerActionResponse>(`${this.apiUrl}/${cleanId}/lock`, {}, { headers })
    );
  }

  unlockCustomer(userId: string): Observable<AdminCustomerActionResponse> {
    const cleanId = encodeURIComponent(userId.trim());
    return this.withAuth((headers) =>
      this.http.patch<AdminCustomerActionResponse>(`${this.apiUrl}/${cleanId}/unlock`, {}, { headers })
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

