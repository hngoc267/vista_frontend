import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface DashboardMetricDelta {
  value: number | null;
  prevValue: number | null;
  diff: number | null;
  percent: number | null;
  hasComparison: boolean;
  tooltip: string;
}

export interface ProfitMetricDelta extends DashboardMetricDelta {
  trackedValue?: number | null;
  trackedPrevValue?: number | null;
  coverageStatus?: 'zero' | 'partial' | 'complete';
  status?: string;
}

export interface SummaryCardsData {
  netRevenue: DashboardMetricDelta;
  completedOrders: DashboardMetricDelta;
  aov: DashboardMetricDelta;
  deliverySuccessRate: DashboardMetricDelta & {
    deliveredCount: number;
    failedCount: number;
  };
  periodInfo: {
    currentStart: string;
    currentEnd: string;
    previousStart: string;
    previousEnd: string;
  };
}

export interface RevenueTrendPoint {
  label: string;
  key: string;
  netRevenue: number;
  prevNetRevenue: number;
}

export interface RevenueTrendData {
  step: 'day' | 'week' | 'month';
  points: RevenueTrendPoint[];
  totalNetRevenue: number;
  prevTotalNetRevenue: number;
}

export interface CategoryCostItem {
  categoryId: string;
  categoryName: string;
  cogs: number;
  prevCogs: number;
  revenue: number;
  costShare: number;
  diffPercent: number | null;
  itemCount?: number;
}

export interface ProfitSummaryData {
  netRevenue: DashboardMetricDelta;
  cogs: DashboardMetricDelta & { status?: string };
  grossProfit: ProfitMetricDelta;
  grossMargin: ProfitMetricDelta;
  costCoverage: {
    ratio: number;
    coverageStatus?: 'zero' | 'partial' | 'complete';
    trackedRevenue: number;
    totalRevenue: number;
    trackedItems: number;
    totalItems: number;
    isComplete: boolean;
    warning: string | null;
  };
  categoryBreakdown?: CategoryCostItem[];
  periodInfo: {
    currentStart: string;
    currentEnd: string;
    previousStart: string;
    previousEnd: string;
  };
}

export interface ProfitTrendPoint {
  label: string;
  key: string;
  netRevenue: number;
  cogs: number;
  grossProfit: number | null;
  grossMargin: number | null;
  trackedGrossProfit?: number | null;
  trackedGrossMargin?: number | null;
  costCoverage?: number;
}

export interface ProfitTrendData {
  step: 'day' | 'week' | 'month';
  points: ProfitTrendPoint[];
  totalNetRevenue: number;
  totalCogs: number;
  totalGrossProfit: number | null;
  overallGrossMargin: number | null;
  totalTrackedGrossProfit?: number | null;
  overallTrackedGrossMargin?: number | null;
  overallCostCoverage: number;
}

export interface PipelineItem {
  key: string;
  label: string;
  count: number;
  color: string;
  percentage: number;
}

export interface OrderPipelineData {
  total: number;
  pipeline: PipelineItem[];
}

export interface PaymentStatusItem {
  key: string;
  label: string;
  count: number;
  amount: number;
  color: string;
  percentage: number;
}

export interface PaymentMethodItem {
  method: string;
  total: number;
  paid: number;
  pending: number;
  failed: number;
  refunded: number;
  paidAmount: number;
  successRate: number;
}

export interface PaymentBreakdownData {
  totalPayments: number;
  byStatus: PaymentStatusItem[];
  byMethod: PaymentMethodItem[];
  overallSuccessRate: number;
  onlineFlow?: {
    total: number;
    paid: number;
    failed: number;
    pending: number;
    refunded: number;
    successRate: number;
    tooltip: string;
  };
  codFlow?: {
    total: number;
    paid: number;
    pending: number;
    failed: number;
    successRate: number;
    tooltip: string;
  };
}

export interface CarrierItem {
  partner: string;
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  successRate: number;
}

export interface CarrierPerformanceData {
  totalDeliveries: number;
  partners: CarrierItem[];
  overallRate: number;
}

export interface OperationalAlert {
  id: string;
  level: 'critical' | 'warning' | 'info';
  title: string;
  message: string;
  count: number;
  sampleIds: string[];
  link: string;
  actionText: string;
}

export interface AdminApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly apiUrl = `${environment.apiUrl}/admin/dashboard`;

  constructor(private http: HttpClient) {}

  private withAuth<T>(request: (headers: HttpHeaders) => Observable<T>): Observable<T> {
    const token = localStorage.getItem('vista_admin_token');
    if (!token) {
      return throwError(() => new Error('Vui lòng đăng nhập lại để tiếp tục.'));
    }
    return request(new HttpHeaders({ Authorization: `Bearer ${token}` }));
  }

  private buildParams(period: string, from?: string, to?: string): HttpParams {
    let params = new HttpParams().set('period', period);
    if (from) params = params.set('from', from);
    if (to) params = params.set('to', to);
    return params;
  }

  getSummaryCards(period: string, from?: string, to?: string): Observable<AdminApiResponse<SummaryCardsData>> {
    return this.withAuth((headers) =>
      this.http.get<AdminApiResponse<SummaryCardsData>>(`${this.apiUrl}/summary-cards`, {
        headers,
        params: this.buildParams(period, from, to),
      })
    );
  }

  getRevenueTrend(period: string, from?: string, to?: string): Observable<AdminApiResponse<RevenueTrendData>> {
    return this.withAuth((headers) =>
      this.http.get<AdminApiResponse<RevenueTrendData>>(`${this.apiUrl}/revenue-trend`, {
        headers,
        params: this.buildParams(period, from, to),
      })
    );
  }

  getOrderPipeline(period: string, from?: string, to?: string): Observable<AdminApiResponse<OrderPipelineData>> {
    return this.withAuth((headers) =>
      this.http.get<AdminApiResponse<OrderPipelineData>>(`${this.apiUrl}/order-pipeline`, {
        headers,
        params: this.buildParams(period, from, to),
      })
    );
  }

  getPaymentBreakdown(period: string, from?: string, to?: string): Observable<AdminApiResponse<PaymentBreakdownData>> {
    return this.withAuth((headers) =>
      this.http.get<AdminApiResponse<PaymentBreakdownData>>(`${this.apiUrl}/payment-breakdown`, {
        headers,
        params: this.buildParams(period, from, to),
      })
    );
  }

  getCarrierPerformance(period: string, from?: string, to?: string): Observable<AdminApiResponse<CarrierPerformanceData>> {
    return this.withAuth((headers) =>
      this.http.get<AdminApiResponse<CarrierPerformanceData>>(`${this.apiUrl}/carrier-performance`, {
        headers,
        params: this.buildParams(period, from, to),
      })
    );
  }

  getOperationalAlerts(): Observable<AdminApiResponse<OperationalAlert[]>> {
    return this.withAuth((headers) =>
      this.http.get<AdminApiResponse<OperationalAlert[]>>(`${this.apiUrl}/operational-alerts`, { headers })
    );
  }

  getProfitSummary(period: string, from?: string, to?: string): Observable<AdminApiResponse<ProfitSummaryData>> {
    return this.withAuth((headers) =>
      this.http.get<AdminApiResponse<ProfitSummaryData>>(`${this.apiUrl}/profit-summary`, {
        headers,
        params: this.buildParams(period, from, to),
      })
    );
  }

  getProfitTrend(period: string, from?: string, to?: string): Observable<AdminApiResponse<ProfitTrendData>> {
    return this.withAuth((headers) =>
      this.http.get<AdminApiResponse<ProfitTrendData>>(`${this.apiUrl}/profit-trend`, {
        headers,
        params: this.buildParams(period, from, to),
      })
    );
  }
}
