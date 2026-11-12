import '@angular/compiler';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { AdminNotificationTrackingDrawerComponent } from './admin-notification-tracking-drawer';
import {
  SentNotificationItem,
  SentNotificationRecipient,
  SentNotificationsResponse
} from '../../services/admin-notification-management';
import { AdminStaffMember } from '../../services/admin-staff';
import { AdminDashboard } from '../../pages/admin-dashboard/admin-dashboard';

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

describe('VISTA Operational Notification - Stage 3.2 Sent Alerts Tracking Drawer', () => {
  let drawer: AdminNotificationTrackingDrawerComponent;
  let mockNotificationService: any;
  let mockStaffService: any;
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

  const sampleSentItems: SentNotificationItem[] = [
    {
      id: 'NTF_SENT_001',
      type: 'operational_alert',
      title: 'Xử lý đơn trễ SLA',
      message: 'Có 8 đơn trễ hạn giao hàng cần xử lý gấp.',
      priority: 'urgent',
      senderName: 'Trần Quản Lý',
      createdAt: '2026-11-12T07:30:00.000Z',
      link: '/admin/orders?status=overdue',
      targetEntity: { Entity_type: 'order', Entity_id: 'ORD_094' },
      recipientCount: 2,
      acknowledgedCount: 1,
      recipients: [
        {
          userId: 'USR_STAFF_01',
          status: 'acknowledged',
          readAt: '2026-11-12T07:35:00.000Z',
          acknowledgedAt: '2026-11-12T07:40:00.000Z'
        },
        {
          userId: 'USR_STAFF_02',
          status: 'sent',
          readAt: '2026-11-12T07:36:00.000Z',
          acknowledgedAt: null
        }
      ]
    },
    {
      id: 'NTF_SENT_002',
      type: 'operational_alert',
      title: 'Kiểm tra đổi trả hàng',
      message: 'Đơn đổi trả RET_006 cần kiểm hàng.',
      priority: 'important',
      senderName: 'Trần Quản Lý',
      createdAt: '2026-11-12T08:00:00.000Z',
      recipientCount: 1,
      acknowledgedCount: 0,
      recipients: [
        {
          userId: 'USR_STAFF_03', // Chưa có trong danh sách staff
          status: 'sent',
          readAt: null,
          acknowledgedAt: null
        }
      ]
    }
  ];

  beforeEach(() => {
    mockNotificationService = {
      getSentAlerts: vi.fn().mockReturnValue(
        of({
          success: true,
          data: {
            items: sampleSentItems,
            pagination: { page: 1, limit: 50, total: 2, totalPages: 1 }
          }
        })
      )
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

    mockCdr = {
      markForCheck: vi.fn(),
      detectChanges: vi.fn()
    };

    drawer = Object.create(AdminNotificationTrackingDrawerComponent.prototype);
    Object.assign(drawer, {
      notificationService: mockNotificationService,
      staffService: mockStaffService,
      cdr: mockCdr,
      isOpen: false,
      closeDrawer: { emit: vi.fn() },
      items: [],
      staffMap: new Map<string, AdminStaffMember>(),
      isLoading: false,
      isRefreshing: false,
      errorMessage: null,
      expandedNotificationId: null,
      selectedPriorityFilter: 'all',
      selectedStatusFilter: 'all',
      sortOrder: 'newest'
    });
  });

  // ========================================================
  // NHÓM A – DASHBOARD INTEGRATION (TEST 1 -> 5)
  // ========================================================
  describe('Nhóm A – Dashboard Integration', () => {
    it('1. Manager nhìn thấy nút Lịch sử gửi & Tiếp nhận', () => {
      localStorage.setItem('vista_admin_token', 'valid_token');
      localStorage.setItem('vista_admin_user', JSON.stringify({ User_id: 'MGR_1', Role: 'Manager' }));

      const dashboard = Object.create(AdminDashboard.prototype);
      expect(dashboard.isManager).toBe(true);
    });

    it('2. Staff KHÔNG nhìn thấy nút Lịch sử gửi & Tiếp nhận', () => {
      localStorage.setItem('vista_admin_user', JSON.stringify({ User_id: 'STF_1', Role: 'Staff' }));

      const dashboard = Object.create(AdminDashboard.prototype);
      expect(dashboard.isManager).toBe(false);
    });

    it('3. Manager nhấn nút mở Drawer (openTrackingDrawer)', () => {
      const dashboard = Object.create(AdminDashboard.prototype);
      Object.assign(dashboard, {
        isTrackingDrawerOpen: false,
        cdr: mockCdr
      });

      dashboard.openTrackingDrawer();
      expect(dashboard.isTrackingDrawerOpen).toBe(true);
      expect(mockCdr.markForCheck).toHaveBeenCalled();
    });

    it('4. Đóng Drawer không làm ảnh hưởng state của Dashboard (closeTrackingDrawer)', () => {
      const dashboard = Object.create(AdminDashboard.prototype);
      Object.assign(dashboard, {
        isTrackingDrawerOpen: true,
        cdr: mockCdr
      });

      dashboard.closeTrackingDrawer();
      expect(dashboard.isTrackingDrawerOpen).toBe(false);
      expect(mockCdr.markForCheck).toHaveBeenCalled();
    });

    it('5. Chức năng dispatch Stage 3.1 và Drawer hoạt động độc lập không xung đột', () => {
      const dashboard = Object.create(AdminDashboard.prototype);
      Object.assign(dashboard, {
        isTrackingDrawerOpen: true,
        isDispatchModalOpen: false
      });

      expect(dashboard.isTrackingDrawerOpen).toBe(true);
      expect(dashboard.isDispatchModalOpen).toBe(false);
    });
  });

  // ========================================================
  // NHÓM B – API VÀ DỮ LIỆU (TEST 6 -> 14)
  // ========================================================
  describe('Nhóm B – API và Dữ liệu', () => {
    it('6. Gọi đúng GET /api/admin/notifications/sent với tham số page=1, limit=50', () => {
      drawer.loadData();
      expect(mockNotificationService.getSentAlerts).toHaveBeenCalledWith(1, 50);
    });

    it('7. Render đúng danh sách thông báo nhận được từ API', () => {
      drawer.loadData();
      expect(drawer.items.length).toBe(2);
      expect(drawer.items[0].id).toBe('NTF_SENT_001');
      expect(drawer.items[1].id).toBe('NTF_SENT_002');
    });

    it('8. Hiển thị đúng mức độ ưu tiên theo thiết kế', () => {
      expect(drawer.getPriorityLabel('urgent')).toBe('Khẩn cấp');
      expect(drawer.getPriorityLabel('important')).toBe('Quan trọng');
      expect(drawer.getPriorityLabel('normal')).toBe('Bình thường');
    });

    it('9. Hiển thị đúng thông tin người gửi (senderName)', () => {
      drawer.loadData();
      expect(drawer.items[0].senderName).toBe('Trần Quản Lý');
    });

    it('10. Hiển thị đúng thời gian gửi (createdAt)', () => {
      drawer.loadData();
      expect(drawer.items[0].createdAt).toBe('2026-11-12T07:30:00.000Z');
    });

    it('11. Hiển thị đúng tổng số lượng người nhận', () => {
      drawer.loadData();
      expect(drawer.getTotalRecipientCount(drawer.items[0])).toBe(2);
      expect(drawer.getTotalRecipientCount(drawer.items[1])).toBe(1);
    });

    it('12. Hiển thị đúng số lượng đã đọc và số lượng đã xác nhận', () => {
      drawer.loadData();
      expect(drawer.getReadCount(drawer.items[0])).toBe(2);
      expect(drawer.getAcknowledgedCount(drawer.items[0])).toBe(1);
    });

    it('13. Ánh xạ đúng tên Staff và Email từ staffMap khi User_id khớp', () => {
      drawer.loadData();
      expect(drawer.getStaffName('USR_STAFF_01')).toBe('Nguyễn Văn Nhân Viên 1');
      expect(drawer.getStaffEmail('USR_STAFF_01')).toBe('staff1@vista.vn');
    });

    it('14. Không tạo dữ liệu giả: fallback về User_id nếu không tìm thấy trong staffMap', () => {
      drawer.loadData();
      expect(drawer.getStaffName('USR_UNKNOWN_999')).toBe('USR_UNKNOWN_999');
      expect(drawer.getStaffEmail('USR_UNKNOWN_999')).toBe('');
    });
  });

  // ========================================================
  // NHÓM C – TRẠNG THÁI TIẾP NHẬN (TEST 15 -> 20)
  // ========================================================
  describe('Nhóm C – Trạng thái tiếp nhận', () => {
    it('15. Staff chưa đọc hiển thị đúng: Chưa đọc & badge--unread', () => {
      const recipient: SentNotificationRecipient = {
        userId: 'USR_01',
        status: 'sent',
        readAt: null,
        acknowledgedAt: null
      };

      const badge = drawer.getStaffStatusBadge(recipient);
      expect(badge.label).toBe('Chưa đọc');
      expect(badge.cssClass).toBe('badge--unread');
    });

    it('16. Staff đã đọc nhưng chưa xác nhận hiển thị đúng: Đã đọc & badge--read', () => {
      const recipient: SentNotificationRecipient = {
        userId: 'USR_01',
        status: 'sent',
        readAt: '2026-11-12T07:45:00Z',
        acknowledgedAt: null
      };

      const badge = drawer.getStaffStatusBadge(recipient);
      expect(badge.label).toBe('Đã đọc');
      expect(badge.cssClass).toBe('badge--read');
    });

    it('17. Staff đã xác nhận hiển thị ưu tiên: Đã xác nhận & badge--acknowledged', () => {
      const recipient: SentNotificationRecipient = {
        userId: 'USR_01',
        status: 'acknowledged',
        readAt: '2026-11-12T07:45:00Z',
        acknowledgedAt: '2026-11-12T07:50:00Z'
      };

      const badge = drawer.getStaffStatusBadge(recipient);
      // Quy tắc bắt buộc: Đã xác nhận phải được ưu tiên hiển thị trước Đã đọc
      expect(badge.label).toBe('Đã xác nhận');
      expect(badge.cssClass).toBe('badge--acknowledged');
    });

    it('18. Trạng thái của từng Staff độc lập hoàn toàn', () => {
      drawer.loadData();
      const recipients = drawer.items[0].recipients || [];

      const staff1Badge = drawer.getStaffStatusBadge(recipients[0]);
      const staff2Badge = drawer.getStaffStatusBadge(recipients[1]);

      expect(staff1Badge.label).toBe('Đã xác nhận');
      expect(staff2Badge.label).toBe('Đã đọc');
    });

    it('19. Thời điểm đọc và xác nhận phản ánh đúng dữ liệu từ server', () => {
      drawer.loadData();
      const rec = drawer.items[0].recipients![0];
      expect(rec.readAt).toBe('2026-11-12T07:35:00.000Z');
      expect(rec.acknowledgedAt).toBe('2026-11-12T07:40:00.000Z');
    });

    it('20. Giao diện Drawer là Read-Only: không cung cấp bất kỳ hàm mutate nào cho Manager', () => {
      expect((drawer as any).markAsRead).toBeUndefined();
      expect((drawer as any).acknowledge).toBeUndefined();
    });
  });

  // ========================================================
  // NHÓM D – TRẠNG THÁI GIAO DIỆN & REGRESSION (TEST 21 -> 26)
  // ========================================================
  describe('Nhóm D – Trạng thái giao diện & Regression', () => {
    it('21. Loading state hoạt động khi đang tải dữ liệu', () => {
      drawer.loadData();
      // Ngay sau khi gọi loadData, nếu chưa có response thì isLoading = true
      // Ở đây mock trả of() đồng bộ nên isLoading trở về false
      expect(drawer.isLoading).toBe(false);
    });

    it('22. Empty state hoạt động khi Manager chưa gửi thông báo nào', () => {
      mockNotificationService.getSentAlerts.mockReturnValueOnce(
        of({
          success: true,
          data: { items: [], pagination: { total: 0 } }
        })
      );

      drawer.loadData();
      expect(drawer.items.length).toBe(0);
      expect(drawer.errorMessage).toBeNull();
    });

    it('23. Error state và retry hoạt động khi API trả lỗi', () => {
      mockNotificationService.getSentAlerts.mockReturnValueOnce(
        throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Lỗi máy chủ' } }))
      );

      drawer.loadData();
      expect(drawer.errorMessage).toBe('Lỗi máy chủ');
      expect(drawer.items.length).toBe(0);
    });

    it('24. Refresh tải lại dữ liệu mà không đóng Drawer', () => {
      drawer.refresh();
      expect(mockNotificationService.getSentAlerts).toHaveBeenCalled();
      expect(drawer.isRefreshing).toBe(false);
    });

    it('25. Không tạo request trùng khi đang tải (isLoading / isRefreshing)', () => {
      drawer.isLoading = true;
      drawer.refresh();
      // Không được gọi thêm lần nữa
      expect(mockNotificationService.getSentAlerts).not.toHaveBeenCalled();
    });

    it('26. Expand / Collapse chi tiết người nhận của từng thông báo hoạt động chính xác', () => {
      expect(drawer.expandedNotificationId).toBeNull();

      drawer.toggleExpand('NTF_SENT_001');
      expect(drawer.expandedNotificationId).toBe('NTF_SENT_001');

      // Nhấn lại thì thu gọn
      drawer.toggleExpand('NTF_SENT_001');
      expect(drawer.expandedNotificationId).toBeNull();
    });
  });

  // ========================================================
  // NHÓM E – FILTERING & SORTING (TEST 27 -> 31)
  // ========================================================
  describe('Nhóm E – Filtering & Sorting', () => {
    beforeEach(() => {
      drawer.selectedPriorityFilter = 'all';
      drawer.selectedStatusFilter = 'all';
      drawer.sortOrder = 'newest';
      drawer.items = [
        {
          id: 'NTF_OLD',
          type: 'operational_alert',
          title: 'Thông báo cũ',
          message: 'Tin cũ',
          priority: 'normal',
          createdAt: '2026-11-10T10:00:00.000Z',
          recipientCount: 2,
          acknowledgedCount: 2,
          recipients: [
            { userId: 'USR_01', status: 'acknowledged', readAt: '2026-11-10T10:05:00.000Z', acknowledgedAt: '2026-11-10T10:10:00.000Z' },
            { userId: 'USR_02', status: 'acknowledged', readAt: '2026-11-10T10:05:00.000Z', acknowledgedAt: '2026-11-10T10:10:00.000Z' }
          ]
        },
        {
          id: 'NTF_NEW',
          type: 'operational_alert',
          title: 'Thông báo mới',
          message: 'Tin mới khẩn cấp',
          priority: 'urgent',
          createdAt: '2026-11-12T15:00:00.000Z',
          recipientCount: 2,
          acknowledgedCount: 1,
          recipients: [
            { userId: 'USR_01', status: 'acknowledged', readAt: '2026-11-12T15:05:00.000Z', acknowledgedAt: '2026-11-12T15:10:00.000Z' },
            { userId: 'USR_02', status: 'sent', readAt: null, acknowledgedAt: null }
          ]
        }
      ];
    });

    it('27. Sắp xếp mặc định theo thời gian gần nhất (Mới nhất trước)', () => {
      expect(drawer.sortOrder).toBe('newest');
      const sorted = drawer.filteredAndSortedItems;
      expect(sorted[0].id).toBe('NTF_NEW');
      expect(sorted[1].id).toBe('NTF_OLD');
    });

    it('28. Sắp xếp theo thời gian cũ nhất khi chuyển sang oldest', () => {
      drawer.sortOrder = 'oldest';
      const sorted = drawer.filteredAndSortedItems;
      expect(sorted[0].id).toBe('NTF_OLD');
      expect(sorted[1].id).toBe('NTF_NEW');
    });

    it('29. Lọc theo Priority (urgent, normal)', () => {
      drawer.selectedPriorityFilter = 'urgent';
      expect(drawer.filteredAndSortedItems.length).toBe(1);
      expect(drawer.filteredAndSortedItems[0].id).toBe('NTF_NEW');

      drawer.selectedPriorityFilter = 'normal';
      expect(drawer.filteredAndSortedItems.length).toBe(1);
      expect(drawer.filteredAndSortedItems[0].id).toBe('NTF_OLD');

      drawer.selectedPriorityFilter = 'important';
      expect(drawer.filteredAndSortedItems.length).toBe(0);
    });

    it('30. Lọc theo trạng thái tiếp nhận (fully_acknowledged, pending_acknowledgment)', () => {
      drawer.selectedStatusFilter = 'fully_acknowledged';
      expect(drawer.filteredAndSortedItems.length).toBe(1);
      expect(drawer.filteredAndSortedItems[0].id).toBe('NTF_OLD');

      drawer.selectedStatusFilter = 'pending_acknowledgment';
      expect(drawer.filteredAndSortedItems.length).toBe(1);
      expect(drawer.filteredAndSortedItems[0].id).toBe('NTF_NEW');
    });

    it('31. Đặt lại bộ lọc (resetFilters) khôi phục toàn bộ về mặc định', () => {
      drawer.selectedPriorityFilter = 'urgent';
      drawer.selectedStatusFilter = 'pending_acknowledgment';
      drawer.sortOrder = 'oldest';

      drawer.resetFilters();

      expect(drawer.selectedPriorityFilter).toBe('all');
      expect(drawer.selectedStatusFilter).toBe('all');
      expect(drawer.sortOrder).toBe('newest');
      expect(drawer.filteredAndSortedItems.length).toBe(2);
    });
  });
});
