import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';

import { AdminLayoutComponent } from './admin-layout';

@Component({
  standalone: true,
  template: '',
})
class AdminRouteStub {}

describe('AdminLayout', () => {
  let component: AdminLayoutComponent;
  let fixture: ComponentFixture<AdminLayoutComponent>;
  let router: Router;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AdminLayoutComponent],
      providers: [
        provideRouter([
          {
            path: 'admin',
            component: AdminRouteStub,
            children: [
              {
                path: 'dashboard',
                component: AdminRouteStub,
                data: { breadcrumb: 'Tổng quan' },
              },
              {
                path: 'orders',
                component: AdminRouteStub,
                data: { breadcrumb: 'Xử lý đơn hàng' },
              },
              {
                path: 'staff',
                component: AdminRouteStub,
                data: { breadcrumb: 'Quản lý nhân sự' },
              },
              {
                path: 'customers',
                component: AdminRouteStub,
                data: { breadcrumb: 'Quản lý khách hàng' },
              },
              {
                path: 'products',
                component: AdminRouteStub,
                data: { breadcrumb: 'Danh mục sản phẩm' },
                children: [
                  {
                    path: ':id',
                    component: AdminRouteStub,
                    data: { breadcrumb: 'Chi tiết sản phẩm' },
                  },
                ],
              },
              {
                path: 'promotions',
                component: AdminRouteStub,
                data: { breadcrumb: 'Quản lý voucher' },
              },
              {
                path: 'returns',
                component: AdminRouteStub,
                data: { breadcrumb: 'Hậu mãi & Đổi trả' },
              },
              {
                path: 'reviews',
                component: AdminRouteStub,
                data: { breadcrumb: 'Kiểm duyệt đánh giá' },
              },
            ],
          },
        ]),
      ],
    }).compileComponents();
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigate').mockResolvedValue(true);
  });

  afterEach(() => {
    localStorage.removeItem('vista_admin_token');
    localStorage.removeItem('vista_admin_user');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    vi.restoreAllMocks();
  });

  function createComponent(role: string): void {
    localStorage.setItem('vista_admin_token', 'test-token');
    localStorage.setItem('vista_admin_user', JSON.stringify({ Role: role }));
    fixture = TestBed.createComponent(AdminLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  it('should create', () => {
    createComponent('Manager');
    expect(component).toBeTruthy();
  });

  it('shows the grouped management and monitoring menu to a Manager', () => {
    createComponent('Manager');

    const groups = Array.from(
      fixture.nativeElement.querySelectorAll('.sidebar-nav-group') as NodeListOf<HTMLElement>
    );
    expect(groups.map((group) => group.querySelector('.sidebar-group-title')?.textContent?.trim()))
      .toEqual(['TỔNG QUAN', 'QUẢN LÝ & CẤU HÌNH', 'GIÁM SÁT HOẠT ĐỘNG']);

    const menuItems = Array.from(
      fixture.nativeElement.querySelectorAll('.menu-item') as NodeListOf<HTMLElement>
    );
    expect(menuItems.map((item) => item.textContent?.trim())).toEqual([
      'Tổng quan',
      'Quản lý nhân sự',
      'Quản lý khách hàng',
      'Danh mục sản phẩm',
      'Quản lý voucher',
      'Theo dõi đơn hàng',
      'Theo dõi hậu mãi & đổi trả',
      'Theo dõi kiểm duyệt đánh giá',
    ]);
    expect(menuItems.map((item) => item.getAttribute('href'))).toEqual([
      '/admin/dashboard',
      '/admin/staff',
      '/admin/customers',
      '/admin/products',
      '/admin/promotions',
      '/admin/orders',
      '/admin/returns',
      '/admin/reviews',
    ]);
    expect(fixture.nativeElement.querySelector('.account-section-title').textContent.trim())
      .toBe('TÀI KHOẢN');
  });

  it('shows Staff menu items in their requested groups and keeps the existing routes', () => {
    createComponent('Staff');

    const groups = Array.from(
      fixture.nativeElement.querySelectorAll('.sidebar-nav-group') as NodeListOf<HTMLElement>
    );
    expect(groups.map((group) => group.querySelector('.sidebar-group-title')?.textContent?.trim()))
      .toEqual(['TRA CỨU & HỖ TRỢ', 'CÔNG VIỆC NGHIỆP VỤ']);

    expect(groups.map((group) =>
      Array.from(group.querySelectorAll('.menu-item') as NodeListOf<HTMLElement>)
        .map((item) => item.textContent?.trim())
    )).toEqual([
      ['Danh mục sản phẩm', 'Quản lý khách hàng', 'Tra cứu voucher'],
      ['Xử lý đơn hàng', 'Hậu mãi & Đổi trả', 'Kiểm duyệt đánh giá'],
    ]);

    expect(Array.from(
      fixture.nativeElement.querySelectorAll('.menu-item') as NodeListOf<HTMLElement>
    ).map((item) => item.getAttribute('href'))).toEqual([
      '/admin/products',
      '/admin/customers',
      '/admin/promotions',
      '/admin/orders',
      '/admin/returns',
      '/admin/reviews',
    ]);
    expect(fixture.nativeElement.querySelector('.account-section-title').textContent.trim())
      .toBe('TÀI KHOẢN');
  });

  it('uses the Staff lookup label without changing the Manager voucher label', () => {
    createComponent('Staff');
    let voucherItem = Array.from(
      fixture.nativeElement.querySelectorAll('.menu-item') as NodeListOf<HTMLElement>
    ).find((item) => item.getAttribute('href') === '/admin/promotions');
    expect(voucherItem?.textContent?.trim()).toBe('Tra cứu voucher');

    fixture.destroy();
    createComponent('Manager');
    voucherItem = Array.from(
      fixture.nativeElement.querySelectorAll('.menu-item') as NodeListOf<HTMLElement>
    ).find((item) => item.getAttribute('href') === '/admin/promotions');
    expect(voucherItem?.textContent?.trim()).toBe('Quản lý voucher');
  });

  it('keeps the Manager menu item active on a nested route after initial navigation', async () => {
    createComponent('Manager');
    await router.navigateByUrl('/admin/products/123');
    fixture.detectChanges();

    const activeMenuItem = fixture.nativeElement.querySelector('.menu-item.active');
    expect(activeMenuItem?.textContent?.trim()).toBe('Danh mục sản phẩm');
    expect(activeMenuItem?.getAttribute('href')).toBe('/admin/products');
  });

  it('navigates to and activates every Manager menu route', async () => {
    createComponent('Manager');
    const menuRoutes = [
      '/admin/dashboard',
      '/admin/staff',
      '/admin/customers',
      '/admin/products',
      '/admin/promotions',
      '/admin/orders',
      '/admin/returns',
      '/admin/reviews',
    ];

    for (const route of menuRoutes) {
      await router.navigateByUrl(route);
      fixture.detectChanges();

      expect(router.url).toBe(route);
      expect(fixture.nativeElement.querySelector('.menu-item.active')?.getAttribute('href'))
        .toBe(route);
    }
  });

  it('shows no menu items for an invalid role', () => {
    createComponent('Customer');

    expect(fixture.nativeElement.querySelectorAll('.menu-item').length).toBe(0);
  });

  it('updates the breadcrumb after Angular Router navigation', async () => {
    createComponent('Manager');

    await router.navigateByUrl('/admin/promotions');
    fixture.detectChanges();

    const breadcrumb = fixture.nativeElement.querySelector('.header-breadcrumb');
    expect(breadcrumb.textContent).toContain('Quản trị');
    expect(breadcrumb.textContent).toContain('Quản lý voucher');
    expect(breadcrumb.querySelector('.breadcrumb-current').textContent.trim())
      .toBe('Quản lý voucher');
    expect(breadcrumb.querySelector('a.breadcrumb-parent').getAttribute('href'))
      .toBe('/admin/dashboard');
  });

  it('shows route parents for a nested Admin page on initial load', async () => {
    localStorage.setItem('vista_admin_token', 'test-token');
    localStorage.setItem('vista_admin_user', JSON.stringify({ Role: 'Manager' }));
    await router.navigateByUrl('/admin/products/123');

    fixture = TestBed.createComponent(AdminLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    const breadcrumb = fixture.nativeElement.querySelector('.header-breadcrumb');
    expect(breadcrumb.textContent).toContain('Quản trị');
    expect(breadcrumb.textContent).toContain('Danh mục sản phẩm');
    expect(breadcrumb.textContent).toContain('Chi tiết sản phẩm');
    expect(breadcrumb.querySelectorAll('a.breadcrumb-parent').length).toBe(2);
    expect(breadcrumb.querySelector('.breadcrumb-current').textContent.trim())
      .toBe('Chi tiết sản phẩm');
  });

  it('does not link the Admin root to a page hidden from Staff', async () => {
    createComponent('Staff');

    await router.navigateByUrl('/admin/orders');
    fixture.detectChanges();

    const rootBreadcrumb = Array.from(
      fixture.nativeElement.querySelectorAll(
        '.header-breadcrumb > *'
      ) as NodeListOf<HTMLElement>
    ).find((element) => element.textContent?.trim() === 'Quản trị');
    expect(rootBreadcrumb?.tagName.toLowerCase()).toBe('span');
  });

  it('shows the signed-in Admin name, role and avatar initial', () => {
    localStorage.setItem('vista_admin_token', 'test-token');
    localStorage.setItem('vista_admin_user', JSON.stringify({
      Full_name: 'Nguyen Thi An',
      Username: 'an.nguyen',
      Role: 'Staff',
    }));
    fixture = TestBed.createComponent(AdminLayoutComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.admin-info strong').textContent.trim())
      .toBe('Nguyen Thi An');
    expect(fixture.nativeElement.querySelector('.admin-info span').textContent.trim())
      .toBe('Staff');
    expect(fixture.nativeElement.querySelector('.admin-avatar').textContent.trim())
      .toBe('N');
    expect(fixture.nativeElement.querySelector('.account-info strong').textContent.trim())
      .toBe('Nguyen Thi An');
    expect(fixture.nativeElement.querySelector('.account-info span').textContent.trim())
      .toBe('Staff');
    expect(fixture.nativeElement.querySelector('.header-avatar').textContent.trim())
      .toBe('N');
  });

  it('opens the shared account menu from the Header without logging out', () => {
    createComponent('Manager');
    const logoutSpy = vi.spyOn(component, 'logout');

    fixture.nativeElement.querySelector('.account-button').click();
    fixture.detectChanges();

    expect(component.isAccountMenuOpen).toBe(true);
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeTruthy();
    expect(logoutSpy).not.toHaveBeenCalled();
    expect(localStorage.getItem('vista_admin_token')).toBe('test-token');
  });

  it('opens the account menu and closes it with Escape', () => {
    createComponent('Manager');

    fixture.nativeElement.querySelector('.sidebar-account-trigger').click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeTruthy();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="menu"]')).toBeNull();
  });

  it('navigates to the Admin password change page from the account menu', () => {
    createComponent('Manager');

    component.goToChangePassword();

    expect(component.isAccountMenuOpen).toBe(false);
    expect(router.navigate).toHaveBeenCalledWith(['/admin/change-password']);
  });

  it('clears the Admin session and navigates to the Admin login on logout', () => {
    createComponent('Manager');
    localStorage.setItem('token', 'customer-token');
    localStorage.setItem('user', JSON.stringify({ Role: 'Customer' }));

    component.logout();

    expect(localStorage.getItem('vista_admin_token')).toBeNull();
    expect(localStorage.getItem('vista_admin_user')).toBeNull();
    expect(localStorage.getItem('token')).toBe('customer-token');
    expect(localStorage.getItem('user')).toBe(JSON.stringify({ Role: 'Customer' }));
    expect(router.navigate).toHaveBeenCalledWith(
      ['/admin/login'],
      { replaceUrl: true },
    );
  });
});
