import { Component, OnInit, AfterViewChecked, ElementRef, ViewChild, ChangeDetectorRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { ChatbotService } from '../../services/chatbot';
import { AuthService } from '../../services/auth';

interface ChatMessage {
  id: string;
  sender: 'user' | 'ai';
  content: string;
  products?: any[];
  vouchers?: any[];
  suggestions?: string[];
  time: string;
}

@Component({
  selector: 'app-ai-assistant',
  imports: [CommonModule, FormsModule],
  templateUrl: './ai-assistant.html',
  styleUrl: './ai-assistant.scss'
})
export class AiAssistantComponent implements OnInit, AfterViewChecked {
  @ViewChild('chatBody') chatBody!: ElementRef;

  // Sidebar
  sessions: any[] = [];
  activeSessionId: string | null = null;
  sidebarWidth = 260;
    private isResizing = false;
    private resizeStartX = 0;
    private resizeStartWidth = 0;
    private readonly SIDEBAR_MIN = 180;
    private readonly SIDEBAR_MAX = 420;

  // Chat
  messages: ChatMessage[] = [];
  inputText = '';
  isLoading = false;
  suggestions: string[] = ['Tư vấn laptop gaming cho sinh viên', 'Sản phẩm đang flash sale hôm nay', 'Có mã giảm giá nào không?', 'Điện thoại chụp ảnh đẹp dưới 10 triệu'];

  private shouldScrollToBottom = false;

  constructor(
    private chatbotService: ChatbotService,
    private authService: AuthService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    // Redirect nếu chưa đăng nhập
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login']);
      return;
    }
    this.loadSessions();
  }

  ngAfterViewChecked() {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  // ── Sessions ──────────────────────────────

  loadSessions() {
    this.chatbotService.getSessions().subscribe({
      next: (res) => {
        this.sessions = res.data;
        this.cdr.detectChanges();
      }
    });
  }

  createNewSession() {
    this.chatbotService.createSession().subscribe({
      next: (res) => {
        this.sessions.unshift(res.data);
        this.openSession(res.data.Session_id);
        this.cdr.detectChanges();
      }
    });
  }

  openSession(sessionId: string) {
    this.activeSessionId = sessionId;
    this.messages = [];
    this.suggestions = ['Tư vấn laptop gaming cho sinh viên', 'Sản phẩm đang flash sale hôm nay', 'Có mã giảm giá nào không?', 'Điện thoại chụp ảnh đẹp dưới 10 triệu'];

    this.chatbotService.getSessionMessages(sessionId).subscribe({
      next: (res) => {
        // Chuyển đổi Message từ DB sang định dạng hiển thị
        this.messages = res.data.map((m: any) => ({
          id: m.Message_id,
          sender: m.Sender_type,
          content: m.Content,
          products: m.Products_json ? JSON.parse(m.Products_json) : [],
          vouchers: m.Vouchers_json ? JSON.parse(m.Vouchers_json) : [],
          suggestions: [],
          time: this.formatTime(m.Created_at),
        }));
        this.shouldScrollToBottom = true;
        this.cdr.detectChanges();
      }
    });
  }

  deleteSession(sessionId: string, event: Event) {
    event.stopPropagation(); // không trigger openSession
    if (!confirm('Xóa cuộc trò chuyện này?')) return;

    this.chatbotService.deleteSession(sessionId).subscribe({
      next: () => {
        this.sessions = this.sessions.filter(s => s.Session_id !== sessionId);
        if (this.activeSessionId === sessionId) {
          this.activeSessionId = null;
          this.messages = [];
        }
        this.cdr.detectChanges();
      }
    });
  }

  // ── Gửi tin nhắn ─────────────────────────

  sendMessage(text?: string) {
    const content = (text || this.inputText).trim();
    if (!content || this.isLoading) return;

    // Nếu chưa có session thì tạo mới rồi gửi
    if (!this.activeSessionId) {
      this.chatbotService.createSession().subscribe({
        next: (res) => {
          this.sessions.unshift(res.data);
          this.activeSessionId = res.data.Session_id;
          this.cdr.detectChanges();
          this.doSend(content);
        }
      });
      return;
    }

    this.doSend(content);
  }

  private doSend(content: string) {
    // Hiện tin nhắn user ngay lập tức
    this.messages.push({
      id: 'temp-user-' + Date.now(),
      sender: 'user',
      content,
      time: this.formatTime(new Date()),
    });
    this.inputText = '';
    this.isLoading = true;
    this.suggestions = [];
    this.shouldScrollToBottom = true;
    this.cdr.detectChanges();

    this.chatbotService.sendMessage(this.activeSessionId!, content).subscribe({
      next: (res) => {
        const { message, products, vouchers, suggestions } = res.data;

        // Cập nhật tiêu đề session trong sidebar
        const session = this.sessions.find(s => s.Session_id === this.activeSessionId);
        if (session && session.Title === 'Cuộc trò chuyện mới') {
          session.Title = content.length > 50 ? content.slice(0, 50) + '...' : content;
        }

        this.messages.push({
          id: message.Message_id,
          sender: 'ai',
          content: message.Content,
          products: products || [],
          vouchers: vouchers || [],
          suggestions: [],
          time: this.formatTime(message.Created_at),
        });

        this.suggestions = suggestions || [];
        this.isLoading = false;
        this.shouldScrollToBottom = true;
        this.cdr.detectChanges();
      },
      error: () => {
        this.messages.push({
          id: 'err-' + Date.now(),
          sender: 'ai',
          content: 'Xin lỗi, mình gặp sự cố kết nối. Bạn thử lại nhé!',
          time: this.formatTime(new Date()),
        });
        this.isLoading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Bấm nút gợi ý nhanh
  sendSuggestion(text: string) {
    this.sendMessage(text);
  }

  // Enter để gửi
  onKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  // ── Helpers ───────────────────────────────

  private scrollToBottom() {
    try {
      const el = this.chatBody.nativeElement;
      el.scrollTop = el.scrollHeight;
    } catch {}
  }

  formatTime(date: any): string {
    const d = new Date(date);
    return `VISTA AI ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() >= 12 ? 'CH' : 'SA'}`;
  }

  formatPrice(price: number): string {
    return price ? price.toLocaleString('vi-VN') + ' ₫' : 'Liên hệ';
  }

  getFinalPrice(price: number, discount: number): number {
    if (!discount || discount === 0) return price;
    return price - (price * discount / 100);
  }

  goToProduct(productId: string) {
    this.router.navigate(['/products', productId]);
  }
  onResizeStart(event: MouseEvent) {
    this.isResizing = true;
    this.resizeStartX = event.clientX;
    this.resizeStartWidth = this.sidebarWidth;
    event.preventDefault();
    }

    @HostListener('document:mousemove', ['$event'])
    onMouseMove(event: MouseEvent) {
    if (!this.isResizing) return;
    const delta = event.clientX - this.resizeStartX;
    const newWidth = this.resizeStartWidth + delta;
    this.sidebarWidth = Math.min(Math.max(newWidth, this.SIDEBAR_MIN), this.SIDEBAR_MAX);
    }

    @HostListener('document:mouseup')
    onMouseUp() { this.isResizing = false; }

    searchQuery = '';

    // Thêm getter lọc session theo searchQuery
    get filteredSessions() {
    if (!this.searchQuery.trim()) return this.sessions;
    return this.sessions.filter(s =>
        s.Title.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
    }
}
