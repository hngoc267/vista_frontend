import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminDashboard } from './admin-dashboard';
import { OperationalAlert } from '../../services/admin-dashboard';
import { AdminStaffMember } from '../../services/admin-staff';
import { DispatchAlertPayload, DispatchAlertResponse } from '../../services/admin-notification-management';

// Polyfill localStorage
if (typeof globalThis.localStorage === 'undefined') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, String(val)),
    removeItem: (key: string) => store.delete(key),
    clear: () => store.clear(),
    key: (idx: number) => Array.from(store.keys())[idx] ?? null,
    length: store.size
  } as any;
}

describe('VISTA Operational Notification - Stage 3.1 Dashboard Dispatch Modal Integration', () => {
  let dashboard: AdminDashboard;
  let mockDashboardService: any;
  let mockNotificationManagement: any;
  let mockStaffService: any;
  let mockRouter: any;
  let mockCdr: any;

  const sampleStaffList: AdminStaffMember[] = [
    {
      User_id: 'USR_STAFF_01',
      Full_name: 'Nguyễn Văn Nhân Viên 1',
      Username: 'staff1',
      Email: 'staff1@vista.vn',
      Phone_number: '0901234567',
      Role: 'Staff',
      Status: 'active',
      Created_at: '2026-01-01'
    },
    {
      User_id: 'USR_STAFF_02',
      Full_name: 'Trần Thị Nhân Viên 2',
      Username: 'staff2',
      Email: 'staff2@vista.vn',
      Phone_number: '0901234568',
      Role: 'Staff',
      Status: 'active',
      Created_at: '2026-01-02'
    }
  ];

  const criticalAlert: OperationalAlert = {
    id: 'sla_overdue_orders',
    level: 'critical',
    title: 'Đơn hàng quá hạn SLA xử lý kho',
    message: 'Hiện có 8 đơn hàng đang trong trạng thái xử lý đã vượt quá thời hạn SLA cam kết.',
    count: 8,
    sampleIds: ['ORD_094', 'ORD_095'],
    link: '/admin/orders?status=overdue',
    actionText: 'Xem đơn quá hạn'
  };

  const warningAlert: OperationalAlert = {
    id: 'pending_returns',
    level: 'warning',
    title: 'Yêu cầu đổi trả đang chờ xử lý',
    message: 'Có 3 yêu cầu đổi trả đang ở trạng thái Chờ duyệt.',
    count: 3,
    sampleIds: ['RET_006'],
    link: '/admin/returns?status=pending',
    actionText: 'Duyệt yêu cầu ngay'
  };

  const infoAlert: OperationalAlert = {
    id: 'pending_bank_orders',
    level: 'info',
    title: 'Đơn hàng chuyển khoản chờ thanh toán',
    message: 'Có 5 đơn hàng chuyển khoản chờ đối soát.',
    count: 5,
    sampleIds: ['ORD_099'],
    link: '/admin/orders?status=pending_payment&paymentType=BankTransfer',
    actionText: 'Xem đơn chuyển khoản'
  };

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('vista_admin_token', 'valid_mock_jwt');
    localStorage.setItem('vista_admin_user', JSON.stringify({ User_id: 'MGR_01', Role: 'Manager' }));

    mockDashboardService = {
      getSummaryCards: vi.fn().mockReturnValue(of({ success: true, data: {} })),
      getRevenueTrend: vi.fn().mockReturnValue(of({ success: true, data: { points: [] } })),
      getOrderPipeline: vi.fn().mockReturnValue(of({ success: true, data: { total: 0, pipeline: [] } })),
      getPaymentBreakdown: vi.fn().mockReturnValue(of({ success: true, data: { totalPayments: 0, byStatus: [], byMethod: [] } })),
      getCarrierPerformance: vi.fn().mockReturnValue(of({ success: true, data: { totalDeliveries: 0, partners: [] } })),
      getOperationalAlerts: vi.fn().mockReturnValue(of({ success: true, data: [criticalAlert, warningAlert] })),
      getProfitSummary: vi.fn().mockReturnValue(of({ success: true, data: {} })),
      getProfitTrend: vi.fn().mockReturnValue(of({ success: true, data: { points: [] } }))
    };

    mockNotificationManagement = {
      dispatchAlert: vi.fn().mockReturnValue(
        of({
          success: true,
          message: 'Đã phát thông báo vận hành thành công',
          isDuplicate: false,
          data: { id: 'NTF_TEST_1' }
        })
      ),
      getSentAlerts: vi.fn().mockReturnValue(of({ success: true, data: { items: [], pagination: {} } }))
    };

    mockStaffService = {
      getStaffList: vi.fn().mockReturnValue(
        of({
          success: true,
          data: {
            items: sampleStaffList,
            total: 2,
            page: 1,
            limit: 100,
            system_total: 2
          }
        })
      )
    };

    mockRouter = {
      navigate: vi.fn(),
      navigateByUrl: vi.fn()
    };

    mockCdr = {
      detectChanges: vi.fn(),
      markForCheck: vi.fn()
    };

    dashboard = Object.create(AdminDashboard.prototype);
    Object.assign(dashboard, {
      dashboardService: mockDashboardService,
      notificationManagement: mockNotificationManagement,
      staffService: mockStaffService,
      router: mockRouter,
      cdr: mockCdr,
      ngZone: { run: (fn: any) => fn() },
      appRef: { tick: vi.fn() },
      selectedPeriod: '30days',
      activeTab: 'overview',
      isLoading: false,
      isUpdating: false,
      errorMessage: null,
      alerts: [criticalAlert, warningAlert, infoAlert],

      // State modal dispatch
      isDispatchModalOpen: false,
      selectedAlertForDispatch: null,
      dispatchTitle: '',
      dispatchMessage: '',
      dispatchPriority: 'normal',
      dispatchRecipientMode: 'all_staff',
      dispatchRecipientId: '',
      dispatchTargetEntity: { entity_type: 'system', entity_id: '' },
      dispatchLink: '',
      dispatchConfirmResend: false,
      isDispatching: false,
      dispatchError: null,
      dispatchSuccessMessage: null,
      isDuplicateRecentWarning: false,
      activeStaffList: [],
      isLoadingStaffList: false,
      staffListError: null
    });
  });

  // ========================================================
  // NHÓM A – DASHBOARD INTEGRATION (TEST 1 -> 4)
  // ========================================================
  describe('Nhóm A – Dashboard Integration', () => {
    it('A1 – Manager nhìn thấy nút Gửi thông báo (isManager = true)', () => {
      localStorage.setItem('vista_admin_user', JSON.stringify({ User_id: 'MGR_01', Role: 'Manager' }));
      expect(dashboard.isManager).toBe(true);
    });

    it('A2 – Staff KHÔNG nhìn thấy nút Gửi thông báo (isManager = false)', () => {
      localStorage.setItem('vista_admin_user', JSON.stringify({ User_id: 'STF_01', Role: 'Staff' }));
      expect(dashboard.isManager).toBe(false);
    });

    it('A3 – Nhấn nút mở đúng Modal theo cảnh báo được chọn', () => {
      dashboard.openDispatchModal(criticalAlert);

      expect(dashboard.isDispatchModalOpen).toBe(true);
      expect(dashboard.selectedAlertForDispatch).toBe(criticalAlert);
      expect(dashboard.dispatchTitle).toBe(criticalAlert.title);
      expect(dashboard.dispatchMessage).toBe(criticalAlert.message);
      expect(dashboard.dispatchLink).toBe(criticalAlert.link);
      expect(dashboard.dispatchPriority).toBe('urgent');
      expect(dashboard.dispatchTargetEntity.entity_type).toBe('order');
      expect(dashboard.dispatchTargetEntity.entity_id).toBe('ORD_094');
    });

    it('A4 – Nút Xem chi tiết cũ vẫn phân tích URL và điều hướng chính xác', () => {
      const route = dashboard.getAlertRoute('/admin/orders?status=overdue');
      const queryParams = dashboard.getAlertQueryParams('/admin/orders?status=overdue');

      expect(route).toBe('/admin/orders');
      expect(queryParams).toEqual({ status: 'overdue' });
    });
  });

  // ========================================================
  // NHÓM B – MODAL FORM (TEST 5 -> 13)
  // ========================================================
  describe('Nhóm B – Modal Form Logic & Mapping', () => {
    it('B5 – Tiêu đề được điền trước đúng từ Alert', () => {
      dashboard.openDispatchModal(warningAlert);
      expect(dashboard.dispatchTitle).toBe('Yêu cầu đổi trả đang chờ xử lý');
    });

    it('B6 – Nội dung được điền trước đúng từ Alert', () => {
      dashboard.openDispatchModal(warningAlert);
      expect(dashboard.dispatchMessage).toBe('Có 3 yêu cầu đổi trả đang ở trạng thái Chờ duyệt.');
    });

    it('B7 – Mapping priority chính xác: critical -> urgent, warning -> important, info -> normal', () => {
      dashboard.openDispatchModal(criticalAlert);
      expect(dashboard.dispatchPriority).toBe('urgent');

      dashboard.openDispatchModal(warningAlert);
      expect(dashboard.dispatchPriority).toBe('important');

      dashboard.openDispatchModal(infoAlert);
      expect(dashboard.dispatchPriority).toBe('normal');
    });

    it('B8 – Manager có thể chỉnh sửa tiêu đề và nội dung', () => {
      dashboard.openDispatchModal(criticalAlert);
      dashboard.dispatchTitle = 'Chỉ đạo khẩn cấp ca sáng';
      dashboard.dispatchMessage = 'Yêu cầu toàn bộ kho tập trung đóng gói';

      expect(dashboard.dispatchTitle).toBe('Chỉ đạo khẩn cấp ca sáng');
      expect(dashboard.dispatchMessage).toBe('Yêu cầu toàn bộ kho tập trung đóng gói');
    });

    it('B9 – Validation tiêu đề và nội dung bắt buộc hoạt động', () => {
      dashboard.openDispatchModal(criticalAlert);

      // Tiêu đề rỗng
      dashboard.dispatchTitle = '   ';
      dashboard.submitDispatch();
      expect(dashboard.dispatchError).toBe('Vui lòng nhập tiêu đề thông báo.');
      expect(mockNotificationManagement.dispatchAlert).not.toHaveBeenCalled();

      // Nội dung rỗng
      dashboard.dispatchTitle = 'Tiêu đề hợp lệ';
      dashboard.dispatchMessage = '   ';
      dashboard.submitDispatch();
      expect(dashboard.dispatchError).toBe('Vui lòng nhập nội dung thông báo.');
      expect(mockNotificationManagement.dispatchAlert).not.toHaveBeenCalled();
    });

    it('B10 – Validation giới hạn ký tự hoạt động (title <= 200, message <= 1000)', () => {
      dashboard.openDispatchModal(criticalAlert);

      dashboard.dispatchTitle = 'A'.repeat(201);
      dashboard.submitDispatch();
      expect(dashboard.dispatchError).toBe('Tiêu đề không được vượt quá 200 ký tự.');

      dashboard.dispatchTitle = 'Tiêu đề hợp lệ';
      dashboard.dispatchMessage = 'M'.repeat(1001);
      dashboard.submitDispatch();
      expect(dashboard.dispatchError).toBe('Nội dung không được vượt quá 1000 ký tự.');
    });

    it('B11 – Chọn toàn bộ Staff hoạt động (all_staff)', () => {
      dashboard.openDispatchModal(criticalAlert);
      dashboard.onRecipientModeChange('all_staff');

      expect(dashboard.dispatchRecipientMode).toBe('all_staff');
      expect(dashboard.dispatchRecipientId).toBe('');
    });

    it('B12 – Chọn Staff cụ thể hoạt động và tải danh sách Staff active', () => {
      dashboard.openDispatchModal(criticalAlert);
      dashboard.onRecipientModeChange('specific_staff');

      expect(dashboard.dispatchRecipientMode).toBe('specific_staff');
      expect(mockStaffService.getStaffList).toHaveBeenCalledWith({ role: 'Staff', status: 'active', limit: 100 });
      expect(dashboard.activeStaffList.length).toBe(2);
      expect(dashboard.activeStaffList[0].User_id).toBe('USR_STAFF_01');
    });

    it('B13 – Không gửi được khi chọn specific_staff nhưng chưa chọn nhân viên', () => {
      dashboard.openDispatchModal(criticalAlert);
      dashboard.onRecipientModeChange('specific_staff');
      dashboard.dispatchRecipientId = ''; // Chưa chọn

      dashboard.submitDispatch();
      expect(dashboard.dispatchError).toBe('Vui lòng chọn một nhân viên Staff nhận thông báo.');
      expect(mockNotificationManagement.dispatchAlert).not.toHaveBeenCalled();
    });
  });

  // ========================================================
  // NHÓM C – DISPATCH API & ERROR HANDLING (TEST 14 -> 19)
  // ========================================================
  describe('Nhóm C – Dispatch API & Error Handling', () => {
    it('C14 – Request body gửi đi khớp chính xác Backend contract', () => {
      dashboard.openDispatchModal(criticalAlert);
      dashboard.dispatchTitle = 'Xử lý đơn quá hạn';
      dashboard.dispatchMessage = 'Chi tiết đơn ORD_094';
      dashboard.dispatchPriority = 'urgent';
      dashboard.dispatchRecipientMode = 'all_staff';

      dashboard.submitDispatch();

      expect(mockNotificationManagement.dispatchAlert).toHaveBeenCalledWith({
        title: 'Xử lý đơn quá hạn',
        message: 'Chi tiết đơn ORD_094',
        priority: 'urgent',
        recipient_mode: 'all_staff',
        recipient_ids: undefined,
        target_entity: { entity_type: 'order', entity_id: 'ORD_094' },
        link: '/admin/orders?status=overdue',
        confirm_resend: false
      });
    });

    it('C15 – Gửi thành công: hiển thị thông báo thành công và chuẩn bị đóng Modal', () => {
      dashboard.openDispatchModal(criticalAlert);
      dashboard.submitDispatch();

      expect(dashboard.isDispatching).toBe(false);
      expect(dashboard.dispatchSuccessMessage).toBe('Đã phát thông báo vận hành thành công');
      expect(dashboard.dispatchError).toBeNull();
    });

    it('C16 – Chống gửi lặp: chặn nhấn nút liên tục khi request đang bay (isDispatching)', () => {
      dashboard.openDispatchModal(criticalAlert);
      dashboard.isDispatching = true; // Request 1 đang bay

      dashboard.submitDispatch(); // Request 2 cố tình gọi

      expect(mockNotificationManagement.dispatchAlert).not.toHaveBeenCalled();
    });

    it('C17 – Xử lý HTTP 409 DUPLICATE_RECENT_ALERT: bật cảnh báo và cho phép Manager tick confirm_resend', () => {
      const duplicateError = new HttpErrorResponse({
        status: 409,
        error: {
          success: false,
          code: 'DUPLICATE_RECENT_ALERT',
          message: "Thông báo có cùng tiêu đề vừa được gửi cách đây chưa đầy 1 phút. Gửi kèm 'confirm_resend: true' nếu bạn thực sự muốn gửi tiếp."
        }
      });

      mockNotificationManagement.dispatchAlert.mockReturnValueOnce(throwError(() => duplicateError));

      dashboard.openDispatchModal(criticalAlert);
      dashboard.submitDispatch();

      expect(dashboard.isDispatching).toBe(false);
      expect(dashboard.isDuplicateRecentWarning).toBe(true);
      expect(dashboard.dispatchError).toContain('cách đây chưa đầy 1 phút');
      expect(dashboard.isDispatchModalOpen).toBe(true); // Modal vẫn mở để Manager tick gửi lại
    });

    it('C18 – Xử lý HTTP 400 / 403 / 500: hiển thị thông báo lỗi thân thiện', () => {
      const serverError = new HttpErrorResponse({
        status: 500,
        error: { success: false, message: 'Lỗi hệ thống khi phát thông báo' }
      });

      mockNotificationManagement.dispatchAlert.mockReturnValueOnce(throwError(() => serverError));

      dashboard.openDispatchModal(criticalAlert);
      dashboard.submitDispatch();

      expect(dashboard.isDispatching).toBe(false);
      expect(dashboard.dispatchError).toBe('Lỗi hệ thống khi phát thông báo');
      expect(dashboard.isDispatchModalOpen).toBe(true);
    });

    it('C19 – Nội dung Manager đang soạn thảo được giữ nguyên khi request thất bại', () => {
      const err = new HttpErrorResponse({ status: 500, error: { message: 'Lỗi mạng' } });
      mockNotificationManagement.dispatchAlert.mockReturnValueOnce(throwError(() => err));

      dashboard.openDispatchModal(criticalAlert);
      dashboard.dispatchTitle = 'Tiêu đề quan trọng';
      dashboard.dispatchMessage = 'Nội dung rất dài không thể mất';

      dashboard.submitDispatch();

      expect(dashboard.dispatchTitle).toBe('Tiêu đề quan trọng');
      expect(dashboard.dispatchMessage).toBe('Nội dung rất dài không thể mất');
      expect(dashboard.isDispatchModalOpen).toBe(true);
    });
  });

  // ========================================================
  // NHÓM D – REGRESSION & COMPATIBILITY (TEST 20 -> 23)
  // ========================================================
  describe('Nhóm D – Regression & Compatibility', () => {
    it('D20 – Dashboard KPI và biểu đồ không bị ảnh hưởng bởi modal state', () => {
      dashboard.openDispatchModal(criticalAlert);
      expect(dashboard.selectedPeriod).toBe('30days');
      expect(dashboard.activeTab).toBe('overview');
      expect(dashboard.alerts.length).toBe(3);
    });

    it('D21 – Target Entity suy luận chính xác: pending_returns -> return, sla_overdue_orders -> order', () => {
      dashboard.openDispatchModal(warningAlert);
      expect(dashboard.dispatchTargetEntity.entity_type).toBe('return');
      expect(dashboard.dispatchTargetEntity.entity_id).toBe('RET_006');

      dashboard.openDispatchModal(infoAlert);
      expect(dashboard.dispatchTargetEntity.entity_type).toBe('order');
      expect(dashboard.dispatchTargetEntity.entity_id).toBe('ORD_099');
    });

    it('D22 – closeDispatchModal đóng modal an toàn và dọn dẹp state', () => {
      dashboard.openDispatchModal(criticalAlert);
      expect(dashboard.isDispatchModalOpen).toBe(true);

      dashboard.closeDispatchModal();
      expect(dashboard.isDispatchModalOpen).toBe(false);
      expect(dashboard.selectedAlertForDispatch).toBeNull();
      expect(dashboard.dispatchError).toBeNull();
    });

    it('D23 – closeDispatchModal không cho đóng khi isDispatching = true để bảo vệ request', () => {
      dashboard.openDispatchModal(criticalAlert);
      dashboard.isDispatching = true;

      dashboard.closeDispatchModal();
      expect(dashboard.isDispatchModalOpen).toBe(true); // Vẫn mở
    });
  });
});
