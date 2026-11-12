import { ApplicationRef, ChangeDetectorRef, Component, NgZone, OnDestroy, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCalendarDays,
  lucideTrendingUp,
  lucideShoppingBag,
  lucidePackage,
  lucideUsers,
  lucideEye,
  lucideSearch,
  lucideMousePointerClick,
  lucideShoppingCart,
  lucideArrowUpRight,
  lucideArrowDownRight,
  lucideDownload,
  lucideChevronDown,
  lucideClock,
  lucideCircleCheck,
  lucideTruck,
  lucideCreditCard,
  lucideRefreshCw,
  lucideAlertTriangle,
  lucideAlertCircle,
  lucideInfo,
  lucideArrowRight,
  lucideHelpCircle,
  lucideSend,
  lucideX,
  lucideHistory
} from '@ng-icons/lucide';
import {
  AdminDashboardService,
  SummaryCardsData,
  RevenueTrendData,
  RevenueTrendPoint,
  OrderPipelineData,
  PaymentBreakdownData,
  CarrierPerformanceData,
  OperationalAlert,
  ProfitSummaryData,
  CategoryCostItem,
  ProfitTrendData,
  ProfitTrendPoint
} from '../../services/admin-dashboard';
import {
  AdminNotificationManagementService,
  DispatchAlertPayload,
  OperationalNotificationPriority,
  OperationalRecipientMode,
  OperationalEntityType,
  OperationalTargetEntity
} from '../../services/admin-notification-management';
import { AdminStaffService, AdminStaffMember } from '../../services/admin-staff';
import { AdminNotificationTrackingDrawerComponent } from '../../components/admin-notification-tracking-drawer/admin-notification-tracking-drawer';
import { getAdminRole } from '../../../guards/admin-guard';
import { Subscription, finalize, forkJoin } from 'rxjs';

export type RevenuePeriod = '7days' | '30days' | '90days' | '12months';

export interface SvgChartPoint {
  x: number;
  y: number;
  label: string;
  key: string;
  value: number;
  prevValue: number;
}

export interface SvgProfitChartPoint {
  x: number;
  yRev: number;
  yProfit: number | null;
  label: string;
  key: string;
  netRevenue: number;
  cogs: number;
  grossProfit: number | null;
  grossMargin: number | null;
}

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink, NgIcon, FormsModule, AdminNotificationTrackingDrawerComponent],
  providers: [
    provideIcons({
      lucideCalendarDays,
      lucideTrendingUp,
      lucideShoppingBag,
      lucidePackage,
      lucideUsers,
      lucideEye,
      lucideSearch,
      lucideMousePointerClick,
      lucideShoppingCart,
      lucideArrowUpRight,
      lucideArrowDownRight,
      lucideDownload,
      lucideChevronDown,
      lucideClock,
      lucideCircleCheck,
      lucideTruck,
      lucideCreditCard,
      lucideRefreshCw,
      lucideAlertTriangle,
      lucideAlertCircle,
      lucideInfo,
      lucideArrowRight,
      lucideHelpCircle,
      lucideSend,
      lucideX,
      lucideHistory
    })
  ],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss'
})
export class AdminDashboard implements OnInit, OnDestroy {
  private readonly dashboardService = inject(AdminDashboardService);
  private readonly notificationManagement = inject(AdminNotificationManagementService);
  private readonly staffService = inject(AdminStaffService);
  private readonly router = inject(Router);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly ngZone = inject(NgZone);
  private readonly appRef = inject(ApplicationRef);

  selectedPeriod: RevenuePeriod = '30days';
  isLoading = true;
  isUpdating = false;
  errorMessage: string | null = null;

  summaryCards: SummaryCardsData | null = null;
  revenueTrend: RevenueTrendData | null = null;
  orderPipeline: OrderPipelineData | null = null;
  paymentBreakdown: PaymentBreakdownData | null = null;
  carrierPerformance: CarrierPerformanceData | null = null;
  alerts: OperationalAlert[] = [];

  // Quản lý Drawer Theo dõi thông báo đã gửi (Mức 3 - Stage 3.2)
  isTrackingDrawerOpen = false;

  // Quản lý Modal Phát thông báo vận hành (Mức 3 - Stage 3.1)
  isDispatchModalOpen = false;
  selectedAlertForDispatch: OperationalAlert | null = null;
  dispatchTitle = '';
  dispatchMessage = '';
  dispatchPriority: OperationalNotificationPriority = 'normal';
  dispatchRecipientMode: OperationalRecipientMode = 'all_staff';
  dispatchRecipientId = '';
  dispatchTargetEntity: OperationalTargetEntity = { entity_type: 'system', entity_id: '' };
  dispatchLink = '';
  dispatchConfirmResend = false;

  isDispatching = false;
  dispatchError: string | null = null;
  dispatchSuccessMessage: string | null = null;
  isDuplicateRecentWarning = false;

  activeStaffList: AdminStaffMember[] = [];
  isLoadingStaffList = false;
  staffListError: string | null = null;

  // Tab điều hướng: Tổng quan kinh doanh (Phase 1) vs Quản trị Giá vốn & Lợi nhuận (Phase 2)
  activeTab: 'overview' | 'profit' = 'overview';

  profitSummary: ProfitSummaryData | null = null;
  profitTrend: ProfitTrendData | null = null;
  readonly profitPageSizeOptions = [10, 20, 50];
  profitPage = 1;
  profitPageSize = 10;

  hoveredPoint: SvgChartPoint | null = null;
  hoveredProfitPoint: SvgProfitChartPoint | null = null;

  // Thuộc tính biểu đồ doanh thu (Phase 1)
  maxRevenueValue = 1;
  chartPoints: SvgChartPoint[] = [];
  prevChartPoints: { x: number; y: number }[] = [];
  revenueLinePath = '';
  prevRevenueLinePath = '';
  revenueAreaPath = '';
  displayLabels: string[] = [];

  // Thuộc tính biểu đồ lợi nhuận (Phase 2)
  maxProfitChartValue = 1;
  profitChartPoints: SvgProfitChartPoint[] = [];
  profitRevLinePath = '';
  profitRevAreaPath = '';
  grossProfitLinePath = '';
  grossProfitAreaPath = '';
  profitDisplayLabels: string[] = [];

  private loadSubscription?: Subscription;

  ngOnInit(): void {
    this.loadDashboardData();
  }

  ngOnDestroy(): void {
    this.loadSubscription?.unsubscribe();
  }

  get periodLabel(): string {
    switch (this.selectedPeriod) {
      case '7days':
        return '7 ngày gần nhất';
      case '90days':
        return '90 ngày gần nhất';
      case '12months':
        return '12 tháng gần nhất';
      default:
        return '30 ngày gần nhất';
    }
  }

  get activeCategories(): CategoryCostItem[] {
    const list = this.profitSummary?.categoryBreakdown;
    if (!Array.isArray(list)) return [];
    return list.filter((cat) => (cat.cogs || 0) > 0);
  }

  get profitTotalPages(): number {
    return Math.max(1, Math.ceil((this.profitTrend?.points.length ?? 0) / this.profitPageSize));
  }

  get profitRangeStart(): number {
    return this.profitTrend?.points.length
      ? (this.profitPage - 1) * this.profitPageSize + 1
      : 0;
  }

  get profitRangeEnd(): number {
    return Math.min(this.profitPage * this.profitPageSize, this.profitTrend?.points.length ?? 0);
  }

  get paginatedProfitPoints(): ProfitTrendPoint[] {
    const points = this.profitTrend?.points ?? [];
    const start = (this.profitPage - 1) * this.profitPageSize;
    return points.slice(start, start + this.profitPageSize);
  }

  onProfitPageSizeChange(event: Event): void {
    const value = Number((event.target as HTMLSelectElement).value);
    if (this.profitPageSizeOptions.includes(value)) {
      this.profitPageSize = value;
      this.profitPage = 1;
    }
  }

  goToProfitPage(page: number): void {
    if (page >= 1 && page <= this.profitTotalPages) {
      this.profitPage = page;
    }
  }

  get previousPeriodRangeText(): string {
    const info = this.summaryCards?.periodInfo || this.profitSummary?.periodInfo;
    if (info?.previousStart && info?.previousEnd) {
      const start = this.formatDate(info.previousStart);
      const end = this.formatDate(info.previousEnd);
      if (start && end) {
        return `${start} – ${end}`;
      }
    }

    const now = new Date();
    let durationDays = 30;
    if (this.selectedPeriod === '7days') durationDays = 7;
    else if (this.selectedPeriod === '90days') durationDays = 90;
    else if (this.selectedPeriod === '12months') durationDays = 365;

    const curStart = new Date(now.getTime() - durationDays * 24 * 60 * 60 * 1000);
    const prevEnd = new Date(curStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationDays * 24 * 60 * 60 * 1000);

    return `${this.formatDate(prevStart)} – ${this.formatDate(prevEnd)}`;
  }

  get currentPeriodRangeText(): string {
    const info = this.summaryCards?.periodInfo || this.profitSummary?.periodInfo;
    if (info?.currentStart && info?.currentEnd) {
      const start = this.formatDate(info.currentStart);
      const end = this.formatDate(info.currentEnd);
      if (start && end) {
        return `${start} – ${end}`;
      }
    }
    const now = new Date();
    let durationDays = 30;
    if (this.selectedPeriod === '7days') durationDays = 7;
    else if (this.selectedPeriod === '90days') durationDays = 90;
    else if (this.selectedPeriod === '12months') durationDays = 365;
    const curStart = new Date(now.getTime() - durationDays * 24 * 60 * 60 * 1000);
    return `${this.formatDate(curStart)} – ${this.formatDate(now)}`;
  }

  formatDate(dateInput?: string | Date | null): string {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  onPeriodChange(event: Event): void {
    const target = event?.target as HTMLSelectElement | null;
    const value = target?.value as RevenuePeriod;
    if (target?.blur) {
      try {
        target.blur();
      } catch {}
    }
    if (['7days', '30days', '90days', '12months'].includes(value)) {
      this.selectedPeriod = value;
      this.profitPage = 1;
      this.loadDashboardData(true);
    }
  }

  setTab(tab: 'overview' | 'profit'): void {
    this.activeTab = tab;
    this.cdr?.markForCheck();
    this.cdr?.detectChanges();
  }

  loadDashboardData(isPeriodChange = false): void {
    this.loadSubscription?.unsubscribe();

    // Giữ nguyên layout nếu đã có dữ liệu để tránh chớp giật toàn trang
    if (isPeriodChange && this.summaryCards) {
      this.isLoading = false;
      this.isUpdating = true;
    } else {
      this.isLoading = true;
      this.isUpdating = false;
    }

    this.errorMessage = null;
    this.hoveredPoint = null;
    this.hoveredProfitPoint = null;
    this.cdr?.markForCheck();
    this.cdr?.detectChanges();

    // alerts là cảnh báo vận hành hệ thống thực tế (quá hạn SLA, đơn chuyển khoản, đổi trả),
    // không thay đổi theo kỳ báo cáo. Tối ưu bỏ qua alerts khi chỉ đổi kỳ để tăng tốc độ phản hồi.
    const requests: Record<string, any> = {
      summary: this.dashboardService.getSummaryCards(this.selectedPeriod),
      trend: this.dashboardService.getRevenueTrend(this.selectedPeriod),
      pipeline: this.dashboardService.getOrderPipeline(this.selectedPeriod),
      payment: this.dashboardService.getPaymentBreakdown(this.selectedPeriod),
      carrier: this.dashboardService.getCarrierPerformance(this.selectedPeriod),
      profitSummary: this.dashboardService.getProfitSummary(this.selectedPeriod),
      profitTrend: this.dashboardService.getProfitTrend(this.selectedPeriod)
    };

    if (!isPeriodChange || !this.alerts || this.alerts.length === 0) {
      requests['alerts'] = this.dashboardService.getOperationalAlerts();
    }

    this.loadSubscription = forkJoin(requests)
      .subscribe({
        next: (results: any) => {
          this.isLoading = false;
          this.isUpdating = false;
          this.summaryCards = results.summary?.data ?? this.summaryCards;
          this.revenueTrend = results.trend?.data ?? this.revenueTrend;
          this.orderPipeline = results.pipeline?.data ?? this.orderPipeline;
          this.paymentBreakdown = results.payment?.data ?? this.paymentBreakdown;
          this.carrierPerformance = results.carrier?.data ?? this.carrierPerformance;
          if (results.alerts?.data) {
            this.alerts = Array.isArray(results.alerts.data) ? results.alerts.data : [];
          }
          this.profitSummary = results.profitSummary?.data ?? this.profitSummary;
          this.profitTrend = results.profitTrend?.data ?? this.profitTrend;

          this.updateChartCalculations();
          this.updateProfitChartCalculations();
          this.cdr?.markForCheck();
          this.cdr?.detectChanges();
        },
        error: (err) => {
          console.error('Lỗi tải dữ liệu Dashboard:', err);
          this.isLoading = false;
          this.isUpdating = false;
          this.errorMessage = err?.message || 'Không thể tải dữ liệu Dashboard. Vui lòng thử lại sau.';
          this.cdr?.markForCheck();
          this.cdr?.detectChanges();
        }
      });
  }

  onRetry(): void {
    this.loadDashboardData();
  }

  // --- ĐIỀU HƯỚNG CẢNH BÁO VẬN HÀNH (OPERATIONAL ALERTS NAVIGATION) ---

  getAlertRoute(link?: string): string {
    if (!link) return '';
    return link.split('?')[0] || '';
  }

  getAlertQueryParams(link?: string): Record<string, string> {
    if (!link || !link.includes('?')) return {};
    const queryPart = link.split('?')[1];
    if (!queryPart) return {};
    const params = new URLSearchParams(queryPart);
    const result: Record<string, string> = {};
    params.forEach((value, key) => {
      result[key] = value;
    });
    return result;
  }

  getAlertCountText(alert: OperationalAlert): string {
    const route = this.getAlertRoute(alert.link);
    const unit = route === '/admin/returns'
      ? 'yêu cầu'
      : route === '/admin/orders'
        ? 'đơn hàng'
        : 'cảnh báo';
    return `${alert.count} ${unit}`;
  }

  getAlertActionText(alert: OperationalAlert): string {
    switch (alert.id) {
      case 'sla_overdue_orders':
        return 'Xem đơn quá hạn';
      case 'pending_returns':
        return 'Xem yêu cầu đổi trả';
      case 'pending_bank_orders':
        return 'Xem đơn chuyển khoản';
      default:
        return 'Xem chi tiết';
    }
  }

  // --- TÍNH TOÁN TỌA ĐỘ BIỂU ĐỒ SVG TỪ DỮ LIỆU THẬT ---

  updateChartCalculations(): void {
    const points = this.revenueTrend?.points;
    if (!points || points.length === 0) {
      this.maxRevenueValue = 1;
      this.chartPoints = [];
      this.prevChartPoints = [];
      this.revenueLinePath = '';
      this.prevRevenueLinePath = '';
      this.revenueAreaPath = '';
      this.displayLabels = [];
      return;
    }

    const maxCur = Math.max(...points.map((p) => p.netRevenue));
    const maxPrev = Math.max(...points.map((p) => p.prevNetRevenue));
    const maxVal = Math.max(maxCur, maxPrev);
    this.maxRevenueValue = maxVal > 0 ? maxVal * 1.15 : 1000000;

    const width = 600;
    const leftInset = 12;
    const rightInset = width - leftInset;
    const topInset = 12;
    const bottomInset = 204;
    const max = this.maxRevenueValue;
    const count = points.length;

    this.chartPoints = points.map((pt, index) => {
      const x = count === 1
        ? width / 2
        : leftInset + (index / (count - 1)) * (rightInset - leftInset);
      const y = bottomInset - (pt.netRevenue / max) * (bottomInset - topInset);
      return {
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1)),
        label: pt.label,
        key: pt.key,
        value: pt.netRevenue,
        prevValue: pt.prevNetRevenue
      };
    });

    this.prevChartPoints = points.map((pt, index) => {
      const x = count === 1
        ? width / 2
        : leftInset + (index / (count - 1)) * (rightInset - leftInset);
      const y = bottomInset - (pt.prevNetRevenue / max) * (bottomInset - topInset);
      return {
        x: Number(x.toFixed(1)),
        y: Number(y.toFixed(1))
      };
    });

    this.revenueLinePath = this.createSmoothLinePath(
      this.chartPoints.map(({ x, y }) => ({ x, y }))
    );
    this.prevRevenueLinePath = this.createSmoothLinePath(this.prevChartPoints);

    this.revenueAreaPath = this.revenueLinePath
      ? `${this.revenueLinePath} L ${rightInset} ${bottomInset} L ${leftInset} ${bottomInset} Z`
      : '';

    const total = points.length;
    if (total <= 12) {
      this.displayLabels = points.map((p) => p.label);
    } else {
      const step = Math.ceil(total / 6);
      this.displayLabels = points
        .filter((_, i) => i % step === 0 || i === total - 1)
        .map((p) => p.label);
    }
  }

  onHoverPoint(point: SvgChartPoint): void {
    this.hoveredPoint = point;
  }

  onLeaveChart(): void {
    this.hoveredPoint = null;
  }

  // --- TÍNH TOÁN BIỂU ĐỒ LỢI NHUẬN (PHASE 2) ---

  updateProfitChartCalculations(): void {
    const points = this.profitTrend?.points;
    if (!points || points.length === 0) {
      this.maxProfitChartValue = 1;
      this.profitChartPoints = [];
      this.profitRevLinePath = '';
      this.profitRevAreaPath = '';
      this.grossProfitLinePath = '';
      this.grossProfitAreaPath = '';
      this.profitDisplayLabels = [];
      return;
    }

    const maxRev = Math.max(...points.map((p) => p.netRevenue));
    const validProfits = points
      .map((p) => p.grossProfit)
      .filter((v): v is number => v !== null && v !== undefined);
    const maxProfit = validProfits.length > 0 ? Math.max(...validProfits) : 0;
    const maxVal = Math.max(maxRev, maxProfit);
    this.maxProfitChartValue = maxVal > 0 ? maxVal * 1.15 : 1000000;

    const width = 600;
    const leftInset = 12;
    const rightInset = width - leftInset;
    const topInset = 12;
    const bottomInset = 204;
    const max = this.maxProfitChartValue;
    const count = points.length;

    this.profitChartPoints = points.map((pt, index) => {
      const x = count === 1
        ? width / 2
        : leftInset + (index / (count - 1)) * (rightInset - leftInset);
      const yRev = bottomInset - (Math.max(0, pt.netRevenue) / max) * (bottomInset - topInset);
      const yProfit = pt.grossProfit !== null && pt.grossProfit !== undefined
        ? bottomInset - (Math.max(0, pt.grossProfit) / max) * (bottomInset - topInset)
        : null;
      return {
        x: Number(x.toFixed(1)),
        yRev: Number(yRev.toFixed(1)),
        yProfit: yProfit !== null ? Number(yProfit.toFixed(1)) : null,
        label: pt.label,
        key: pt.key,
        netRevenue: pt.netRevenue,
        cogs: pt.cogs,
        grossProfit: pt.grossProfit,
        grossMargin: pt.grossMargin
      };
    });

    this.profitRevLinePath = this.createSmoothLinePath(
      this.profitChartPoints.map(({ x, yRev }) => ({ x, y: yRev }))
    );

    this.profitRevAreaPath = this.profitRevLinePath
      ? `${this.profitRevLinePath} L ${rightInset} ${bottomInset} L ${leftInset} ${bottomInset} Z`
      : '';

    const validProfitPoints = this.profitChartPoints.filter(
      (point): point is SvgProfitChartPoint & { yProfit: number } => point.yProfit !== null
    );
    if (validProfitPoints.length > 0) {
      this.grossProfitLinePath = this.createSmoothLinePath(
        validProfitPoints.map(({ x, yProfit }) => ({ x, y: yProfit }))
      );
      this.grossProfitAreaPath = `${this.grossProfitLinePath} L ${validProfitPoints[validProfitPoints.length - 1].x} ${bottomInset} L ${validProfitPoints[0].x} ${bottomInset} Z`;
    } else {
      this.grossProfitLinePath = '';
      this.grossProfitAreaPath = '';
    }

    const total = points.length;
    if (total <= 12) {
      this.profitDisplayLabels = points.map((p) => p.label);
    } else {
      const step = Math.ceil(total / 6);
      this.profitDisplayLabels = points
        .filter((_, i) => i % step === 0 || i === total - 1)
        .map((p) => p.label);
    }
  }

  private createSmoothLinePath(points: Array<{ x: number; y: number }>): string {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

    let path = `M ${points[0].x} ${points[0].y}`;
    for (let index = 0; index < points.length - 1; index++) {
      const previous = points[Math.max(0, index - 1)];
      const start = points[index];
      const end = points[index + 1];
      const next = points[Math.min(points.length - 1, index + 2)];
      const control1X = start.x + (end.x - previous.x) / 6;
      const control1Y = Math.max(12, Math.min(204, start.y + (end.y - previous.y) / 6));
      const control2X = end.x - (next.x - start.x) / 6;
      const control2Y = Math.max(12, Math.min(204, end.y - (next.y - start.y) / 6));

      path += ` C ${control1X.toFixed(1)} ${control1Y.toFixed(1)}, ${control2X.toFixed(1)} ${control2Y.toFixed(1)}, ${end.x} ${end.y}`;
    }

    return path;
  }

  onHoverProfitPoint(point: SvgProfitChartPoint): void {
    this.hoveredProfitPoint = point;
  }

  onLeaveProfitChart(): void {
    this.hoveredProfitPoint = null;
  }

  // --- HIT-BOX HOVER SLICE HELPERS ---

  getHoverSliceX(index: number, total: number): number {
    if (total <= 1) return 0;
    return Number(((index * 600) / total).toFixed(1));
  }

  getHoverSliceWidth(total: number): number {
    if (total <= 1) return 600;
    return Number((600 / total).toFixed(1));
  }

  getProfitTooltipLeft(x: number): number {
    const rawPct = (x / 600) * 100;
    return Math.max(16, Math.min(84, Number(rawPct.toFixed(1))));
  }

  getProfitTooltipTop(pt: SvgProfitChartPoint): number {
    const yRev = pt.yRev;
    const yProfit = pt.yProfit !== null ? pt.yProfit : yRev;
    return Math.min(yRev, yProfit);
  }

  // --- FORMATTING HELPERS ---

  formatCurrency(value?: number | null): string {
    if (value === undefined || value === null) return '0 ₫';
    return `${new Intl.NumberFormat('vi-VN').format(Math.round(value))} ₫`;
  }

  formatNumber(value?: number | null): string {
    if (value === undefined || value === null) return '0';
    return new Intl.NumberFormat('vi-VN').format(value);
  }

  // --- MỨC 3: OPERATIONAL NOTIFICATION DISPATCH METHODS ---

  get isManager(): boolean {
    return getAdminRole() === 'Manager';
  }

  openTrackingDrawer(): void {
    this.isTrackingDrawerOpen = true;
    this.cdr?.markForCheck();
  }

  closeTrackingDrawer(): void {
    this.isTrackingDrawerOpen = false;
    this.cdr?.markForCheck();
  }

  get dispatchTitleCharsLeft(): number {
    return 200 - (this.dispatchTitle?.length || 0);
  }

  get dispatchMessageChars(): number {
    return this.dispatchMessage?.length || 0;
  }

  openDispatchModal(alert: OperationalAlert): void {
    this.selectedAlertForDispatch = alert;

    // 1. Ánh xạ priority từ alert.level
    switch (alert.level) {
      case 'critical':
        this.dispatchPriority = 'urgent';
        break;
      case 'warning':
        this.dispatchPriority = 'important';
        break;
      case 'info':
      default:
        this.dispatchPriority = 'normal';
        break;
    }

    // 2. Ánh xạ target entity
    let entityType: OperationalEntityType = 'system';
    if (alert.id === 'sla_overdue_orders' || alert.id === 'pending_bank_orders') {
      entityType = 'order';
    } else if (alert.id === 'pending_returns') {
      entityType = 'return';
    }

    const entityId = Array.isArray(alert.sampleIds) && alert.sampleIds.length > 0 ? alert.sampleIds[0] : '';
    this.dispatchTargetEntity = {
      entity_type: entityType,
      entity_id: entityId,
    };

    // 3. Điền trước tiêu đề và nội dung
    this.dispatchTitle = alert.title || '';
    this.dispatchMessage = alert.message || '';
    this.dispatchLink = alert.link || '';
    this.dispatchRecipientMode = 'all_staff';
    this.dispatchRecipientId = '';
    this.dispatchConfirmResend = false;
    this.dispatchError = null;
    this.dispatchSuccessMessage = null;
    this.isDuplicateRecentWarning = false;
    this.isDispatching = false;

    this.isDispatchModalOpen = true;

    // 4. Tải danh sách Staff active
    this.loadActiveStaff();
    this.cdr?.markForCheck();
  }

  closeDispatchModal(): void {
    if (this.isDispatching) return;
    this.isDispatchModalOpen = false;
    this.selectedAlertForDispatch = null;
    this.dispatchError = null;
    this.dispatchSuccessMessage = null;
    this.isDuplicateRecentWarning = false;
    this.cdr?.markForCheck();
  }

  loadActiveStaff(): void {
    if (this.activeStaffList.length > 0) return;
    this.isLoadingStaffList = true;
    this.staffListError = null;

    this.staffService.getStaffList({ role: 'Staff', status: 'active', limit: 100 }).subscribe({
      next: (res) => {
        this.activeStaffList = (res.data?.items || []).filter(
          (s) => s.Role === 'Staff' && s.Status === 'active'
        );
        this.isLoadingStaffList = false;
        this.cdr?.markForCheck();
      },
      error: () => {
        this.staffListError = 'Không thể tải danh sách nhân viên. Vui lòng thử lại.';
        this.isLoadingStaffList = false;
        this.cdr?.markForCheck();
      },
    });
  }

  onRecipientModeChange(mode: OperationalRecipientMode): void {
    this.dispatchRecipientMode = mode;
    if (mode === 'specific_staff' && this.activeStaffList.length === 0) {
      this.loadActiveStaff();
    }
  }

  submitDispatch(): void {
    if (this.isDispatching) return;

    const trimmedTitle = (this.dispatchTitle || '').trim();
    const trimmedMessage = (this.dispatchMessage || '').trim();

    if (!trimmedTitle) {
      this.dispatchError = 'Vui lòng nhập tiêu đề thông báo.';
      return;
    }
    if (trimmedTitle.length > 200) {
      this.dispatchError = 'Tiêu đề không được vượt quá 200 ký tự.';
      return;
    }
    if (!trimmedMessage) {
      this.dispatchError = 'Vui lòng nhập nội dung thông báo.';
      return;
    }
    if (trimmedMessage.length > 1000) {
      this.dispatchError = 'Nội dung không được vượt quá 1000 ký tự.';
      return;
    }
    if (this.dispatchRecipientMode === 'specific_staff' && !this.dispatchRecipientId) {
      this.dispatchError = 'Vui lòng chọn một nhân viên Staff nhận thông báo.';
      return;
    }

    this.isDispatching = true;
    this.dispatchError = null;
    this.dispatchSuccessMessage = null;

    const payload: DispatchAlertPayload = {
      title: trimmedTitle,
      message: trimmedMessage,
      priority: this.dispatchPriority,
      recipient_mode: this.dispatchRecipientMode,
      recipient_ids: this.dispatchRecipientMode === 'specific_staff' ? [this.dispatchRecipientId] : undefined,
      target_entity: this.dispatchTargetEntity.entity_id ? this.dispatchTargetEntity : undefined,
      link: this.dispatchLink,
      confirm_resend: this.dispatchConfirmResend,
    };

    this.notificationManagement.dispatchAlert(payload).subscribe({
      next: (res) => {
        this.isDispatching = false;
        this.dispatchSuccessMessage = res.message || 'Đã phát thông báo vận hành thành công!';
        this.cdr?.markForCheck();

        setTimeout(() => {
          this.closeDispatchModal();
        }, 1200);
      },
      error: (err) => {
        this.isDispatching = false;
        const errBody = err.error;
        if (err.status === 409 && (errBody?.code === 'DUPLICATE_RECENT_ALERT' || errBody?.message?.includes('cách đây chưa đầy 1 phút'))) {
          this.isDuplicateRecentWarning = true;
          this.dispatchError = errBody?.message || 'Thông báo có cùng tiêu đề vừa được gửi cách đây chưa đầy 1 phút.';
        } else {
          this.dispatchError = errBody?.message || 'Lỗi gửi thông báo. Vui lòng kiểm tra lại.';
        }
        this.cdr?.markForCheck();
      },
    });
  }
}
