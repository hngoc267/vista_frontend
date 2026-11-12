import '@angular/compiler';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { of, BehaviorSubject, Subject, Subscription } from 'rxjs';
import {
  NotificationCenterService,
  AppNotification,
  NotificationPriority,
  NotificationStatus
} from '../../services/notification-center.service';
import { NotificationBellComponent } from './notification-bell';

// Polyfill localStorage cho node vitest nếu cần
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

// Mock socket.io-client
let mockSocketInstance: any;
vi.mock('socket.io-client', () => {
  return {
    io: vi.fn(() => {
      mockSocketInstance = {
        on: vi.fn(),
        io: { on: vi.fn(), removeAllListeners: vi.fn() },
        removeAllListeners: vi.fn(),
        disconnect: vi.fn()
      };
      return mockSocketInstance;
    })
  };
});

function createMockService(mockHttp?: any) {
  const service = Object.create(NotificationCenterService.prototype);
  const http = mockHttp || {
    get: vi.fn().mockReturnValue(of({ success: true, data: { items: [], unreadCount: 0 } })),
    patch: vi.fn().mockReturnValue(of({ success: true }))
  };
  const zone = { run: vi.fn((fn: () => any) => fn()) };
  const orderRealtime = { emit: vi.fn() };

  Object.assign(service, {
    http,
    zone,
    orderRealtime,
    apiUrl: 'http://localhost:5000/api/notifications',
    items$: new BehaviorSubject<AppNotification[]>([]),
    unreadCount$: new BehaviorSubject<number>(0),
    incoming$: new Subject<AppNotification>(),
    token: ''
  });

  return { service, http, zone };
}

function createMockComponent(service: NotificationCenterService, mockRouter?: any, mockCdr?: any) {
  const comp = Object.create(NotificationBellComponent.prototype);
  const router = mockRouter || { navigateByUrl: vi.fn() };
  const cdr = mockCdr || { markForCheck: vi.fn(), detectChanges: vi.fn() };

  Object.assign(comp, {
    center: service,
    router,
    host: { nativeElement: {} },
    cdr,
    subscriptions: new Subscription(),
    items: [],
    unreadCount: 0,
    isOpen: false,
    toast: null,
    token: null,
    variant: 'light'
  });

  return { comp, router, cdr };
}

describe('VISTA Operational Notification System - Frontend Integration (Stage 2.2)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================================
  // GROUP A: Contract Mapping & Models (6 tests)
  // ========================================================
  describe('Group A: Contract Mapping & Models', () => {
    it('A1 – Khớp đầy đủ contract thông báo vận hành từ Manager đến Staff', () => {
      const operationalAlert: AppNotification = {
        id: '67332211aabbccddeeff0011',
        type: 'operational_alert',
        title: 'Cảnh báo tồn đơn hàng trễ SLA',
        message: 'Có 8 đơn trễ SLA giao vận cần xử lý gấp',
        orderId: '',
        link: '/admin/orders?filter=delayed',
        createdAt: '2026-11-12T07:00:00.000Z',
        isRead: false,
        audience: 'staff_operational',
        priority: 'urgent',
        senderId: '67330000aabbccddeeff9999',
        senderName: 'Nguyễn Văn Quản Lý',
        status: 'sent',
        targetEntity: {
          Entity_type: 'Order',
          Entity_id: 'ORD_SLA_001'
        }
      };

      expect(operationalAlert.id).toBe('67332211aabbccddeeff0011');
      expect(operationalAlert.type).toBe('operational_alert');
      expect(operationalAlert.priority).toBe('urgent');
      expect(operationalAlert.senderName).toBe('Nguyễn Văn Quản Lý');
      expect(operationalAlert.senderId).toBe('67330000aabbccddeeff9999');
      expect(operationalAlert.status).toBe('sent');
      expect(operationalAlert.targetEntity?.Entity_type).toBe('Order');
      expect(operationalAlert.targetEntity?.Entity_id).toBe('ORD_SLA_001');
    });

    it('A2 – Hỗ trợ đầy đủ 3 mức độ ưu tiên (urgent, important, normal) và fallback khi thiếu', () => {
      const urgentItem: AppNotification = {
        id: '1',
        type: 'operational_alert',
        title: 'T1',
        message: 'M1',
        orderId: '',
        link: '',
        createdAt: '2026-11-12T00:00:00Z',
        isRead: false,
        priority: 'urgent'
      };
      const importantItem: AppNotification = { ...urgentItem, id: '2', priority: 'important' };
      const normalItem: AppNotification = { ...urgentItem, id: '3', priority: 'normal' };
      const noPriorityItem: AppNotification = { ...urgentItem, id: '4', priority: undefined };

      expect(urgentItem.priority).toBe('urgent');
      expect(importantItem.priority).toBe('important');
      expect(normalItem.priority).toBe('normal');
      expect(noPriorityItem.priority).toBeUndefined();
    });

    it('A3 – Hỗ trợ cả 2 trạng thái vận hành: sent và acknowledged', () => {
      const sentItem: AppNotification = {
        id: '1',
        type: 'operational_alert',
        title: 'T1',
        message: 'M1',
        orderId: '',
        link: '',
        createdAt: '2026-11-12T00:00:00Z',
        isRead: false,
        status: 'sent'
      };
      const ackItem: AppNotification = {
        ...sentItem,
        id: '2',
        status: 'acknowledged',
        acknowledgedAt: '2026-11-12T07:15:00Z'
      };

      expect(sentItem.status).toBe('sent');
      expect(ackItem.status).toBe('acknowledged');
      expect(ackItem.acknowledgedAt).toBe('2026-11-12T07:15:00Z');
    });

    it('A4 – Lưu trữ và truy xuất đúng targetEntity (Entity_type và Entity_id)', () => {
      const itemWithEntity: AppNotification = {
        id: '1',
        type: 'operational_alert',
        title: 'Đổi trả cần duyệt',
        message: 'Đơn đổi trả RET_002 đang chờ kiểm tra',
        orderId: '',
        link: '/admin/returns/RET_002',
        createdAt: '2026-11-12T00:00:00Z',
        isRead: false,
        targetEntity: {
          Entity_type: 'ReturnOrder',
          Entity_id: 'RET_002'
        }
      };

      expect(itemWithEntity.targetEntity).toBeDefined();
      expect(itemWithEntity.targetEntity?.Entity_type).toBe('ReturnOrder');
      expect(itemWithEntity.targetEntity?.Entity_id).toBe('RET_002');
    });

    it('A5 – Backward compatibility: thông báo cũ (order, general) không có priority/status vẫn hoạt động mượt mà', () => {
      const legacyItem: AppNotification = {
        id: 'legacy_01',
        type: 'order',
        title: 'Đơn hàng mới',
        message: 'Khách hàng vừa đặt đơn #ORD_123',
        orderId: 'ORD_123',
        link: '/admin/orders/ORD_123',
        createdAt: '2026-11-11T12:00:00.000Z',
        isRead: true
      };

      expect(legacyItem.type).toBe('order');
      expect(legacyItem.orderId).toBe('ORD_123');
      expect(legacyItem.priority).toBeUndefined();
      expect(legacyItem.status).toBeUndefined();
      expect(legacyItem.senderName).toBeUndefined();
    });

    it('A6 – Lưu trữ đúng thông tin người gửi senderId và senderName', () => {
      const itemWithSender: AppNotification = {
        id: '1',
        type: 'operational_alert',
        title: 'T1',
        message: 'M1',
        orderId: '',
        link: '',
        createdAt: '2026-11-12T00:00:00Z',
        isRead: false,
        senderId: 'user_manager_001',
        senderName: 'Trưởng ca Kho vận'
      };

      expect(itemWithSender.senderId).toBe('user_manager_001');
      expect(itemWithSender.senderName).toBe('Trưởng ca Kho vận');
    });
  });

  // ========================================================
  // GROUP B: Realtime & Deduplication (6 tests)
  // ========================================================
  describe('Group B: Realtime & Deduplication', () => {
    it('B1 – Socket event notification:new cập nhật items$ và unreadCount$', () => {
      const { service } = createMockService();
      const newAlert: AppNotification = {
        id: 'notif_rt_1',
        type: 'operational_alert',
        title: 'Cảnh báo mới',
        message: 'Nội dung cảnh báo',
        orderId: '',
        link: '',
        createdAt: '2026-11-12T08:00:00Z',
        isRead: false,
        priority: 'urgent',
        status: 'sent'
      };

      (service as any).receive(newAlert);

      expect(service.items$.value.length).toBe(1);
      expect(service.items$.value[0].id).toBe('notif_rt_1');
      expect(service.unreadCount$.value).toBe(1);
    });

    it('B2 – Deduplication: Nhận cùng một notification.id 2 lần qua socket chỉ lưu 1 bản', () => {
      const { service } = createMockService();
      const alert: AppNotification = {
        id: 'dup_notif_1',
        type: 'operational_alert',
        title: 'Cảnh báo trùng',
        message: 'Test duplicate socket',
        orderId: '',
        link: '',
        createdAt: '2026-11-12T08:00:00Z',
        isRead: false
      };

      (service as any).receive(alert);
      (service as any).receive(alert);

      expect(service.items$.value.length).toBe(1);
      expect(service.unreadCount$.value).toBe(1);
    });

    it('B3 – Deduplication giữa REST load() và Realtime socket không làm nhân đôi bản ghi', () => {
      const mockRestItem: AppNotification = {
        id: 'sync_01',
        type: 'operational_alert',
        title: 'Thông báo từ REST',
        message: 'Nội dung',
        orderId: '',
        link: '',
        createdAt: '2026-11-12T08:00:00Z',
        isRead: false
      };

      const mockHttp = {
        get: vi.fn().mockReturnValue(of({
          success: true,
          data: {
            items: [mockRestItem],
            unreadCount: 1
          }
        }))
      };

      const { service } = createMockService(mockHttp);
      (service as any).token = 'mock_jwt_token';

      // Giả lập realtime đã nhận trước thông báo này
      (service as any).receive(mockRestItem);
      expect(service.items$.value.length).toBe(1);

      // REST load() hoàn thành
      service.load();

      // Kiểm tra danh sách sau load() không bị duplicate
      expect(service.items$.value.length).toBe(1);
      expect(service.items$.value[0].id).toBe('sync_01');
    });

    it('B4 – Danh sách thông báo được sắp xếp theo thời gian mới nhất lên đầu', () => {
      const oldItem: AppNotification = {
        id: 'item_old',
        type: 'order',
        title: 'Đơn cũ',
        message: '',
        orderId: '',
        link: '',
        createdAt: '2026-11-12T06:00:00Z',
        isRead: true
      };
      const newItem: AppNotification = {
        id: 'item_new',
        type: 'operational_alert',
        title: 'Cảnh báo mới',
        message: '',
        orderId: '',
        link: '',
        createdAt: '2026-11-12T09:00:00Z',
        isRead: false
      };

      const mockHttp = {
        get: vi.fn().mockReturnValue(of({
          success: true,
          data: {
            items: [oldItem, newItem], // API trả không đúng thứ tự
            unreadCount: 1
          }
        }))
      };

      const { service } = createMockService(mockHttp);
      (service as any).token = 'mock_jwt_token';

      service.load();

      expect(service.items$.value[0].id).toBe('item_new');
      expect(service.items$.value[1].id).toBe('item_old');
    });

    it('B5 – Tính toán unreadCount chính xác: không tăng khi nhận thông báo đã đọc', () => {
      const { service } = createMockService();
      const readAlert: AppNotification = {
        id: 'already_read_1',
        type: 'operational_alert',
        title: 'Đã đọc sẵn',
        message: '',
        orderId: '',
        link: '',
        createdAt: '2026-11-12T08:00:00Z',
        isRead: true
      };

      (service as any).receive(readAlert);

      expect(service.items$.value.length).toBe(1);
      expect(service.unreadCount$.value).toBe(0); // Không tăng vì isRead là true
    });

    it('B6 – Realtime phát subject incoming$ để kích hoạt Toast thông báo', () => {
      const { service } = createMockService();
      let emittedNotification: AppNotification | null = null;
      service.incoming$.subscribe((item) => {
        emittedNotification = item;
      });

      const alert: AppNotification = {
        id: 'toast_alert_1',
        type: 'operational_alert',
        title: 'Khẩn cấp',
        message: 'Có sự cố',
        orderId: '',
        link: '',
        createdAt: '2026-11-12T08:00:00Z',
        isRead: false,
        priority: 'urgent'
      };

      (service as any).receive(alert);

      expect(emittedNotification).not.toBeNull();
      expect((emittedNotification as any)?.id).toBe('toast_alert_1');
      expect((emittedNotification as any)?.priority).toBe('urgent');
    });
  });

  // ========================================================
  // GROUP C: UI Rendering & Component Helpers (5 tests)
  // ========================================================
  describe('Group C: UI Rendering & Component Helpers', () => {
    it('C1 – getPriorityLabel trả đúng nhãn tiếng Việt theo thiết kế', () => {
      const { service } = createMockService();
      const { comp } = createMockComponent(service);

      expect(comp.getPriorityLabel('urgent')).toBe('Khẩn cấp');
      expect(comp.getPriorityLabel('important')).toBe('Quan trọng');
      expect(comp.getPriorityLabel('normal')).toBe('Bình thường');
      expect(comp.getPriorityLabel(undefined)).toBe('');
    });

    it('C2 – getStatusLabel trả đúng nhãn tiếng Việt theo thiết kế', () => {
      const { service } = createMockService();
      const { comp } = createMockComponent(service);

      expect(comp.getStatusLabel('acknowledged')).toBe('Đã tiếp nhận');
      expect(comp.getStatusLabel('sent')).toBe('Chưa tiếp nhận');
      expect(comp.getStatusLabel(undefined)).toBe('');
    });

    it('C3 – badgeText hiển thị 0, số đếm và 99+ chính xác', () => {
      const { service } = createMockService();
      const { comp } = createMockComponent(service);

      comp.unreadCount = 0;
      expect(comp.badgeText).toBe('0');

      comp.unreadCount = 5;
      expect(comp.badgeText).toBe('5');

      comp.unreadCount = 100;
      expect(comp.badgeText).toBe('99+');
    });

    it('C4 – Độc lập giữa trạng thái đọc (isRead) và tiếp nhận (status)', () => {
      const mockHttp = {
        get: vi.fn().mockReturnValue(of({ success: true, data: { items: [], unreadCount: 0 } })),
        patch: vi.fn().mockReturnValue(of({ success: true }))
      };
      const { service } = createMockService(mockHttp);
      (service as any).token = 'mock_jwt_token';

      const unreadSentItem: AppNotification = {
        id: 'notif_independent_1',
        type: 'operational_alert',
        title: 'Cần tiếp nhận',
        message: 'Nội dung',
        orderId: '',
        link: '',
        createdAt: '2026-11-12T08:00:00Z',
        isRead: false,
        status: 'sent'
      };

      service.items$.next([unreadSentItem]);
      service.unreadCount$.next(1);

      // Đánh dấu đã đọc
      service.markAsRead(unreadSentItem);

      // isRead phải chuyển thành true, nhưng status vẫn giữ nguyên 'sent' (chưa tiếp nhận)
      const updated = service.items$.value.find((i) => i.id === 'notif_independent_1');
      expect(updated?.isRead).toBe(true);
      expect(updated?.status).toBe('sent');
      expect(service.unreadCount$.value).toBe(0);
    });

    it('C5 – hideToast xoá toast hiện tại và kích hoạt CDR', () => {
      const { service } = createMockService();
      const { comp, cdr } = createMockComponent(service);

      comp.toast = {
        id: 'toast_1',
        type: 'operational_alert',
        title: 'Toast',
        message: 'Msg',
        orderId: '',
        link: '',
        createdAt: '2026-11-12T00:00:00Z',
        isRead: false
      };

      comp.hideToast();

      expect(comp.toast).toBeNull();
      expect(cdr.markForCheck).toHaveBeenCalled();
    });
  });

  // ========================================================
  // GROUP D: Lifecycle, Connection & Interaction (5 tests)
  // ========================================================
  describe('Group D: Lifecycle, Connection & Interaction', () => {
    it('D1 – connect() với token hợp lệ gọi load() và cấu hình socket', () => {
      const { service } = createMockService();
      const loadSpy = vi.spyOn(service, 'load');

      service.connect('valid_jwt_token');

      expect((service as any).token).toBe('valid_jwt_token');
      expect(loadSpy).toHaveBeenCalled();
      expect(mockSocketInstance).toBeDefined();
      expect(mockSocketInstance.on).toHaveBeenCalledWith('notification:new', expect.any(Function));
    });

    it('D2 – disconnect() dọn dẹp danh sách, unreadCount và huỷ socket', () => {
      const { service } = createMockService();
      service.items$.next([{ id: '1', type: 'order', title: '', message: '', orderId: '', link: '', createdAt: '', isRead: false }]);
      service.unreadCount$.next(1);

      service.connect('valid_jwt');
      service.disconnect();

      expect(service.items$.value).toEqual([]);
      expect(service.unreadCount$.value).toBe(0);
      expect((service as any).token).toBe('');
      expect(mockSocketInstance.disconnect).toHaveBeenCalled();
    });

    it('D3 – connect() với token rỗng hoặc null gọi disconnect()', () => {
      const { service } = createMockService();
      const disconnectSpy = vi.spyOn(service, 'disconnect');

      service.connect(null);
      expect(disconnectSpy).toHaveBeenCalled();

      service.connect('');
      expect(disconnectSpy).toHaveBeenCalledTimes(2);
    });

    it('D4 – Component ngOnChanges kết nối lại khi token input thay đổi', () => {
      const { service } = createMockService();
      const { comp } = createMockComponent(service);
      const connectSpy = vi.spyOn(service, 'connect');

      comp.token = 'new_admin_jwt';
      comp.ngOnChanges({
        token: {
          currentValue: 'new_admin_jwt',
          previousValue: null,
          firstChange: true,
          isFirstChange: () => true
        }
      });

      expect(connectSpy).toHaveBeenCalledWith('new_admin_jwt');
    });

    it('D5 – Component toggle() đóng mở panel và tự động gọi load() khi mở', () => {
      const { service } = createMockService();
      const { comp } = createMockComponent(service);
      const loadSpy = vi.spyOn(service, 'load');

      expect(comp.isOpen).toBe(false);

      comp.toggle();
      expect(comp.isOpen).toBe(true);
      expect(loadSpy).toHaveBeenCalled();

      comp.toggle();
      expect(comp.isOpen).toBe(false);
    });

    it('D6 – Component acknowledge() chặn event propagation và gọi service.acknowledge()', () => {
      const { service } = createMockService();
      const { comp } = createMockComponent(service);
      const ackSpy = vi.spyOn(service, 'acknowledge');
      const stopProp = vi.fn();
      const mockEvent = { stopPropagation: stopProp } as any;

      const notif: AppNotification = {
        id: 'ntf_ack_1',
        type: 'operational_alert',
        title: 'Cần xử lý',
        message: 'Nội dung',
        orderId: '',
        link: '',
        createdAt: '2026-11-12T08:00:00Z',
        isRead: false,
        status: 'sent'
      };

      comp.acknowledge(mockEvent, notif);

      expect(stopProp).toHaveBeenCalled();
      expect(ackSpy).toHaveBeenCalledWith(notif);
    });

    it('D7 – Service acknowledge() cập nhật optimistic trạng thái thành acknowledged', () => {
      const { service } = createMockService();
      (service as any).token = 'mock_staff_jwt';

      const notif: AppNotification = {
        id: 'ntf_ack_2',
        type: 'operational_alert',
        title: 'Cần xử lý SLA',
        message: 'Gấp',
        orderId: '',
        link: '',
        createdAt: '2026-11-12T08:00:00Z',
        isRead: false,
        status: 'sent'
      };

      service.items$.next([notif]);
      service.unreadCount$.next(1);

      service.acknowledge(notif);

      const updated = service.items$.value[0];
      expect(updated.status).toBe('acknowledged');
      expect(updated.isRead).toBe(true);
      expect(updated.acknowledgedAt).toBeDefined();
      expect(service.unreadCount$.value).toBe(0);
    });
  });
});
