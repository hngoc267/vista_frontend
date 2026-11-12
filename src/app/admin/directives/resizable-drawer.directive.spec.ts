// @vitest-environment jsdom
import '@angular/compiler';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';
import { ResizableDrawerDirective } from './resizable-drawer.directive';

describe('ResizableDrawerDirective Unit Tests', () => {
  let directive: ResizableDrawerDirective;
  let hostEl: HTMLElement;
  let store: Record<string, string> = {};

  const mockRenderer = {
    createElement: (tag: string) => document.createElement(tag),
    appendChild: (parent: any, child: any) => parent.appendChild(child),
    insertBefore: (parent: any, child: any, ref: any) => parent.insertBefore(child, ref),
    removeChild: (parent: any, child: any) => {
      if (child && child.parentNode === parent) {
        parent.removeChild(child);
      }
    },
    addClass: (el: any, cls: string) => el.classList.add(cls),
    removeClass: (el: any, cls: string) => el.classList.remove(cls),
    setAttribute: (el: any, name: string, val: string) => el.setAttribute(name, val),
    setStyle: (el: any, prop: string, val: string) => {
      el.style[prop] = val;
    },
    removeStyle: (el: any, prop: string) => {
      el.style.removeProperty(prop);
    },
    createText: (text: string) => document.createTextNode(text),
    listen: (target: any, event: string, handler: any) => {
      const t = target === 'document' ? document : target;
      t.addEventListener(event, handler);
      return () => t.removeEventListener(event, handler);
    },
  };

  beforeEach(() => {
    store = {};
    Object.defineProperty(globalThis, 'sessionStorage', {
      value: {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
          store[key] = String(value);
        },
        removeItem: (key: string) => {
          delete store[key];
        },
        clear: () => {
          store = {};
        },
      },
      writable: true,
      configurable: true,
    });

    Object.defineProperty(window, 'innerWidth', {
      value: 1440,
      writable: true,
      configurable: true,
    });

    hostEl = document.createElement('aside');
    hostEl.className = 'test-drawer';
    document.body.appendChild(hostEl);

    // Tạo directive qua Object.create để gắn các dependencies
    directive = Object.create(ResizableDrawerDirective.prototype);
    Object.assign(directive, {
      el: { nativeElement: hostEl },
      renderer: mockRenderer,
      platformId: 'browser',
      isBrowser: true,
      defaultWidth: 580,
      minWidth: 420,
      maxWidth: 1000,
      storageKey: 'test-drawer-width',
      disabled: false,
    });

    directive.ngOnInit();
  });

  afterEach(() => {
    directive.ngOnDestroy();
    if (hostEl.parentNode) {
      hostEl.parentNode.removeChild(hostEl);
    }
    vi.restoreAllMocks();
  });

  // 1. Khởi tạo đúng chiều rộng mặc định
  it('1. Khởi tạo đúng chiều rộng mặc định (580px)', () => {
    expect(hostEl.style.width).toBe('580px');
    const handle = hostEl.querySelector('.drawer-resize-handle');
    expect(handle).toBeTruthy();
    expect(handle?.getAttribute('role')).toBe('separator');
    expect(handle?.getAttribute('aria-orientation')).toBe('vertical');
  });

  // 2. Kéo mở rộng
  it('2. Kéo mép trái sang bên trái làm tăng chiều rộng Drawer', () => {
    const handle = hostEl.querySelector('.drawer-resize-handle') as HTMLElement;
    expect(handle).toBeTruthy();

    // Bắt đầu kéo tại X = 1000
    handle.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 1000, bubbles: true })
    );

    // Kéo chuột sang trái 100px (X = 900)
    document.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 900, bubbles: true })
    );

    // 580 + (1000 - 900) = 680px
    expect(hostEl.style.width).toBe('680px');

    // Thả chuột
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    expect(store['test-drawer-width']).toBe('680');
  });

  // 3. Kéo thu nhỏ
  it('3. Kéo mép trái sang bên phải làm giảm chiều rộng Drawer', () => {
    const handle = hostEl.querySelector('.drawer-resize-handle') as HTMLElement;

    // Bắt đầu kéo tại X = 1000
    handle.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 1000, bubbles: true })
    );

    // Kéo chuột sang phải 80px (X = 1080)
    document.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 1080, bubbles: true })
    );

    // 580 + (1000 - 1080) = 500px
    expect(hostEl.style.width).toBe('500px');

    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    expect(store['test-drawer-width']).toBe('500');
  });

  // 4. Giới hạn min-width
  it('4. Không thể kéo nhỏ hơn minWidth (420px)', () => {
    const handle = hostEl.querySelector('.drawer-resize-handle') as HTMLElement;

    handle.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 1000, bubbles: true })
    );

    // Kéo chuột sang phải 400px (X = 1400) -> 580 - 400 = 180px < 420px
    document.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 1400, bubbles: true })
    );

    expect(hostEl.style.width).toBe('420px');

    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    expect(store['test-drawer-width']).toBe('420');
  });

  // 5. Giới hạn max-width
  it('5. Không thể kéo vượt quá giới hạn maxWidth (1000px)', () => {
    const handle = hostEl.querySelector('.drawer-resize-handle') as HTMLElement;

    handle.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 1000, bubbles: true })
    );

    // Kéo chuột sang trái 800px (X = 200) -> 580 + 800 = 1380px > maxWidth (1000px)
    document.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 200, bubbles: true })
    );

    expect(hostEl.style.width).toBe('1000px');

    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    expect(store['test-drawer-width']).toBe('1000');
  });

  // 6. Lưu kích thước vào sessionStorage
  it('6. Kích thước sau khi kéo được lưu chính xác vào sessionStorage', () => {
    const handle = hostEl.querySelector('.drawer-resize-handle') as HTMLElement;

    handle.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 800, bubbles: true })
    );
    document.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 750, bubbles: true })
    );
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    // 580 + 50 = 630px
    expect(store['test-drawer-width']).toBe('630');
  });

  // 7. Khôi phục kích thước khi khởi tạo lại
  it('7. Khôi phục kích thước từ sessionStorage khi khởi tạo directive mới', () => {
    store['test-drawer-width'] = '720';

    const anotherHost = document.createElement('aside');
    document.body.appendChild(anotherHost);

    const anotherDirective = Object.create(ResizableDrawerDirective.prototype);
    Object.assign(anotherDirective, {
      el: { nativeElement: anotherHost },
      renderer: mockRenderer,
      platformId: 'browser',
      isBrowser: true,
      defaultWidth: 580,
      minWidth: 420,
      maxWidth: 1000,
      storageKey: 'test-drawer-width',
      disabled: false,
    });

    anotherDirective.ngOnInit();
    expect(anotherHost.style.width).toBe('720px');

    anotherDirective.ngOnDestroy();
    anotherHost.remove();
  });

  // 8. Double-click khôi phục mặc định
  it('8. Nhấp đúp chuột (dblclick) vào handle khôi phục chiều rộng mặc định (580px)', () => {
    const handle = hostEl.querySelector('.drawer-resize-handle') as HTMLElement;

    // Kéo sang 700px trước
    handle.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 1000, bubbles: true })
    );
    document.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 880, bubbles: true })
    );
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    expect(hostEl.style.width).toBe('700px');

    // Double-click handle
    handle.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    expect(hostEl.style.width).toBe('580px');
    expect(store['test-drawer-width']).toBe('580');
  });

  // 9. Xử lý storage không hợp lệ
  it('9. Xử lý an toàn khi giá trị trong sessionStorage không hợp lệ (fallback defaultWidth)', () => {
    store['test-drawer-width'] = 'invalid-number';

    const anotherHost = document.createElement('aside');
    document.body.appendChild(anotherHost);

    const anotherDirective = Object.create(ResizableDrawerDirective.prototype);
    Object.assign(anotherDirective, {
      el: { nativeElement: anotherHost },
      renderer: mockRenderer,
      platformId: 'browser',
      isBrowser: true,
      defaultWidth: 580,
      minWidth: 420,
      maxWidth: 1000,
      storageKey: 'test-drawer-width',
      disabled: false,
    });

    anotherDirective.ngOnInit();
    expect(anotherHost.style.width).toBe('580px');

    anotherDirective.ngOnDestroy();
    anotherHost.remove();
  });

  // 10. Dọn dẹp listener khi destroy
  it('10. Dọn dẹp đầy đủ event listeners và handle element khi directive bị destroy', () => {
    expect(hostEl.querySelector('.drawer-resize-handle')).toBeTruthy();

    directive.ngOnDestroy();

    expect(hostEl.querySelector('.drawer-resize-handle')).toBeNull();
    expect(document.body.classList.contains('drawer-resizing-active')).toBe(false);
  });

  // 11. Vô hiệu hóa resize trên mobile
  it('11. Vô hiệu hóa thao tác kéo trên màn hình di động (<= 768px)', () => {
    Object.defineProperty(window, 'innerWidth', { value: 600, writable: true, configurable: true });
    directive.onWindowResize();

    // Inline style width bị gỡ bỏ để nhường quyền cho CSS responsive
    expect(hostEl.style.width).toBe('');

    const handle = hostEl.querySelector('.drawer-resize-handle') as HTMLElement;
    // Thao tác pointerdown không kích hoạt dragging
    handle.dispatchEvent(
      new PointerEvent('pointerdown', { button: 0, clientX: 500, bubbles: true })
    );
    document.dispatchEvent(
      new PointerEvent('pointermove', { clientX: 400, bubbles: true })
    );
    document.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));

    expect(hostEl.style.width).toBe('');
  });

  // 12. Điều chỉnh chiều rộng bằng bàn phím
  it('12. Hỗ trợ điều chỉnh kích thước bằng bàn phím (ArrowLeft, ArrowRight, Home, End, Enter)', () => {
    const handle = hostEl.querySelector('.drawer-resize-handle') as HTMLElement;

    // ArrowLeft: tăng thêm 20px (580 -> 600)
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
    expect(hostEl.style.width).toBe('600px');
    expect(store['test-drawer-width']).toBe('600');

    // ArrowRight: giảm 20px (600 -> 580)
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(hostEl.style.width).toBe('580px');

    // Home: về minWidth (420px)
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    expect(hostEl.style.width).toBe('420px');

    // End: lên maxWidth (1000px)
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    expect(hostEl.style.width).toBe('1000px');

    // Enter: reset về defaultWidth (580px)
    handle.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(hostEl.style.width).toBe('580px');
  });

  // 13. Tự động gom nút Phóng to / Thu nhỏ sát liền kề nút đóng (Header Actions)
  it('13. Gắn nút Maximize và gom nhóm sát cạnh nút Close trong .drawer-header-actions', () => {
    const header = document.createElement('header');
    header.className = 'drawer-header';
    const closeBtn = document.createElement('button');
    closeBtn.className = 'btn-close';
    closeBtn.setAttribute('aria-label', 'Đóng');
    header.appendChild(closeBtn);
    hostEl.appendChild(header);

    // Kích hoạt ngAfterViewInit để gắn nút Maximize
    directive.showMaximizeButton = true;
    directive.ngAfterViewInit();

    const maxBtn = hostEl.querySelector('.drawer-maximize-btn') as HTMLButtonElement;
    expect(maxBtn).toBeTruthy();

    // Cả 2 nút phải cùng nằm chung trong container .drawer-header-actions
    const container = maxBtn.parentElement;
    expect(container?.classList.contains('drawer-header-actions')).toBe(true);
    expect(closeBtn.parentElement).toBe(container);
    // maxBtn phải nằm ngay trước closeBtn
    expect(maxBtn.nextElementSibling).toBe(closeBtn);
  });

  // 14. Đảm bảo position relative và flex-shrink 0 khi host có static positioning
  it('14. Đảm bảo position relative và flex-shrink 0 để handle không bị văng ra khỏi drawer', () => {
    expect(hostEl.style.position).toBe('relative');
    expect(hostEl.style.flexShrink).toBe('0');
  });
});
