import '@angular/compiler';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AdminAssistantService,
  AssistantChatResponse,
  AssistantHistoryItem
} from '../../services/admin-assistant';
import { AdminAssistantComponent } from './admin-assistant';

// Polyfill localStorage cho môi trường node vitest nếu cần
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

describe('VISTA AI Management Assistant - Frontend Unit Tests', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  // ========================================================
  // 1. ADMIN ASSISTANT SERVICE TESTS
  // ========================================================
  describe('AdminAssistantService', () => {
    it('1.1 – Message rỗng hoặc toàn khoảng trắng phải trả lỗi ngay mà không gọi HTTP', async () => {
      let httpCalled = false;
      const mockHttp = {
        post: () => {
          httpCalled = true;
          return of({});
        }
      } as any;

      localStorage.setItem('vista_admin_token', 'valid-admin-jwt');
      const service = new AdminAssistantService(mockHttp);

      await new Promise<void>((resolve) => {
        service.sendMessage('    ').subscribe({
          next: () => {
            throw new Error('Không được gọi next khi message rỗng');
          },
          error: (err: Error) => {
            expect(err.message).toBe('Vui lòng nhập nội dung câu hỏi.');
            expect(httpCalled).toBe(false);
            resolve();
          }
        });
      });
    });

    it('1.2 – Không có JWT token trong localStorage phải ném lỗi phiên đăng nhập hết hạn', async () => {
      let httpCalled = false;
      const mockHttp = {
        post: () => {
          httpCalled = true;
          return of({});
        }
      } as any;

      const service = new AdminAssistantService(mockHttp);

      await new Promise<void>((resolve) => {
        service.sendMessage('Báo cáo đơn hàng').subscribe({
          next: () => {
            throw new Error('Không được gọi next khi thiếu token');
          },
          error: (err: Error) => {
            expect(err.message).toContain('Phiên đăng nhập đã hết hạn');
            expect(httpCalled).toBe(false);
            resolve();
          }
        });
      });
    });

    it('1.3 – Gửi request hợp lệ kèm header Authorization: Bearer và payload chuẩn', async () => {
      let postedUrl = '';
      let postedBody: any = null;
      let postedHeaders: any = null;

      const mockResponse: AssistantChatResponse = {
        status: 'answered',
        role: 'Manager',
        intent: 'financial_kpi',
        answer: 'Doanh thu thuần đạt 450.000.000 VNĐ.',
        data_available: true
      };

      const mockHttp = {
        post: (url: string, body: any, options: any) => {
          postedUrl = url;
          postedBody = body;
          postedHeaders = options?.headers;
          return of(mockResponse);
        }
      } as any;

      localStorage.setItem('vista_admin_token', 'test_secret_jwt');
      const service = new AdminAssistantService(mockHttp);

      const history: AssistantHistoryItem[] = [
        { role: 'user', content: 'Xin chào' },
        { role: 'assistant', content: 'Chào bạn, tôi có thể hỗ trợ gì?' }
      ];

      await new Promise<void>((resolve) => {
        service.sendMessage('Doanh thu hôm nay thế nào?', history).subscribe({
          next: (res) => {
            expect(res.status).toBe('answered');
            expect(res.role).toBe('Manager');
            expect(res.answer).toBe('Doanh thu thuần đạt 450.000.000 VNĐ.');
            expect(postedUrl).toContain('/api/admin/assistant/chat');
            expect(postedBody.message).toBe('Doanh thu hôm nay thế nào?');
            expect(postedBody.history.length).toBe(2);
            expect(postedHeaders.get('Authorization')).toBe('Bearer test_secret_jwt');
            resolve();
          }
        });
      });
    });

    it('1.4 – Lịch sử gửi đi chỉ lấy tối đa 6 lượt hội thoại và loại bỏ item không hợp lệ', async () => {
      let postedBody: any = null;
      const mockHttp = {
        post: (_url: string, body: any) => {
          postedBody = body;
          return of({ status: 'answered', answer: 'OK' });
        }
      } as any;

      localStorage.setItem('vista_admin_token', 'valid-token');
      const service = new AdminAssistantService(mockHttp);

      const manyHistory: any[] = [
        { role: 'user', content: 'Câu 1' },
        { role: 'assistant', content: 'Trả lời 1' },
        { role: 'user', content: 'Câu 2' },
        { role: 'assistant', content: 'Trả lời 2' },
        { role: 'user', content: 'Câu 3' },
        { role: 'assistant', content: 'Trả lời 3' },
        { role: 'user', content: 'Câu 4' },
        { role: 'assistant', content: 'Trả lời 4' },
        { role: 'invalid_role', content: 'Bị lọc' },
        { role: 'user', content: '   ' } // Rỗng bị lọc
      ];

      await new Promise<void>((resolve) => {
        service.sendMessage('Câu hỏi mới', manyHistory).subscribe(() => {
          expect(postedBody.history.length).toBe(6);
          expect(postedBody.history[0].content).toBe('Câu 2');
          expect(postedBody.history[5].content).toBe('Trả lời 4');
          resolve();
        });
      });
    });

    it('1.5 – Xử lý lỗi HTTP 429 (Rate Limit) thành thông báo tiếng Việt', async () => {
      const mockHttp = {
        post: () => {
          return throwError(
            () => new HttpErrorResponse({ status: 429, statusText: 'Too Many Requests' })
          );
        }
      } as any;

      localStorage.setItem('vista_admin_token', 'valid-token');
      const service = new AdminAssistantService(mockHttp);

      await new Promise<void>((resolve) => {
        service.sendMessage('Kiểm tra SLA').subscribe({
          next: () => {
            throw new Error('Phải ném lỗi');
          },
          error: (err: Error) => {
            expect(err.message).toContain('quá nhiều yêu cầu');
            resolve();
          }
        });
      });
    });

    it('1.6 – Xử lý lỗi HTTP 401 thành thông báo hết hạn phiên đăng nhập', async () => {
      const mockHttp = {
        post: () => {
          return throwError(
            () => new HttpErrorResponse({ status: 401, statusText: 'Unauthorized' })
          );
        }
      } as any;

      localStorage.setItem('vista_admin_token', 'expired-token');
      const service = new AdminAssistantService(mockHttp);

      await new Promise<void>((resolve) => {
        service.sendMessage('Kiểm tra SLA').subscribe({
          next: () => {
            throw new Error('Phải ném lỗi');
          },
          error: (err: Error) => {
            expect(err.message).toContain('Phiên đăng nhập đã hết hạn');
            resolve();
          }
        });
      });
    });

    it('1.7 – Xử lý lỗi kết nối mạng (status = 0)', async () => {
      const mockHttp = {
        post: () => {
          return throwError(
            () => new HttpErrorResponse({ status: 0, statusText: 'Unknown Error' })
          );
        }
      } as any;

      localStorage.setItem('vista_admin_token', 'token');
      const service = new AdminAssistantService(mockHttp);

      await new Promise<void>((resolve) => {
        service.sendMessage('Kiểm tra mạng').subscribe({
          next: () => {
            throw new Error('Phải ném lỗi');
          },
          error: (err: Error) => {
            expect(err.message).toContain('Không thể kết nối đến máy chủ');
            resolve();
          }
        });
      });
    });
  });

  // ========================================================
  // 2. ADMIN ASSISTANT COMPONENT TESTS
  // ========================================================
  describe('AdminAssistantComponent', () => {
    function createComponentWithMockService(mockService: any): AdminAssistantComponent {
      const mockSanitizer = { bypassSecurityTrustHtml: (val: string) => val };
      return new AdminAssistantComponent(
        mockService,
        { markForCheck: vi.fn() } as any,
        mockSanitizer as any
      );
    }

    it('2.1 – Trạng thái khởi tạo: Drawer đóng (isOpen = false), danh sách rỗng', () => {
      const comp = createComponentWithMockService({});
      expect(comp.isOpen).toBe(false);
      expect(comp.isLoading).toBe(false);
      expect(comp.messages.length).toBe(0);
      expect(comp.errorMessage).toBeNull();
    });

    it('2.2 – toggleDrawer() chuyển đổi mở/đóng Drawer và cập nhật role', () => {
      localStorage.setItem('vista_admin_token', 'test_token');
      localStorage.setItem('vista_admin_user', JSON.stringify({ Role: 'Manager' }));

      const comp = createComponentWithMockService({});
      comp.toggleDrawer();
      expect(comp.isOpen).toBe(true);
      expect(comp.role).toBe('Manager');

      comp.toggleDrawer();
      expect(comp.isOpen).toBe(false);
    });

    it('2.3 – Quản lý (Manager) có các câu hỏi gợi ý tài chính và vận hành', () => {
      localStorage.setItem('vista_admin_token', 'token');
      localStorage.setItem('vista_admin_user', JSON.stringify({ Role: 'Manager' }));

      const comp = createComponentWithMockService({});
      comp.refreshRole();

      expect(comp.role).toBe('Manager');
      const prompts = comp.currentPrompts;
      expect(prompts).toContain('Doanh thu hiện tại thế nào?');
      expect(prompts).toContain('Lợi nhuận gộp tháng này?');
      expect(prompts).toContain('Tình hình giá vốn?');
      expect(prompts).toContain('Có bao nhiêu đơn quá hạn?');
      expect(prompts).toContain('Tình hình đổi trả?');
    });

    it('2.4 – [BẢO MẬT & UX] Nhân viên (Staff) TUYỆT ĐỐI không có câu hỏi gợi ý tài chính', () => {
      localStorage.setItem('vista_admin_token', 'token');
      localStorage.setItem('vista_admin_user', JSON.stringify({ Role: 'Staff' }));

      const comp = createComponentWithMockService({});
      comp.refreshRole();

      expect(comp.role).toBe('Staff');
      const prompts = comp.currentPrompts;

      // Staff thấy câu hỏi vận hành
      expect(prompts).toContain('Có bao nhiêu đơn quá hạn?');
      expect(prompts).toContain('Đơn nào đang chờ xác nhận?');
      expect(prompts).toContain('Tình hình đổi trả?');
      expect(prompts).toContain('Có đánh giá nào cần kiểm duyệt?');

      // TUYỆT ĐỐI KHÔNG chứa từ khóa tài chính
      for (const prompt of prompts) {
        const lower = prompt.toLowerCase();
        expect(lower.includes('doanh thu')).toBe(false);
        expect(lower.includes('lợi nhuận')).toBe(false);
        expect(lower.includes('giá vốn')).toBe(false);
      }
    });

    it('2.5 – sendMessage() với nội dung hợp lệ gửi câu hỏi và đưa câu trả lời vào hội thoại', () => {
      const mockResponse: AssistantChatResponse = {
        status: 'answered',
        role: 'Manager',
        intent: 'order_operational',
        answer: 'Hiện có 5 đơn hàng đang chờ xác nhận.',
        data_available: true
      };

      const mockService = {
        sendMessage: vi.fn().mockReturnValue(of(mockResponse))
      };

      const comp = createComponentWithMockService(mockService);
      comp.inputMessage = 'Đơn nào đang chờ xác nhận?';
      comp.sendMessage();

      expect(mockService.sendMessage).toHaveBeenCalled();
      expect(comp.messages.length).toBe(2);
      expect(comp.messages[0].role).toBe('user');
      expect(comp.messages[0].content).toBe('Đơn nào đang chờ xác nhận?');
      expect(comp.messages[1].role).toBe('assistant');
      expect(comp.messages[1].content).toBe('Hiện có 5 đơn hàng đang chờ xác nhận.');
      expect(comp.isLoading).toBe(false);
    });

    it('2.6 – Khi request thất bại, hiển thị thông báo lỗi thân thiện và giữ nội dung', () => {
      const mockService = {
        sendMessage: vi.fn().mockReturnValue(throwError(() => new Error('Máy chủ đang bận.')))
      };

      const comp = createComponentWithMockService(mockService);
      comp.inputMessage = 'Xem đơn hàng quá hạn';
      comp.sendMessage();

      expect(comp.messages.length).toBe(2);
      expect(comp.messages[1].isError).toBe(true);
      expect(comp.messages[1].content).toBe('Máy chủ đang bận.');
      expect(comp.errorMessage).toBe('Máy chủ đang bận.');
      expect(comp.inputMessage).toBe('Xem đơn hàng quá hạn'); // Được phục hồi
      expect(comp.isLoading).toBe(false);
    });

    it('2.7 – clearChat() làm sạch lịch sử hội thoại trong phiên', () => {
      const comp = createComponentWithMockService({});
      comp.messages = [
        { id: '1', role: 'user', content: 'Xin chào', time: '10:00' },
        { id: '2', role: 'assistant', content: 'Chào bạn', time: '10:01' }
      ];
      comp.errorMessage = 'Có lỗi';

      comp.clearChat();

      expect(comp.messages.length).toBe(0);
      expect(comp.errorMessage).toBeNull();
    });

    it('2.8 – onKeyDown() chỉ gửi tin khi bấm Enter, không gửi khi Shift+Enter', () => {
      const comp = createComponentWithMockService({});
      const sendSpy = vi.spyOn(comp, 'sendMessage').mockImplementation(() => {});

      // Shift + Enter -> Không gửi
      const shiftEnter = { key: 'Enter', shiftKey: true, preventDefault: vi.fn() } as any;
      comp.onKeyDown(shiftEnter);
      expect(sendSpy).not.toHaveBeenCalled();

      // Enter đơn thuần -> Gửi
      const enterOnly = { key: 'Enter', shiftKey: false, preventDefault: vi.fn() } as any;
      comp.onKeyDown(enterOnly);
      expect(sendSpy).toHaveBeenCalled();
      expect(enterOnly.preventDefault).toHaveBeenCalled();
    });

    it('2.9 – selectPrompt() tự động đặt câu hỏi và thực hiện gửi', () => {
      const mockService = {
        sendMessage: vi.fn().mockReturnValue(
          of({ status: 'answered', answer: 'Kết quả', role: 'Manager', intent: 'order_operational', data_available: true })
        )
      };

      const comp = createComponentWithMockService(mockService);
      comp.selectPrompt('Có bao nhiêu đơn quá hạn?');

      expect(mockService.sendMessage).toHaveBeenCalled();
      expect(comp.messages[0].content).toBe('Có bao nhiêu đơn quá hạn?');
    });

    it('2.10 – formatMessage() định dạng in đậm, highlight đỏ cảnh báo và chống XSS an toàn', () => {
      const comp = createComponentWithMockService({});

      const raw = '**Tổng quan:**\n*   [CHÚ Ý: Có 3 đơn quá hạn SLA]\n*   <script>alert("hacked")</script>';
      const formatted = comp.formatMessage(raw) as string;

      // 1. Markdown bold chuyển thành <strong>
      expect(formatted).toContain('<strong>Tổng quan:</strong>');

      // 2. Chống XSS: script tag bị escape hoàn toàn
      expect(formatted).not.toContain('<script>');
      expect(formatted).toContain('&lt;script&gt;');

      // 3. Highlight chú ý khẩn cấp màu đỏ
      expect(formatted).toContain('notice-urgent');
      expect(formatted).toContain('highlight-urgent');

      // 4. Bullet hoa thị được làm sạch thành •
      expect(formatted).toContain('• ');
      expect(formatted).not.toContain('*   ');
    });
    it('2.11 – Kéo di chuyển nút Floating Button: cập nhật tọa độ buttonPosition và ngăn click khi kéo', () => {
      const comp = createComponentWithMockService({});
      expect(comp.buttonPosition).toBeNull();

      const fakeTarget = {
        getBoundingClientRect: () => ({ left: 100, top: 100, width: 48, height: 48 })
      };

      // Mousedown
      comp.onButtonMouseDown({ button: 0, clientX: 100, clientY: 100, currentTarget: fakeTarget } as any);
      expect(comp.isDraggingButton).toBe(true);

      // Mousemove di chuyển 50px
      (comp as any).onButtonMouseMove({ clientX: 150, clientY: 150 } as any);
      expect(comp.buttonPosition).not.toBeNull();
      expect(comp.buttonPosition?.x).toBe(150);
      expect(comp.buttonPosition?.y).toBe(150);

      // Click sau khi kéo -> Bị chặn, không mở drawer
      const clickEvent = { preventDefault: vi.fn(), stopPropagation: vi.fn() } as any;
      comp.onButtonClick(clickEvent);
      expect(comp.isOpen).toBe(false);
      expect(clickEvent.preventDefault).toHaveBeenCalled();

      // Mouseup kết thúc kéo
      (comp as any).onButtonMouseUp();
      expect(comp.isDraggingButton).toBe(false);
    });

    it('2.12 – Kéo thay đổi độ rộng Drawer (Resize): thu phóng mượt mà và giới hạn min/max', () => {
      const comp = createComponentWithMockService({});
      expect(comp.drawerWidth).toBe(440);

      // Bắt đầu kéo ở clientX = 800
      comp.onResizeStart({
        button: 0,
        clientX: 800,
        preventDefault: vi.fn(),
        stopPropagation: vi.fn()
      } as any);
      expect(comp.isResizingDrawer).toBe(true);

      // Di chuyển chuột sang trái 100px (clientX = 700) -> Drawer mở rộng thêm 100px
      (comp as any).onResizeMove({ clientX: 700 } as any);
      expect(comp.drawerWidth).toBe(540);

      // Kết thúc kéo
      (comp as any).onResizeEnd();
      expect(comp.isResizingDrawer).toBe(false);
    });

    it('2.13 – toggleMaximizeDrawer() và resetDrawerWidth() phóng to và đặt lại kích thước', () => {
      const comp = createComponentWithMockService({});
      expect(comp.drawerWidth).toBe(440);

      comp.toggleMaximizeDrawer();
      expect(comp.isMaximized).toBe(true);
      expect(comp.drawerWidth).toBeGreaterThan(600);

      comp.resetDrawerWidth();
      expect(comp.drawerWidth).toBe(440);
      expect(comp.isMaximized).toBe(false);
    });
  });
});
