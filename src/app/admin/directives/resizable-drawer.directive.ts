import {
  Directive,
  ElementRef,
  Input,
  OnInit,
  AfterViewInit,
  OnDestroy,
  Renderer2,
  inject,
  PLATFORM_ID,
  HostListener,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

const STYLE_TAG_ID = 'vista-resizable-drawer-styles';

const SVG_MAXIMIZE = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>`;

const SVG_MINIMIZE = `<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"></polyline><polyline points="20 10 14 10 14 4"></polyline><line x1="14" y1="10" x2="21" y2="3"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg>`;

const INJECTED_STYLES = `
/* =========================================
   RESIZE HANDLE (ĐỒNG BỘ 100% VỚI CHATBOT AI)
   ========================================= */
.drawer-resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  width: 10px;
  height: 100%;
  cursor: ew-resize;
  z-index: 1005;
  display: flex;
  align-items: center;
  justify-content: center;
  user-select: none;
  touch-action: none;
  transition: background 0.15s ease;
  outline: none;
}

.drawer-resize-handle:hover,
.drawer-resize-handle:focus-visible,
.drawer-resize-handle.active {
  background: rgba(37, 99, 235, 0.14);
}

.drawer-resize-handle:focus-visible {
  outline: 2px solid #2563eb;
  outline-offset: -2px;
}

.drawer-resize-handle .resize-grip {
  width: 3px;
  height: 36px;
  border-radius: 9999px;
  background: #cbd5e1;
  transition: all 0.2s ease;
}

.drawer-resize-handle:hover .resize-grip,
.drawer-resize-handle:focus-visible .resize-grip,
.drawer-resize-handle.active .resize-grip {
  background: #2563eb;
  height: 60px;
  box-shadow: 0 0 10px rgba(37, 99, 235, 0.5);
}

/* Container nhóm các nút trên header để nút maximize và close luôn nằm sát nhau */
.drawer-header-actions {
  display: inline-flex !important;
  align-items: center !important;
  gap: 4px !important;
  margin-left: auto !important;
  flex-shrink: 0 !important;
}

/* Nút phóng to / thu nhỏ đồng bộ trên Header */
.drawer-maximize-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  padding: 0;
  margin: 0;
  border-radius: 6px;
  background: transparent;
  color: #64748b;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
  line-height: 1;
  flex-shrink: 0;
}

.drawer-maximize-btn:hover {
  background: rgba(15, 23, 42, 0.08);
  color: #0f172a;
}

.drawer-maximize-btn svg {
  stroke: currentColor;
  display: block;
}

.product-drawer .drawer-maximize-btn {
  border: 1px solid #e2e8f0;
  background: #ffffff;
}

.product-drawer .drawer-maximize-btn:hover {
  background: #f8fafc;
  color: #0f172a;
}

body.drawer-resizing-active {
  user-select: none !important;
  cursor: ew-resize !important;
}

body.drawer-resizing-active * {
  cursor: ew-resize !important;
}

@media (max-width: 768px) {
  .drawer-resize-handle,
  .drawer-maximize-btn {
    display: none !important;
  }
}
`;

@Directive({
  selector: '[appResizableDrawer]',
  standalone: true,
  exportAs: 'appResizableDrawer',
})
export class ResizableDrawerDirective implements OnInit, AfterViewInit, OnDestroy {
  @Input() defaultWidth = 580;
  @Input() minWidth = 420;
  @Input() maxWidth?: number;
  @Input() storageKey = '';
  @Input() disabled = false;
  @Input() showMaximizeButton = true;

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isBrowser = isPlatformBrowser(this.platformId);

  private handleEl: HTMLElement | null = null;
  private maximizeBtnEl: HTMLButtonElement | null = null;
  private actionsWrapperEl: HTMLElement | null = null;
  private currentWidth = 580;
  private preMaximizeWidth = 580;
  isMaximized = false;
  private isDragging = false;
  private startX = 0;
  private startWidth = 580;

  private unlistenPointerMove: (() => void) | null = null;
  private unlistenPointerUp: (() => void) | null = null;
  private unlistenHandlePointerDown: (() => void) | null = null;
  private unlistenHandleDblClick: (() => void) | null = null;
  private unlistenHandleKeyDown: (() => void) | null = null;
  private unlistenMaximizeClick: (() => void) | null = null;
  private mutationObserver?: MutationObserver;

  ngOnInit(): void {
    if (!this.isBrowser) return;

    this.ensureInjectedStyles();
    this.initCurrentWidth();
    this.ensureHostPositioning();
    this.createHandle();
    this.applyWidth(this.currentWidth);
  }

  ngAfterViewInit(): void {
    if (!this.isBrowser) return;

    if (this.showMaximizeButton) {
      this.tryAttachMaximizeButton();
      this.watchHeaderMutations();
    }
  }

  ngOnDestroy(): void {
    this.cleanUpDragging();
    this.destroyHandle();
    this.destroyMaximizeButton();
    this.mutationObserver?.disconnect();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    if (!this.isBrowser) return;

    if (window.innerWidth <= 768) {
      // Trên mobile/tablet nhỏ: để CSS media-query tự quyết định width: 100%
      this.renderer.removeStyle(this.el.nativeElement, 'width');
      this.renderer.removeStyle(this.el.nativeElement, 'max-width');
    } else {
      // Desktop: đảm bảo kích thước nằm trong giới hạn max hiện thời
      const clamped = this.clampWidth(this.currentWidth);
      if (clamped !== this.currentWidth) {
        this.currentWidth = clamped;
        this.persistWidth(this.currentWidth);
      }
      this.applyWidth(this.currentWidth);
      this.updateMaximizeState();
    }
  }

  /**
   * Khởi tạo chiều rộng ban đầu từ sessionStorage (nếu hợp lệ) hoặc defaultWidth
   */
  private initCurrentWidth(): void {
    this.currentWidth = this.defaultWidth;
    this.preMaximizeWidth = this.defaultWidth;

    if (this.storageKey) {
      try {
        const stored = sessionStorage.getItem(this.storageKey);
        if (stored) {
          const parsed = parseFloat(stored);
          if (!isNaN(parsed) && isFinite(parsed)) {
            this.currentWidth = this.clampWidth(parsed);
          }
        }
      } catch {
        // Bỏ qua lỗi truy cập sessionStorage
      }
    }
    this.updateMaximizeState();
  }

  /**
   * Tính toán giới hạn tối đa theo viewport (tương tự Chatbot AI: window.innerWidth - 32)
   */
  private computeMaxWidth(): number {
    if (!this.isBrowser) return 1440;

    const viewportW = window.innerWidth;
    const viewportMax = Math.min(viewportW * 0.85, 1440, viewportW - 32);

    if (this.maxWidth && this.maxWidth > 0) {
      return Math.min(this.maxWidth, viewportMax);
    }
    return viewportMax;
  }

  /**
   * Giới hạn kích thước chiều rộng trong [minWidth, maxWidth]
   */
  private clampWidth(width: number): number {
    const min = Math.max(280, this.minWidth);
    const max = Math.max(min, this.computeMaxWidth());
    return Math.min(max, Math.max(min, Math.round(width)));
  }

  /**
   * Áp dụng chiều rộng lên host element
   */
  private applyWidth(width: number, animate = false): void {
    if (!this.isBrowser) return;

    if (window.innerWidth <= 768) {
      this.renderer.removeStyle(this.el.nativeElement, 'width');
      this.renderer.removeStyle(this.el.nativeElement, 'max-width');
      return;
    }

    const clamped = this.clampWidth(width);

    if (animate) {
      this.renderer.setStyle(
        this.el.nativeElement,
        'transition',
        'width 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      );
      setTimeout(() => {
        if (!this.isDragging) {
          this.renderer.removeStyle(this.el.nativeElement, 'transition');
        }
      }, 260);
    }

    this.renderer.setStyle(this.el.nativeElement, 'width', `${clamped}px`);
    this.renderer.setStyle(this.el.nativeElement, 'max-width', `${this.computeMaxWidth()}px`);
  }

  /**
   * Lưu chiều rộng vào sessionStorage
   */
  private persistWidth(width: number): void {
    if (!this.storageKey || !this.isBrowser) return;
    try {
      sessionStorage.setItem(this.storageKey, String(Math.round(width)));
    } catch {
      // Ignored
    }
  }

  /**
   * Đặt lại chiều rộng mặc định
   */
  resetToDefault(): void {
    this.currentWidth = this.clampWidth(this.defaultWidth);
    this.isMaximized = false;
    this.applyWidth(this.currentWidth, true);
    this.persistWidth(this.currentWidth);
    this.updateMaximizeButtonUI();
  }

  /**
   * Phóng to / Thu nhỏ kích thước nhanh (Đồng bộ 100% với Chatbot AI)
   */
  toggleMaximize(): void {
    if (this.disabled || window.innerWidth <= 768) return;

    const maxAllowed = this.computeMaxWidth();

    if (this.isMaximized) {
      // Thu nhỏ về kích thước trước khi phóng to hoặc mặc định
      this.currentWidth = this.clampWidth(this.preMaximizeWidth || this.defaultWidth);
      this.isMaximized = false;
    } else {
      // Mở rộng tối đa
      this.preMaximizeWidth = this.currentWidth;
      this.currentWidth = maxAllowed;
      this.isMaximized = true;
    }

    this.applyWidth(this.currentWidth, true);
    this.persistWidth(this.currentWidth);
    this.updateMaximizeButtonUI();
  }

  private updateMaximizeState(): void {
    const maxAllowed = this.computeMaxWidth();
    this.isMaximized = this.currentWidth >= maxAllowed - 20;
    this.updateMaximizeButtonUI();
  }

  private updateMaximizeButtonUI(): void {
    if (!this.maximizeBtnEl) return;

    const title = this.isMaximized ? 'Thu nhỏ kích thước' : 'Mở rộng kích thước';
    this.renderer.setAttribute(this.maximizeBtnEl, 'title', title);
    this.renderer.setAttribute(this.maximizeBtnEl, 'aria-label', title);
    this.maximizeBtnEl.innerHTML = this.isMaximized ? SVG_MINIMIZE : SVG_MAXIMIZE;
  }

  /**
   * Tạo handle kéo ở cạnh trái Drawer (Đồng bộ class .drawer-resize-handle & .resize-grip)
   */
  private createHandle(): void {
    if (this.handleEl) return;

    const handle = this.renderer.createElement('div') as HTMLElement;
    this.renderer.addClass(handle, 'drawer-resize-handle');
    this.renderer.setAttribute(handle, 'role', 'separator');
    this.renderer.setAttribute(handle, 'aria-orientation', 'vertical');
    this.renderer.setAttribute(handle, 'tabindex', '0');
    this.renderer.setAttribute(
      handle,
      'title',
      'Kéo sang trái/phải để thay đổi độ rộng (Nhấp đúp để đặt lại mặc định)'
    );
    this.renderer.setAttribute(
      handle,
      'aria-label',
      'Kéo thanh này hoặc dùng phím mũi tên trái/phải để thay đổi chiều rộng bảng'
    );

    const grip = this.renderer.createElement('div');
    this.renderer.addClass(grip, 'resize-grip');
    this.renderer.setAttribute(grip, 'aria-hidden', 'true');
    this.renderer.appendChild(handle, grip);

    // Chèn handle vào vị trí đầu tiên của Drawer
    const hostEl = this.el.nativeElement;
    if (hostEl.firstChild) {
      this.renderer.insertBefore(hostEl, handle, hostEl.firstChild);
    } else {
      this.renderer.appendChild(hostEl, handle);
    }

    this.handleEl = handle;

    // Gắn sự kiện cho handle
    this.unlistenHandlePointerDown = this.renderer.listen(
      handle,
      'pointerdown',
      (e: PointerEvent) => this.onPointerDown(e)
    );
    this.unlistenHandleDblClick = this.renderer.listen(handle, 'dblclick', () => {
      this.resetToDefault();
    });
    this.unlistenHandleKeyDown = this.renderer.listen(
      handle,
      'keydown',
      (e: KeyboardEvent) => this.onKeyDown(e)
    );
  }

  private destroyHandle(): void {
    if (this.unlistenHandlePointerDown) {
      this.unlistenHandlePointerDown();
      this.unlistenHandlePointerDown = null;
    }
    if (this.unlistenHandleDblClick) {
      this.unlistenHandleDblClick();
      this.unlistenHandleDblClick = null;
    }
    if (this.unlistenHandleKeyDown) {
      this.unlistenHandleKeyDown();
      this.unlistenHandleKeyDown = null;
    }

    if (this.handleEl && this.handleEl.parentNode) {
      this.renderer.removeChild(this.handleEl.parentNode, this.handleEl);
      this.handleEl = null;
    }
  }

  /**
   * Đảm bảo phần tử Drawer có thuộc tính position và flex-shrink hợp lệ
   * (Đặc biệt tránh lỗi handle bị văng ra góc màn hình khi drawer nằm trong flex-backdrop)
   */
  private ensureHostPositioning(): void {
    if (!this.isBrowser) return;
    try {
      const hostEl = this.el.nativeElement;
      if (typeof window !== 'undefined' && window.getComputedStyle) {
        const computed = window.getComputedStyle(hostEl);
        if (!computed.position || computed.position === 'static') {
          this.renderer.setStyle(hostEl, 'position', 'relative');
        }
        if (!computed.flexShrink || computed.flexShrink === '1') {
          this.renderer.setStyle(hostEl, 'flex-shrink', '0');
        }
      } else {
        this.renderer.setStyle(hostEl, 'position', 'relative');
        this.renderer.setStyle(hostEl, 'flex-shrink', '0');
      }
    } catch {
      // Ignored
    }
  }

  /**
   * Tìm nút đóng trong Header và gắn nút Maximize đứng sát liền kề
   */
  private tryAttachMaximizeButton(): void {
    if (this.maximizeBtnEl && this.maximizeBtnEl.parentNode) return;

    const hostEl = this.el.nativeElement;
    const closeBtn = hostEl.querySelector(
      '.btn-close, .btn-close-drawer, .drawer-close-button, .drawer-close, .icon-button[aria-label="Đóng"], button[aria-label*="Đóng"], button[title*="Đóng"]'
    ) as HTMLElement | null;

    if (!closeBtn || !closeBtn.parentNode) return;

    const maxBtn = this.renderer.createElement('button') as HTMLButtonElement;
    this.renderer.addClass(maxBtn, 'drawer-maximize-btn');
    this.renderer.setAttribute(maxBtn, 'type', 'button');
    const title = this.isMaximized ? 'Thu nhỏ kích thước' : 'Mở rộng kích thước';
    this.renderer.setAttribute(maxBtn, 'title', title);
    this.renderer.setAttribute(maxBtn, 'aria-label', title);
    maxBtn.innerHTML = this.isMaximized ? SVG_MINIMIZE : SVG_MAXIMIZE;

    const parent = closeBtn.parentNode as HTMLElement;

    // Kiểm tra xem nút đóng đã nằm trong container actions (như .drawer-header-actions) chưa
    const isInsideActionsContainer =
      parent.classList.contains('drawer-header-actions') ||
      parent.classList.contains('header-actions') ||
      parent.classList.contains('actions-group');

    if (isInsideActionsContainer) {
      this.renderer.insertBefore(parent, maxBtn, closeBtn);
    } else {
      // Tự động tạo container .drawer-header-actions bọc cả 2 nút sát nhau
      const wrapper = this.renderer.createElement('div') as HTMLElement;
      this.renderer.addClass(wrapper, 'drawer-header-actions');
      this.renderer.insertBefore(parent, wrapper, closeBtn);
      this.renderer.appendChild(wrapper, maxBtn);
      this.renderer.appendChild(wrapper, closeBtn);
      this.actionsWrapperEl = wrapper;
    }

    this.maximizeBtnEl = maxBtn;

    this.unlistenMaximizeClick = this.renderer.listen(maxBtn, 'click', (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      this.toggleMaximize();
    });
  }

  private destroyMaximizeButton(): void {
    if (this.unlistenMaximizeClick) {
      this.unlistenMaximizeClick();
      this.unlistenMaximizeClick = null;
    }
    if (this.maximizeBtnEl && this.maximizeBtnEl.parentNode) {
      this.renderer.removeChild(this.maximizeBtnEl.parentNode, this.maximizeBtnEl);
      this.maximizeBtnEl = null;
    }
    if (this.actionsWrapperEl && this.actionsWrapperEl.parentNode) {
      const parent = this.actionsWrapperEl.parentNode;
      while (this.actionsWrapperEl.firstChild) {
        this.renderer.insertBefore(parent, this.actionsWrapperEl.firstChild, this.actionsWrapperEl);
      }
      this.renderer.removeChild(parent, this.actionsWrapperEl);
      this.actionsWrapperEl = null;
    }
  }

  /**
   * Lắng nghe DOM mutations để gắn nút Maximize khi header được render động (vd: *ngIf)
   */
  private watchHeaderMutations(): void {
    if (typeof MutationObserver === 'undefined') return;

    this.mutationObserver = new MutationObserver(() => {
      if (!this.maximizeBtnEl || !this.maximizeBtnEl.parentNode) {
        this.tryAttachMaximizeButton();
      }
    });

    this.mutationObserver.observe(this.el.nativeElement, {
      childList: true,
      subtree: true,
    });
  }

  /**
   * Bắt đầu kéo
   */
  private onPointerDown(event: PointerEvent): void {
    if (this.disabled) return;
    if (event.button !== 0) return; // Chỉ nhận chuột trái
    if (window.innerWidth <= 768) return;

    event.preventDefault();
    event.stopPropagation();

    this.isDragging = true;
    this.startX = event.clientX;
    this.startWidth = this.currentWidth;

    if (this.handleEl) {
      this.renderer.addClass(this.handleEl, 'active');
    }
    this.renderer.addClass(this.el.nativeElement, 'is-resizing');
    if (typeof document !== 'undefined') {
      this.renderer.addClass(document.body, 'drawer-resizing-active');
    }

    // Gắn listener toàn cục để tiếp tục nhận sự kiện dù chuột di chuyển ra khỏi Drawer
    this.unlistenPointerMove = this.renderer.listen(
      'document',
      'pointermove',
      (e: PointerEvent) => this.onPointerMove(e)
    );
    this.unlistenPointerUp = this.renderer.listen(
      'document',
      'pointerup',
      () => this.onPointerUp()
    );
  }

  /**
   * Đang kéo: tính toán chiều rộng mới
   */
  private onPointerMove(event: PointerEvent): void {
    if (!this.isDragging) return;

    // Drawer cố định mép phải -> Kéo sang trái (startX > clientX) làm tăng chiều rộng
    const delta = this.startX - event.clientX;
    const nextWidth = this.clampWidth(this.startWidth + delta);

    this.currentWidth = nextWidth;
    this.applyWidth(nextWidth);
    this.updateMaximizeState();
  }

  /**
   * Kết thúc kéo
   */
  private onPointerUp(): void {
    if (!this.isDragging) return;

    this.cleanUpDragging();
    this.persistWidth(this.currentWidth);
  }

  private cleanUpDragging(): void {
    this.isDragging = false;

    if (this.unlistenPointerMove) {
      this.unlistenPointerMove();
      this.unlistenPointerMove = null;
    }
    if (this.unlistenPointerUp) {
      this.unlistenPointerUp();
      this.unlistenPointerUp = null;
    }

    if (this.handleEl) {
      this.renderer.removeClass(this.handleEl, 'active');
    }
    this.renderer.removeClass(this.el.nativeElement, 'is-resizing');
    if (typeof document !== 'undefined') {
      this.renderer.removeClass(document.body, 'drawer-resizing-active');
    }
  }

  /**
   * Hỗ trợ Accessibility: Điều chỉnh bằng bàn phím
   */
  private onKeyDown(event: KeyboardEvent): void {
    if (this.disabled || window.innerWidth <= 768) return;

    const STEP = 20;
    let nextWidth: number | null = null;

    switch (event.key) {
      case 'ArrowLeft':
        // Mũi tên trái -> kéo rộng thêm
        nextWidth = this.currentWidth + STEP;
        break;
      case 'ArrowRight':
        // Mũi tên phải -> thu hẹp lại
        nextWidth = this.currentWidth - STEP;
        break;
      case 'Home':
        nextWidth = this.minWidth;
        break;
      case 'End':
        nextWidth = this.computeMaxWidth();
        break;
      case 'Enter':
      case ' ':
        this.resetToDefault();
        event.preventDefault();
        return;
      default:
        return;
    }

    if (nextWidth !== null) {
      event.preventDefault();
      this.currentWidth = this.clampWidth(nextWidth);
      this.applyWidth(this.currentWidth);
      this.persistWidth(this.currentWidth);
      this.updateMaximizeState();
    }
  }

  /**
   * Đảm bảo CSS của handle chỉ được inject duy nhất 1 lần vào head
   */
  private ensureInjectedStyles(): void {
    if (!this.isBrowser || typeof document === 'undefined') return;

    if (!document.getElementById(STYLE_TAG_ID)) {
      const styleEl = this.renderer.createElement('style');
      this.renderer.setAttribute(styleEl, 'id', STYLE_TAG_ID);
      this.renderer.appendChild(styleEl, this.renderer.createText(INJECTED_STYLES));
      this.renderer.appendChild(document.head, styleEl);
    }
  }
}
