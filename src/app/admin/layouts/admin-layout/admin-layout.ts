import { Component, DestroyRef, ElementRef, HostListener, ViewChild, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ActivatedRouteSnapshot,
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { clearAdminSession, getAdminRole } from '../../../guards/admin-guard';
import { NotificationBellComponent } from '../../../components/notification-bell/notification-bell';
import { AdminAssistantComponent } from '../../components/admin-assistant/admin-assistant';

import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideLayoutDashboard,
  lucideUsers,
  lucidePackage,
  lucideShoppingBag,
  lucideRotateCcw,
  lucideMessageSquare,
  lucideMenu,
  lucideBell,
  lucideChevronDown,
  lucideKeyRound,
  lucideLogOut,
  lucideTicket,
  lucideContactRound
} from '@ng-icons/lucide';

interface AdminBreadcrumb {
  label: string;
  url: string | null;
}

interface AdminMenuItem {
  label: string;
  icon: string;
  route: string;
}

interface AdminMenuGroup {
  label: string;
  items: AdminMenuItem[];
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    NgIcon,
    NotificationBellComponent,
    AdminAssistantComponent
  ],
  providers: [
    provideIcons({
      lucideLayoutDashboard,
      lucideUsers,
      lucidePackage,
      lucideShoppingBag,
      lucideRotateCcw,
      lucideMessageSquare,
      lucideMenu,
      lucideBell,
      lucideChevronDown,
      lucideKeyRound,
      lucideLogOut,
      lucideTicket,
      lucideContactRound
    })
  ],
  templateUrl: './admin-layout.html',
  styleUrl: './admin-layout.scss'
})
export class AdminLayoutComponent {
  breadcrumbs: AdminBreadcrumb[] = [];
  isSidebarCollapsed = false;
  isAccountMenuOpen = false;
  accountMenuPlacement: 'sidebar' | 'header' = 'sidebar';
  accountName = 'Quản trị viên';
  accountRole = 'Tài khoản Admin';
  accountInitial = 'Q';
  readonly adminToken = localStorage.getItem('vista_admin_token');

  @ViewChild('sidebarAccount')
  private sidebarAccount?: ElementRef<HTMLElement>;

  @ViewChild('accountMenuTrigger')
  private sidebarAccountMenuTrigger?: ElementRef<HTMLButtonElement>;

  @ViewChild('headerAccountMenuTrigger')
  private headerAccountMenuTrigger?: ElementRef<HTMLButtonElement>;

  @ViewChild('accountMenu')
  private accountMenu?: ElementRef<HTMLElement>;
  private readonly destroyRef = inject(DestroyRef);

  readonly isManager = getAdminRole() === 'Manager';

  private readonly allMenuItems: AdminMenuItem[] = [
    {
      label: 'Tổng quan',
      icon: 'lucideLayoutDashboard',
      route: '/admin/dashboard'
    },
    {
      label: 'Quản lý nhân sự',
      icon: 'lucideUsers',
      route: '/admin/staff'
    },
    {
      label: 'Danh mục sản phẩm',
      icon: 'lucidePackage',
      route: '/admin/products'
    },
    {
      label: 'Quản lý khách hàng',
      icon: 'lucideContactRound',
      route: '/admin/customers'
    },
    {
      label: 'Xử lý đơn hàng',
      icon: 'lucideShoppingBag',
      route: '/admin/orders'
    },
    {
      label: 'Hậu mãi & Đổi trả',
      icon: 'lucideRotateCcw',
      route: '/admin/returns'
    },
    {
      label: 'Kiểm duyệt đánh giá',
      icon: 'lucideMessageSquare',
      route: '/admin/reviews'
    },
    {
      label: 'Quản lý voucher',
      icon: 'lucideTicket',
      route: '/admin/promotions'
    }
  ];

  readonly menuGroups: AdminMenuGroup[] = this.isManager
    ? [
        {
          label: 'TỔNG QUAN',
          items: [this.getMenuItem('/admin/dashboard')],
        },
        {
          label: 'QUẢN LÝ & CẤU HÌNH',
          items: [
            this.getMenuItem('/admin/staff'),
            this.getMenuItem('/admin/customers'),
            this.getMenuItem('/admin/products'),
            this.getMenuItem('/admin/promotions'),
          ],
        },
        {
          label: 'GIÁM SÁT HOẠT ĐỘNG',
          items: [
            { ...this.getMenuItem('/admin/orders'), label: 'Theo dõi đơn hàng' },
            {
              ...this.getMenuItem('/admin/returns'),
              label: 'Theo dõi hậu mãi & đổi trả',
            },
            {
              ...this.getMenuItem('/admin/reviews'),
              label: 'Theo dõi kiểm duyệt đánh giá',
            },
          ],
        },
      ]
    : [];

  readonly staffMenuGroups: AdminMenuGroup[] = getAdminRole() === 'Staff'
    ? [
        {
          label: 'TRA CỨU & HỖ TRỢ',
          items: [
            this.getMenuItem('/admin/products'),
            this.getMenuItem('/admin/customers'),
            { ...this.getMenuItem('/admin/promotions'), label: 'Tra cứu voucher' },
          ],
        },
        {
          label: 'CÔNG VIỆC NGHIỆP VỤ',
          items: [
            this.getMenuItem('/admin/orders'),
            this.getMenuItem('/admin/returns'),
            this.getMenuItem('/admin/reviews'),
          ],
        },
      ]
    : [];

  constructor(private router: Router) {
    this.loadAccountInfo();
    this.updateBreadcrumbs();
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe(() => this.updateBreadcrumbs());
  }

  private getMenuItem(route: string): AdminMenuItem {
    const item = this.allMenuItems.find((menuItem) => menuItem.route === route);
    if (!item) {
      throw new Error(`Không tìm thấy mục menu quản trị cho route ${route}.`);
    }

    return item;
  }

  private updateBreadcrumbs(): void {
    const routeBreadcrumbs: Array<{ label: string; url: string }> = [];
    let activeRoute: ActivatedRouteSnapshot | null = this.router.routerState.snapshot.root;
    let activeUrl = '';

    while (activeRoute) {
      const segments = activeRoute.url.map((segment) => segment.path);
      if (segments.length > 0) {
        activeUrl += `/${segments.join('/')}`;
      }

      const label = activeRoute.data['breadcrumb'];
      if (typeof label === 'string' && label.length > 0) {
        routeBreadcrumbs.push({ label, url: activeUrl });
      }

      activeRoute = activeRoute.firstChild;
    }

    const isManager = getAdminRole() === 'Manager';
    const dashboardUrl = '/admin/dashboard';
    this.breadcrumbs = [
      {
        label: 'Quản trị',
        url: isManager && this.router.url.split(/[?#]/, 1)[0] !== dashboardUrl
          ? dashboardUrl
          : null,
      },
      ...routeBreadcrumbs.map((breadcrumb, index) => ({
        ...breadcrumb,
        url: index === routeBreadcrumbs.length - 1 ? null : breadcrumb.url,
      })),
    ];
  }

  private loadAccountInfo(): void {
    this.accountRole = getAdminRole() ?? 'Tài khoản Admin';

    try {
      const storedUser = localStorage.getItem('vista_admin_user');
      if (storedUser) {
        const user: unknown = JSON.parse(storedUser);
        if (user && typeof user === 'object' && !Array.isArray(user)) {
          const account = user as Record<string, unknown>;
          const fullName = this.getStoredText(account['Full_name']);
          const username = this.getStoredText(account['Username']);
          const email = this.getStoredText(account['Email']);

          this.accountName = fullName || username || email || this.accountName;
        }
      }
    } catch (error) {
      console.warn('Không thể đọc thông tin tài khoản Admin đã lưu.', error);
    }

    this.accountInitial = Array.from(this.accountName.trim())[0]?.toLocaleUpperCase() ?? 'Q';
  }

  private getStoredText(value: unknown): string {
    return typeof value === 'string' ? value.trim() : '';
  }

  toggleAccountMenu(placement: 'sidebar' | 'header'): void {
    if (this.isAccountMenuOpen && this.accountMenuPlacement === placement) {
      this.isAccountMenuOpen = false;
      return;
    }

    this.accountMenuPlacement = placement;
    this.isAccountMenuOpen = true;
  }

  goToChangePassword(): void {
    this.isAccountMenuOpen = false;
    this.router.navigate(['/admin/change-password']);
  }

  @HostListener('document:click', ['$event'])
  closeAccountMenuOnOutsideClick(event: MouseEvent): void {
    if (
      event.target instanceof Node &&
      !this.sidebarAccount?.nativeElement.contains(event.target) &&
      !this.headerAccountMenuTrigger?.nativeElement.contains(event.target) &&
      !this.accountMenu?.nativeElement.contains(event.target)
    ) {
      this.isAccountMenuOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  closeAccountMenuOnEscape(): void {
    if (!this.isAccountMenuOpen) {
      return;
    }

    this.isAccountMenuOpen = false;
    if (this.accountMenuPlacement === 'header') {
      this.headerAccountMenuTrigger?.nativeElement.focus();
    } else {
      this.sidebarAccountMenuTrigger?.nativeElement.focus();
    }
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  logout(): void {
    clearAdminSession();
    this.isAccountMenuOpen = false;
    this.router.navigate(['/admin/login'], { replaceUrl: true });
  }
}