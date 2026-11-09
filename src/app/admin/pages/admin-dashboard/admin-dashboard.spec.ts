import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { AdminDashboard, SvgChartPoint } from './admin-dashboard';
import {
  AdminDashboardService,
  SummaryCardsData,
  RevenueTrendData,
  OperationalAlert,
  ProfitSummaryData,
  ProfitTrendData
} from '../../services/admin-dashboard';

describe('AdminDashboard Unit Tests', () => {
  let dashboard: AdminDashboard;
  let mockDashboardService: any;
  let mockRouter: any;
  let mockCdr: any;

  const sampleSummary: SummaryCardsData = {
    netRevenue: { value: 2934935000, prevValue: 2500000000, diff: 434935000, percent: 17.4, hasComparison: true, tooltip: 'Doanh thu thuần' },
    completedOrders: { value: 85, prevValue: 75, diff: 10, percent: 13.33, hasComparison: true, tooltip: 'Số đơn hoàn tất' },
    aov: { value: 34528647, prevValue: 33333333, diff: 1195314, percent: 3.59, hasComparison: true, tooltip: 'AOV' },
    deliverySuccessRate: { value: 93, prevValue: 91, diff: 2, percent: 2.2, hasComparison: true, deliveredCount: 93, failedCount: 7, tooltip: 'Tỷ lệ giao' },
    periodInfo: { currentStart: '2026-10-09', currentEnd: '2026-11-08', previousStart: '2026-09-09', previousEnd: '2026-10-09' }
  };

  const sampleTrend: RevenueTrendData = {
    step: 'day',
    points: [
      { label: '01/11', key: '2026-11-01', netRevenue: 100000000, prevNetRevenue: 80000000 },
      { label: '02/11', key: '2026-11-02', netRevenue: 0, prevNetRevenue: 50000000 },
      { label: '03/11', key: '2026-11-03', netRevenue: 200000000, prevNetRevenue: 150000000 },
    ],
    totalNetRevenue: 300000000,
    prevTotalNetRevenue: 280000000
  };

  const sampleProfitSummary: ProfitSummaryData = {
    netRevenue: { value: 2934935000, prevValue: 2500000000, diff: 434935000, percent: 17.4, hasComparison: true, tooltip: 'Doanh thu thuần' },
    cogs: { value: 1800000000, prevValue: 1500000000, diff: 300000000, percent: 20.0, hasComparison: true, tooltip: 'Giá vốn hàng bán' },
    grossProfit: { value: 1134935000, prevValue: 1000000000, diff: 134935000, percent: 13.49, hasComparison: true, tooltip: 'Lợi nhuận gộp' },
    grossMargin: { value: 38.67, prevValue: 40.0, diff: -1.33, percent: -3.33, hasComparison: true, tooltip: 'Biên lợi nhuận gộp' },
    costCoverage: {
      ratio: 92.5,
      trackedRevenue: 2714814875,
      totalRevenue: 2934935000,
      trackedItems: 78,
      totalItems: 85,
      isComplete: false,
      warning: 'Dữ liệu giá vốn đạt 92.5%. Lợi nhuận gộp phản ánh phần sản phẩm đã có giá vốn.'
    },
    periodInfo: { currentStart: '2026-10-09', currentEnd: '2026-11-08', previousStart: '2026-09-09', previousEnd: '2026-10-09' }
  };

  const sampleProfitTrend: ProfitTrendData = {
    step: 'day',
    points: [
      { label: '01/11', key: '2026-11-01', netRevenue: 100000000, cogs: 60000000, grossProfit: 40000000, grossMargin: 40.0 },
      { label: '02/11', key: '2026-11-02', netRevenue: 0, cogs: 0, grossProfit: 0, grossMargin: 0 },
      { label: '03/11', key: '2026-11-03', netRevenue: 200000000, cogs: 120000000, grossProfit: 80000000, grossMargin: 40.0 },
    ],
    totalNetRevenue: 300000000,
    totalCogs: 180000000,
    totalGrossProfit: 120000000,
    overallGrossMargin: 40.0,
    overallCostCoverage: 92.5
  };

  beforeEach(() => {
    mockDashboardService = {
      getSummaryCards: vi.fn().mockReturnValue(of({ success: true, data: sampleSummary })),
      getRevenueTrend: vi.fn().mockReturnValue(of({ success: true, data: sampleTrend })),
      getOrderPipeline: vi.fn().mockReturnValue(of({ success: true, data: { total: 120, pipeline: [] } })),
      getPaymentBreakdown: vi.fn().mockReturnValue(of({ success: true, data: { totalPayments: 120, byStatus: [], byMethod: [] } })),
      getCarrierPerformance: vi.fn().mockReturnValue(of({ success: true, data: { totalDeliveries: 120, partners: [] } })),
      getOperationalAlerts: vi.fn().mockReturnValue(of({ success: true, data: [] })),
      getProfitSummary: vi.fn().mockReturnValue(of({ success: true, data: sampleProfitSummary })),
      getProfitTrend: vi.fn().mockReturnValue(of({ success: true, data: sampleProfitTrend })),
    };

    mockRouter = {
      navigate: vi.fn(),
    };

    mockCdr = {
      detectChanges: vi.fn(),
      markForCheck: vi.fn(),
    };

    const mockNgZone = {
      run: vi.fn((fn: any) => fn()),
    };

    const mockAppRef = {
      tick: vi.fn(),
    };

    // Instantiate AdminDashboard with mocked dependencies injected
    dashboard = Object.create(AdminDashboard.prototype);
    Object.assign(dashboard, {
      dashboardService: mockDashboardService,
      router: mockRouter,
      cdr: mockCdr,
      ngZone: mockNgZone,
      appRef: mockAppRef,
      selectedPeriod: '30days',
      activeTab: 'overview',
      isLoading: true,
      errorMessage: null,
      summaryCards: null,
      revenueTrend: null,
      orderPipeline: null,
      paymentBreakdown: null,
      carrierPerformance: null,
      alerts: [],
      profitSummary: null,
      profitTrend: null,
      hoveredPoint: null,
      hoveredProfitPoint: null,
      maxRevenueValue: 1,
      chartPoints: [],
      prevChartPoints: [],
      revenueLinePath: '',
      prevRevenueLinePath: '',
      revenueAreaPath: '',
      displayLabels: [],
      maxProfitChartValue: 1,
      profitChartPoints: [],
      profitRevLinePath: '',
      profitRevAreaPath: '',
      grossProfitLinePath: '',
      grossProfitAreaPath: '',
      profitDisplayLabels: [],
    });
  });

  it('1. Khởi tạo và tải dữ liệu thành công với các endpoint Dashboard', () => {
    dashboard.ngOnInit();

    expect(mockDashboardService.getSummaryCards).toHaveBeenCalledWith('30days');
    expect(mockDashboardService.getRevenueTrend).toHaveBeenCalledWith('30days');
    expect(mockDashboardService.getOrderPipeline).toHaveBeenCalledWith('30days');
    expect(mockDashboardService.getPaymentBreakdown).toHaveBeenCalledWith('30days');
    expect(mockDashboardService.getCarrierPerformance).toHaveBeenCalledWith('30days');
    expect(mockDashboardService.getOperationalAlerts).toHaveBeenCalled();
    expect(mockDashboardService.getProfitSummary).toHaveBeenCalledWith('30days');
    expect(mockDashboardService.getProfitTrend).toHaveBeenCalledWith('30days');

    expect(dashboard.isLoading).toBe(false);
    expect(dashboard.errorMessage).toBeNull();
    expect(dashboard.summaryCards?.netRevenue.value).toBe(2934935000);
    expect(dashboard.summaryCards?.completedOrders.value).toBe(85);
    expect(dashboard.profitSummary?.grossProfit.value).toBe(1134935000);
    expect(dashboard.profitTrend?.totalNetRevenue).toBe(300000000);
    expect(mockCdr.detectChanges).toHaveBeenCalled();
  });

  it('2. Thay đổi kỳ báo cáo cập nhật state và tải lại số liệu', () => {
    dashboard.ngOnInit();

    const event = { target: { value: '7days' } } as unknown as Event;
    dashboard.onPeriodChange(event);

    expect(dashboard.selectedPeriod).toBe('7days');
    expect(mockDashboardService.getSummaryCards).toHaveBeenCalledWith('7days');
    expect(mockDashboardService.getProfitSummary).toHaveBeenCalledWith('7days');
    expect(mockDashboardService.getProfitTrend).toHaveBeenCalledWith('7days');

    const event12m = { target: { value: '12months' } } as unknown as Event;
    dashboard.onPeriodChange(event12m);

    expect(dashboard.selectedPeriod).toBe('12months');
    expect(mockDashboardService.getSummaryCards).toHaveBeenCalledWith('12months');
    expect(mockDashboardService.getProfitSummary).toHaveBeenCalledWith('12months');
    expect(mockDashboardService.getProfitTrend).toHaveBeenCalledWith('12months');
  });

  it('2b. Thay đổi kỳ báo cáo nhả focus (blur) và tắt loading ngay khi API trả về', () => {
    const blurSpy = vi.fn();
    const event = { target: { value: '7days', blur: blurSpy } } as unknown as Event;

    dashboard.onPeriodChange(event);

    expect(blurSpy).toHaveBeenCalled();
    expect(dashboard.isLoading).toBe(false);
    expect(mockCdr.detectChanges).toHaveBeenCalled();
  });

  it('2c. Định dạng chính xác khoảng thời gian kỳ trước từ periodInfo', () => {
    dashboard.ngOnInit();
    expect(dashboard.previousPeriodRangeText).toBe('09/09/2026 – 09/10/2026');
  });

  it('3. Xử lý khi API báo lỗi: bật errorMessage và tắt loading', () => {
    mockDashboardService.getSummaryCards.mockReturnValue(throwError(() => new Error('Lỗi máy chủ')));

    dashboard.loadDashboardData();

    expect(dashboard.isLoading).toBe(false);
    expect(dashboard.errorMessage).toBe('Lỗi máy chủ');
    expect(mockCdr.detectChanges).toHaveBeenCalled();
  });

  it('4. Tính toán chính xác tọa độ biểu đồ SVG từ dữ liệu thật (không fake)', () => {
    dashboard.ngOnInit();

    const points = dashboard.chartPoints;
    expect(points.length).toBe(3);

    // Chart padding keeps endpoint markers inside the SVG viewport.
    expect(points[0].x).toBe(12);
    expect(points[0].value).toBe(100000000);

    // Zero-value days stay on the baseline without touching the SVG edge.
    expect(points[1].value).toBe(0);
    expect(points[1].y).toBe(204);

    expect(points[2].x).toBe(588);
    expect(points[2].value).toBe(200000000);

    expect(dashboard.revenueLinePath).toMatch(/^M 12 \d+(\.\d+)? C /);
    expect(dashboard.revenueAreaPath).toContain('L 588 204 L 12 204 Z');

    expect(dashboard.profitChartPoints[0].x).toBe(12);
    expect(dashboard.profitChartPoints[2].x).toBe(588);
    expect(dashboard.profitRevLinePath).toContain(' C ');
    expect(dashboard.grossProfitLinePath).toContain(' C ');
  });

  it('5. Định dạng tiền tệ và số nguyên chuẩn tiếng Việt', () => {
    expect(dashboard.formatCurrency(2934935000)).toBe('2.934.935.000 ₫');
    expect(dashboard.formatCurrency(0)).toBe('0 ₫');
    expect(dashboard.formatNumber(1250)).toBe('1.250');
  });

  it('6. Hover và rời điểm trên biểu đồ cập nhật hoveredPoint', () => {
    dashboard.ngOnInit();
    const pt: SvgChartPoint = { x: 10, y: 50, label: '01/11', key: '2026-11-01', value: 100000000, prevValue: 80000000 };

    dashboard.onHoverPoint(pt);
    expect(dashboard.hoveredPoint).toBe(pt);

    dashboard.onLeaveChart();
    expect(dashboard.hoveredPoint).toBeNull();
  });

  it('7. Gọi finalize và ngOnDestroy huỷ subscription an toàn', () => {
    dashboard.ngOnInit();
    expect(dashboard.isLoading).toBe(false);

    // Kiểm tra cleanup subscription
    dashboard.ngOnDestroy();
  });

  it('8. Xử lý an toàn khi API trả về dữ liệu rỗng', () => {
    mockDashboardService.getRevenueTrend.mockReturnValue(of({ success: true, data: { step: 'day', points: [], totalNetRevenue: 0, prevTotalNetRevenue: 0 } }));
    mockDashboardService.getProfitTrend.mockReturnValue(of({ success: true, data: { step: 'day', points: [], totalNetRevenue: 0, totalCogs: 0, totalGrossProfit: 0, overallGrossMargin: 0, overallCostCoverage: 0 } }));
    dashboard.loadDashboardData();

    expect(dashboard.isLoading).toBe(false);
    expect(dashboard.chartPoints.length).toBe(0);
    expect(dashboard.revenueLinePath).toBe('');
    expect(dashboard.maxRevenueValue).toBe(1);
    expect(dashboard.profitChartPoints.length).toBe(0);
    expect(dashboard.profitRevLinePath).toBe('');
    expect(dashboard.maxProfitChartValue).toBe(1);
  });

  it('9. getAlertRoute trích xuất đúng URL path loại bỏ query string cho RouterLink', () => {
    expect(dashboard.getAlertRoute('/admin/orders?status=overdue')).toBe('/admin/orders');
    expect(dashboard.getAlertRoute('/admin/returns?status=pending')).toBe('/admin/returns');
    expect(dashboard.getAlertRoute('/admin/orders?paymentType=BankTransfer')).toBe('/admin/orders');
    expect(dashboard.getAlertRoute('/admin/orders')).toBe('/admin/orders');
    expect(dashboard.getAlertRoute('')).toBe('');
    expect(dashboard.getAlertRoute(undefined)).toBe('');
  });

  it('10. getAlertQueryParams phân tách chính xác query params thành Object cho Angular Router', () => {
    expect(dashboard.getAlertQueryParams('/admin/orders?status=overdue')).toEqual({ status: 'overdue' });
    expect(dashboard.getAlertQueryParams('/admin/returns?status=pending')).toEqual({ status: 'pending' });
    expect(dashboard.getAlertQueryParams('/admin/orders?paymentType=BankTransfer')).toEqual({ paymentType: 'BankTransfer' });
    expect(dashboard.getAlertQueryParams('/admin/orders?a=1&b=2')).toEqual({ a: '1', b: '2' });
    expect(dashboard.getAlertQueryParams('/admin/orders')).toEqual({});
    expect(dashboard.getAlertQueryParams('')).toEqual({});
    expect(dashboard.getAlertQueryParams(undefined)).toEqual({});
  });

  it('10b. Hiển thị đơn vị cảnh báo và hành động điều hướng theo quyền giám sát', () => {
    const returnsAlert: OperationalAlert = {
      id: 'pending_returns',
      level: 'warning',
      title: 'Yêu cầu đổi trả đang chờ xử lý',
      message: 'Có yêu cầu đổi trả đang chờ duyệt.',
      count: 2,
      sampleIds: ['RET-001'],
      link: '/admin/returns?status=pending',
      actionText: 'API label'
    };

    expect(dashboard.getAlertCountText(returnsAlert)).toBe('2 yêu cầu');
    expect(dashboard.getAlertActionText(returnsAlert)).toBe('Xem yêu cầu đổi trả');
    expect(dashboard.getAlertActionText({
      ...returnsAlert,
      id: 'sla_overdue_orders',
      link: '/admin/orders?status=overdue'
    })).toBe('Xem đơn quá hạn');
  });

  it('11. Xử lý kịch bản Cost Coverage = 0%: Gross Profit và Margin là null, không vẽ đè biểu đồ', () => {
    const zeroProfitSummary: ProfitSummaryData = {
      netRevenue: { value: 1000000000, prevValue: 800000000, diff: 200000000, percent: 25, hasComparison: true, tooltip: 'Doanh thu thuần' },
      cogs: { value: 0, prevValue: 0, diff: null, percent: null, hasComparison: false, status: 'unrecorded', tooltip: 'Chưa ghi nhận giá vốn' },
      grossProfit: { value: null, prevValue: null, diff: null, percent: null, hasComparison: false, coverageStatus: 'zero', tooltip: 'Chưa đủ dữ liệu' },
      grossMargin: { value: null, prevValue: null, diff: null, percent: null, hasComparison: false, coverageStatus: 'zero', tooltip: 'Chưa đủ dữ liệu' },
      costCoverage: { ratio: 0, coverageStatus: 'zero', trackedRevenue: 0, totalRevenue: 1000000000, trackedItems: 0, totalItems: 50, isComplete: false, warning: 'Chưa có sản phẩm nào ghi nhận giá vốn' },
      periodInfo: { currentStart: '2026-10-09', currentEnd: '2026-11-08', previousStart: '2026-09-09', previousEnd: '2026-10-09' }
    };

    const zeroProfitTrend: ProfitTrendData = {
      step: 'day',
      points: [
        { label: '01/11', key: '2026-11-01', netRevenue: 100000000, cogs: 0, grossProfit: null, grossMargin: null },
        { label: '02/11', key: '2026-11-02', netRevenue: 200000000, cogs: 0, grossProfit: null, grossMargin: null }
      ],
      totalNetRevenue: 300000000,
      totalCogs: 0,
      totalGrossProfit: null,
      overallGrossMargin: null,
      overallCostCoverage: 0
    };

    mockDashboardService.getProfitSummary.mockReturnValue(of({ success: true, data: zeroProfitSummary }));
    mockDashboardService.getProfitTrend.mockReturnValue(of({ success: true, data: zeroProfitTrend }));
    dashboard.loadDashboardData();

    expect(dashboard.profitSummary!.grossProfit.value).toBeNull();
    expect(dashboard.profitSummary!.grossMargin.value).toBeNull();
    expect(dashboard.profitSummary!.cogs.status).toBe('unrecorded');
    expect(dashboard.profitSummary!.costCoverage.ratio).toBe(0);
    expect(dashboard.grossProfitLinePath).toBe('');
    expect(dashboard.grossProfitAreaPath).toBe('');
  });

  it('12. Xử lý kịch bản 0% < Cost Coverage < 100%: Gross Profit toàn kỳ là null, hiển thị chỉ tiêu riêng phần tracked', () => {
    const partialProfitSummary: ProfitSummaryData = {
      netRevenue: { value: 50000000, prevValue: 40000000, diff: 10000000, percent: 25, hasComparison: true, tooltip: 'Doanh thu thuần' },
      cogs: { value: 12000000, prevValue: 10000000, diff: 2000000, percent: 20, hasComparison: true, tooltip: 'Giá vốn hàng bán' },
      grossProfit: { value: null, prevValue: null, diff: null, percent: null, hasComparison: false, trackedValue: 8000000, coverageStatus: 'partial', tooltip: 'Chưa đủ dữ liệu toàn kỳ' },
      grossMargin: { value: null, prevValue: null, diff: null, percent: null, hasComparison: false, trackedValue: 40.0, coverageStatus: 'partial', tooltip: 'Chưa đủ dữ liệu toàn kỳ' },
      costCoverage: { ratio: 40, coverageStatus: 'partial', trackedRevenue: 20000000, totalRevenue: 50000000, trackedItems: 20, totalItems: 50, isComplete: false, warning: 'Độ bao phủ 40%' },
      periodInfo: { currentStart: '2026-10-09', currentEnd: '2026-11-08', previousStart: '2026-09-09', previousEnd: '2026-10-09' }
    };

    mockDashboardService.getProfitSummary.mockReturnValue(of({ success: true, data: partialProfitSummary }));
    dashboard.loadDashboardData();

    expect(dashboard.profitSummary!.grossProfit.value).toBeNull();
    expect(dashboard.profitSummary!.grossProfit.trackedValue).toBe(8000000);
    expect(dashboard.profitSummary!.grossMargin.value).toBeNull();
    expect(dashboard.profitSummary!.grossMargin.trackedValue).toBe(40.0);
    expect(dashboard.profitSummary!.costCoverage.ratio).toBe(40);
  });

  it('13. Xử lý kịch bản Cost Coverage = 100%: Gross Profit và Margin toàn kỳ hiển thị số liệu hợp lệ', () => {
    const fullProfitSummary: ProfitSummaryData = {
      netRevenue: { value: 50000000, prevValue: 40000000, diff: 10000000, percent: 25, hasComparison: true, tooltip: 'Doanh thu thuần' },
      cogs: { value: 30000000, prevValue: 24000000, diff: 6000000, percent: 25, hasComparison: true, tooltip: 'Giá vốn hàng bán' },
      grossProfit: { value: 20000000, prevValue: 16000000, diff: 4000000, percent: 25, hasComparison: true, coverageStatus: 'complete', tooltip: 'Lợi nhuận gộp toàn kỳ' },
      grossMargin: { value: 40.0, prevValue: 40.0, diff: 0, percent: 0, hasComparison: true, coverageStatus: 'complete', tooltip: 'Biên lợi nhuận gộp toàn kỳ' },
      costCoverage: { ratio: 100, coverageStatus: 'complete', trackedRevenue: 50000000, totalRevenue: 50000000, trackedItems: 50, totalItems: 50, isComplete: true, warning: null },
      periodInfo: { currentStart: '2026-10-09', currentEnd: '2026-11-08', previousStart: '2026-09-09', previousEnd: '2026-10-09' }
    };

    mockDashboardService.getProfitSummary.mockReturnValue(of({ success: true, data: fullProfitSummary }));
    dashboard.loadDashboardData();

    expect(dashboard.profitSummary!.grossProfit.value).toBe(20000000);
    expect(dashboard.profitSummary!.grossMargin.value).toBe(40.0);
    expect(dashboard.profitSummary!.costCoverage.ratio).toBe(100);
    expect(dashboard.profitSummary!.costCoverage.isComplete).toBe(true);
  });
});
