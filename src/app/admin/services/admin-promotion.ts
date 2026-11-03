import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export type PromotionStatus = 'draft' | 'upcoming' | 'active' | 'paused' | 'expired' | 'out_of_quota';
export type PromotionType = 'percent' | 'fixed_amount' | 'free_shipping';
export type PromotionScope = 'all_products' | 'specific_categories';

export interface PromotionAnalytics {
  totalDiscountAmount?: number;
  recentOrders?: Array<{
    Order_id: string;
    Total_amount: number;
    Voucher_discount_amount: number;
    Voucher_shipping_discount: number;
    Created_at: string;
    Status: string;
  }>;
}

export interface AdminPromotion {
  id: string;
  code: string;
  title: string;
  description: string;
  type: PromotionType;
  discountValue: number;
  maxDiscountAmount?: number;
  minOrderValue: number;
  usageLimit: number;
  usedCount: number;
  usageLimitPerCustomer: number;
  scope: PromotionScope;
  applicableCategories?: string[];
  startDate: string;
  endDate: string;
  status: PromotionStatus;
  statusLabel?: string;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
  analytics?: PromotionAnalytics;
}

export interface PromotionStats {
  total: number;
  active: number;
  upcoming: number;
  expired: number;
  paused: number;
  draft: number;
}

export interface PromotionFilters {
  keyword?: string;
  status?: string;
  type?: string;
  dateFilter?: string;
  page?: number;
  limit?: number;
}

export interface PromotionListResponse {
  success: boolean;
  data: {
    items: AdminPromotion[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    stats: PromotionStats;
  };
}

export interface PromotionDetailResponse {
  success: boolean;
  data: AdminPromotion;
}

export interface PromotionActionResponse {
  success: boolean;
  message: string;
  data?: Partial<AdminPromotion>;
}

@Injectable({
  providedIn: 'root'
})
export class AdminPromotionService {
  private readonly apiUrl = `${environment.apiUrl}/admin/promotions`;

  constructor(private http: HttpClient) {}

  getPromotions(filters: PromotionFilters = {}): Observable<PromotionListResponse> {
    let params = new HttpParams();

    if (filters.keyword?.trim()) {
      params = params.set('keyword', filters.keyword.trim());
    }
    if (filters.status && filters.status !== 'all') {
      params = params.set('status', filters.status);
    }
    if (filters.type && filters.type !== 'all') {
      params = params.set('type', filters.type);
    }
    if (filters.page) {
      params = params.set('page', String(filters.page));
    }
    if (filters.limit) {
      params = params.set('limit', String(filters.limit));
    }

    return this.withAuth((headers) =>
      this.http.get<PromotionListResponse>(this.apiUrl, { headers, params })
    );
  }

  getPromotionById(id: string): Observable<PromotionDetailResponse> {
    return this.withAuth((headers) =>
      this.http.get<PromotionDetailResponse>(`${this.apiUrl}/${encodeURIComponent(id)}`, { headers })
    );
  }

  createPromotion(payload: {
    code: string;
    title: string;
    description: string;
    type: PromotionType;
    discountValue: number;
    maxDiscountAmount?: number;
    minOrderValue: number;
    usageLimit: number;
    usageLimitPerCustomer: number;
    scope: PromotionScope;
    applicableCategories: string[];
    startDate: string;
    endDate: string;
    status: PromotionStatus;
  }): Observable<PromotionActionResponse> {
    return this.withAuth((headers) =>
      this.http.post<PromotionActionResponse>(this.apiUrl, payload, { headers })
    );
  }

  updatePromotion(
    id: string,
    payload: Partial<{
      code: string;
      title: string;
      description: string;
      type: PromotionType;
      discountValue: number;
      maxDiscountAmount?: number;
      minOrderValue: number;
      usageLimit: number;
      usageLimitPerCustomer: number;
      scope: PromotionScope;
      applicableCategories: string[];
      startDate: string;
      endDate: string;
      status: PromotionStatus;
    }>
  ): Observable<PromotionActionResponse> {
    return this.withAuth((headers) =>
      this.http.put<PromotionActionResponse>(`${this.apiUrl}/${encodeURIComponent(id)}`, payload, {
        headers
      })
    );
  }

  changeStatus(id: string, newStatus: PromotionStatus): Observable<PromotionActionResponse> {
    return this.withAuth((headers) =>
      this.http.patch<PromotionActionResponse>(
        `${this.apiUrl}/${encodeURIComponent(id)}/status`,
        { status: newStatus },
        { headers }
      )
    );
  }

  deletePromotion(id: string): Observable<PromotionActionResponse> {
    return this.withAuth((headers) =>
      this.http.delete<PromotionActionResponse>(`${this.apiUrl}/${encodeURIComponent(id)}`, {
        headers
      })
    );
  }

  private withAuth<T>(request: (headers: HttpHeaders) => Observable<T>): Observable<T> {
    const token = localStorage.getItem('vista_admin_token');
    if (!token) {
      return throwError(
        () => new Error('Phiên làm việc đã hết hạn hoặc chưa đăng nhập. Vui lòng đăng nhập lại.')
      );
    }

    return request(new HttpHeaders({ Authorization: `Bearer ${token}` }));
  }
}
