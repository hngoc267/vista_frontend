import {
  AfterViewChecked,
  ChangeDetectorRef,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  inject
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideBot,
  lucideSparkles,
  lucideSend,
  lucideX,
  lucideTrash2,
  lucideMessageSquare,
  lucideAlertCircle,
  lucideUser,
  lucideMaximize2,
  lucideMinimize2,
  lucideGripVertical
} from '@ng-icons/lucide';
import { Subscription, finalize } from 'rxjs';
import {
  AdminAssistantService,
  AssistantHistoryItem,
  AssistantIntent,
  AssistantStatus
} from '../../services/admin-assistant';
import { AdminRole, getAdminRole } from '../../../guards/admin-guard';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  time: string;
  status?: AssistantStatus;
  intent?: AssistantIntent;
  isError?: boolean;
}

@Component({
  selector: 'app-admin-assistant',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon],
  providers: [
    provideIcons({
      lucideBot,
      lucideSparkles,
      lucideSend,
      lucideX,
      lucideTrash2,
      lucideMessageSquare,
      lucideAlertCircle,
      lucideUser,
      lucideMaximize2,
      lucideMinimize2,
      lucideGripVertical
    })
  ],
  templateUrl: './admin-assistant.html',
  styleUrl: './admin-assistant.scss'
})
export class AdminAssistantComponent implements OnInit, OnDestroy, AfterViewChecked {
  private readonly assistantService: AdminAssistantService;
  private readonly cdr?: ChangeDetectorRef;
  private readonly sanitizer?: DomSanitizer;
  private readonly subscriptions = new Subscription();

  constructor(
    assistantService?: AdminAssistantService,
    cdr?: ChangeDetectorRef,
    sanitizer?: DomSanitizer
  ) {
    this.assistantService = assistantService ?? inject(AdminAssistantService);
    try {
      this.cdr = cdr ?? inject(ChangeDetectorRef);
    } catch {
      this.cdr = cdr;
    }
    try {
      this.sanitizer = sanitizer ?? inject(DomSanitizer);
    } catch {
      this.sanitizer = sanitizer;
    }
  }

  @ViewChild('messagesContainer')
  private messagesContainer?: ElementRef<HTMLDivElement>;

  @ViewChild('chatInput')
  private chatInput?: ElementRef<HTMLTextAreaElement>;

  isOpen = false;
  isLoading = false;
  inputMessage = '';
  role: AdminRole | null = null;
  messages: ChatMessage[] = [];
  errorMessage: string | null = null;

  // --- KÉO DI CHUYỂN NÚT FLOATING ASSISTANT ---
  buttonPosition: { x: number; y: number } | null = null;
  isDraggingButton = false;
  private dragStartMouse = { x: 0, y: 0 };
  private dragStartPos = { x: 0, y: 0 };
  private hasDraggedButton = false;

  // --- KÉO THAY ĐỔI KÍCH THƯỚC (RESIZE) DRAWER ---
  drawerWidth = 440;
  readonly defaultDrawerWidth = 440;
  readonly minDrawerWidth = 360;
  readonly maxDrawerWidth = 960;
  isResizingDrawer = false;
  isMaximized = false;
  private preMaximizeWidth = 440;
  private resizeStartX = 0;
  private resizeStartWidth = 440;

  private shouldScrollToBottom = false;

  // Câu hỏi gợi ý cho Quản lý (Manager) - Có đầy đủ báo cáo tài chính & vận hành
  readonly managerPrompts: string[] = [
    'Doanh thu hiện tại thế nào?',
    'Lợi nhuận gộp tháng này?',
    'Tình hình giá vốn?',
    'Có bao nhiêu đơn quá hạn?',
    'Tình hình đổi trả?',
    'Đánh giá nào cần kiểm duyệt?'
  ];

  // Câu hỏi gợi ý cho Nhân viên (Staff) - TUYỆT ĐỐI không có câu hỏi tài chính
  readonly staffPrompts: string[] = [
    'Có bao nhiêu đơn quá hạn?',
    'Đơn nào đang chờ xác nhận?',
    'Tình hình đổi trả?',
    'Có đánh giá nào cần kiểm duyệt?',
    'Quy trình xử lý đơn quá hạn?'
  ];

  get currentPrompts(): string[] {
    return this.role === 'Manager' ? this.managerPrompts : this.staffPrompts;
  }

  get roleDisplayName(): string {
    if (this.role === 'Manager') return 'Quản lý (Manager)';
    if (this.role === 'Staff') return 'Nhân viên (Staff)';
    return 'Quản trị viên';
  }

  ngOnInit(): void {
    this.refreshRole();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', this.onButtonMouseMove);
      window.removeEventListener('mouseup', this.onButtonMouseUp);
      window.removeEventListener('mousemove', this.onResizeMove);
      window.removeEventListener('mouseup', this.onResizeEnd);
    }
  }

  // --- KÉO DI CHUYỂN NÚT FLOATING ASSISTANT ---
  onButtonMouseDown(event: MouseEvent): void {
    if (event.button !== 0) return;
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();

    this.isDraggingButton = true;
    this.hasDraggedButton = false;
    this.dragStartMouse = { x: event.clientX, y: event.clientY };
    this.dragStartPos = { x: rect.left, y: rect.top };

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', this.onButtonMouseMove);
      window.addEventListener('mouseup', this.onButtonMouseUp);
    }
  }

  private onButtonMouseMove = (event: MouseEvent): void => {
    if (!this.isDraggingButton) return;
    const dx = event.clientX - this.dragStartMouse.x;
    const dy = event.clientY - this.dragStartMouse.y;

    if (Math.hypot(dx, dy) > 5) {
      this.hasDraggedButton = true;
    }

    if (this.hasDraggedButton) {
      const maxX = (typeof window !== 'undefined' ? window.innerWidth : 1200) - 60;
      const maxY = (typeof window !== 'undefined' ? window.innerHeight : 800) - 60;
      const newX = Math.max(12, Math.min(maxX, this.dragStartPos.x + dx));
      const newY = Math.max(12, Math.min(maxY, this.dragStartPos.y + dy));

      this.buttonPosition = { x: newX, y: newY };
      this.cdr?.markForCheck();
    }
  };

  private onButtonMouseUp = (): void => {
    this.isDraggingButton = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', this.onButtonMouseMove);
      window.removeEventListener('mouseup', this.onButtonMouseUp);
    }
  };

  onButtonClick(event: MouseEvent): void {
    if (this.hasDraggedButton) {
      event.preventDefault();
      event.stopPropagation();
      this.hasDraggedButton = false;
      return;
    }
    this.toggleDrawer();
  }

  // --- KÉO THAY ĐỔI KÍCH THƯỚC (RESIZE) DRAWER ---
  onResizeStart(event: MouseEvent): void {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();

    this.isResizingDrawer = true;
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = this.drawerWidth;

    if (typeof window !== 'undefined') {
      window.addEventListener('mousemove', this.onResizeMove);
      window.addEventListener('mouseup', this.onResizeEnd);
    }
  }

  private onResizeMove = (event: MouseEvent): void => {
    if (!this.isResizingDrawer) return;
    const delta = this.resizeStartX - event.clientX;
    const maxAllowed = (typeof window !== 'undefined' ? window.innerWidth - 30 : this.maxDrawerWidth);
    const newWidth = Math.max(
      this.minDrawerWidth,
      Math.min(Math.min(this.maxDrawerWidth, maxAllowed), this.resizeStartWidth + delta)
    );

    this.drawerWidth = newWidth;
    this.isMaximized = this.drawerWidth >= Math.min(this.maxDrawerWidth, maxAllowed) - 20;
    this.cdr?.markForCheck();
  };

  private onResizeEnd = (): void => {
    this.isResizingDrawer = false;
    if (typeof window !== 'undefined') {
      window.removeEventListener('mousemove', this.onResizeMove);
      window.removeEventListener('mouseup', this.onResizeEnd);
    }
  };

  resetDrawerWidth(): void {
    this.drawerWidth = this.defaultDrawerWidth;
    this.isMaximized = false;
    this.cdr?.markForCheck();
  }

  toggleMaximizeDrawer(): void {
    const maxAllowed = (typeof window !== 'undefined' ? window.innerWidth - 40 : this.maxDrawerWidth);
    if (this.isMaximized) {
      this.drawerWidth = this.preMaximizeWidth || this.defaultDrawerWidth;
      this.isMaximized = false;
    } else {
      this.preMaximizeWidth = this.drawerWidth;
      this.drawerWidth = Math.min(this.maxDrawerWidth, maxAllowed);
      this.isMaximized = true;
    }
    this.cdr?.markForCheck();
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottomImmediate();
      this.shouldScrollToBottom = false;
    }
  }

  refreshRole(): void {
    this.role = getAdminRole();
  }

  toggleDrawer(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.refreshRole();
      this.shouldScrollToBottom = true;
      setTimeout(() => {
        this.chatInput?.nativeElement?.focus();
      }, 150);
    }
  }

  closeDrawer(): void {
    this.isOpen = false;
  }

  selectPrompt(promptText: string): void {
    if (this.isLoading) return;
    this.inputMessage = promptText;
    this.sendMessage();
  }

  onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage(): void {
    const text = this.inputMessage?.trim();
    if (!text || this.isLoading) {
      return;
    }

    this.errorMessage = null;

    // Lưu lại thời gian gửi
    const now = new Date();
    const timeString = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    // Thêm tin nhắn của User vào danh sách hiển thị
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      role: 'user',
      content: text,
      time: timeString
    };

    this.messages.push(userMessage);
    const backupText = text;
    this.inputMessage = '';
    this.isLoading = true;
    this.shouldScrollToBottom = true;

    // Chuẩn bị history: lấy tối đa 6 lượt hội thoại gần nhất trước tin nhắn vừa tạo
    const historyPayload: AssistantHistoryItem[] = this.messages
      .filter((m) => !m.isError && m.id !== userMessage.id)
      .slice(-6)
      .map((m) => ({
        role: m.role,
        content: m.content
      }));

    const sub = this.assistantService
      .sendMessage(text, historyPayload)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.shouldScrollToBottom = true;
          this.cdr?.markForCheck();
        })
      )
      .subscribe({
        next: (res) => {
          const resTime = new Date();
          const resTimeString = `${resTime.getHours().toString().padStart(2, '0')}:${resTime.getMinutes().toString().padStart(2, '0')}`;

          const assistantMsg: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            role: 'assistant',
            content: res.answer || 'Tôi đã xử lý yêu cầu của bạn.',
            time: resTimeString,
            status: res.status,
            intent: res.intent
          };

          this.messages.push(assistantMsg);
        },
        error: (err: Error) => {
          const errTime = new Date();
          const errTimeString = `${errTime.getHours().toString().padStart(2, '0')}:${errTime.getMinutes().toString().padStart(2, '0')}`;

          const friendlyMessage = err.message || 'Không thể nhận phản hồi từ Trợ lý AI.';
          this.errorMessage = friendlyMessage;

          const errorMsg: ChatMessage = {
            id: `msg-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            role: 'assistant',
            content: friendlyMessage,
            time: errTimeString,
            isError: true,
            status: 'error'
          };

          this.messages.push(errorMsg);

          // Nếu lỗi do mạng hoặc server bận, có thể phục hồi nội dung nếu ô nhập còn rỗng
          if (!this.inputMessage) {
            this.inputMessage = backupText;
          }
        }
      });

    this.subscriptions.add(sub);
  }

  /**
   * Định dạng Markdown và highlight các mục cần chú ý (màu đỏ, in đậm) một cách an toàn chống XSS
   */
  formatMessage(content: string): SafeHtml {
    if (!content) return '';

    // 1. Chống XSS tuyệt đối: Escape toàn bộ ký tự HTML đặc biệt trước
    let safe = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');

    // 2. Chuyển đổi Markdown in đậm **nội dung** thành <strong>nội dung</strong>
    safe = safe.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // 3. Highlight khối thông báo [CHÚ Ý: ...], [CẦN XỬ LÝ: ...], [KHẨN CẤP: ...] thành thẻ cảnh báo đỏ
    safe = safe.replace(
      /\[(CHÚ Ý|CẦN XỬ LÝ|KHẨN CẤP|CẢNH BÁO):?\s*(.+?)\]/gi,
      '<div class="notice-urgent"><span class="notice-tag">$1</span> $2</div>'
    );

    // 4. Nhấn mạnh đỏ nổi bật cho các trạng thái khẩn cấp
    safe = safe.replace(
      /\b(quá hạn SLA|quá hạn|đang chờ duyệt|chờ duyệt|chờ xác nhận|tiêu cực|1 sao|2 sao)\b/gi,
      '<span class="highlight-urgent">$1</span>'
    );

    // 5. Làm sạch dấu hoa thị đầu dòng: thay "* " hoặc "- " bằng chấm bullet "• "
    safe = safe.replace(/^(\s*)[*-]\s+/gm, '$1• ');

    if (!this.sanitizer) {
      return safe;
    }
    return this.sanitizer.bypassSecurityTrustHtml(safe);
  }

  clearChat(): void {
    this.messages = [];
    this.errorMessage = null;
    this.refreshRole();
  }

  private scrollToBottomImmediate(): void {
    if (this.messagesContainer?.nativeElement) {
      const el = this.messagesContainer.nativeElement;
      el.scrollTop = el.scrollHeight;
    }
  }
}
