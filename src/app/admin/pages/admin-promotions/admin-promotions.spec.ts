import '@angular/compiler';
import { describe, expect, it, beforeEach } from 'vitest';
import { of } from 'rxjs';
import { AdminPromotionService, PromotionFilters } from '../../services/admin-promotion';

// Polyfill localStorage cho môi trường node vitest
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

describe('AdminPromotionService (Unit tests with mock HttpClient)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('should call getPromotions and return API response', async () => {
    const mockResponse = {
      success: true,
      data: {
        items: [
          {
            id: '664c1234567890abcdef1234',
            code: 'VISTANEW2026',
            title: 'Chào mừng thành viên mới 2026',
            description: 'Giảm 15% cho đơn đầu',
            type: 'percent' as const,
            discountValue: 15,
            minOrderValue: 500000,
            usageLimit: 1000,
            usedCount: 428,
            usageLimitPerCustomer: 1,
            scope: 'all_products' as const,
            startDate: '2026-01-01',
            endDate: '2026-12-31',
            status: 'active' as const,
            createdAt: '2026-01-01T08:00:00Z'
          }
        ],
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        stats: {
          total: 1,
          active: 1,
          upcoming: 0,
          expired: 0,
          paused: 0,
          draft: 0
        }
      }
    };

    let calledUrl = '';
    const mockHttp = {
      get: (url: string, _options: any) => {
        calledUrl = url;
        return of(mockResponse);
      }
    } as any;

    localStorage.setItem('vista_admin_token', 'mock_jwt_token_for_test');

    const service = new AdminPromotionService(mockHttp);
    const filters: PromotionFilters = { keyword: 'VISTA', status: 'active', page: 1, limit: 10 };

    service.getPromotions(filters).subscribe((res) => {
      expect(res.success).toBe(true);
      expect(res.data.items.length).toBe(1);
      expect(res.data.items[0].code).toBe('VISTANEW2026');
      expect(calledUrl).toContain('/admin/promotions');
    });
  });

  it('should include the selected date filter in the request', () => {
    localStorage.setItem('vista_admin_token', 'mock_jwt_token');
    let calledParams: any;
    const mockHttp = {
      get: (_url: string, options: any) => {
        calledParams = options.params;
        return of({ success: true, data: { items: [] } });
      }
    } as any;

    const service = new AdminPromotionService(mockHttp);
    service.getPromotions({ dateFilter: 'today' }).subscribe();

    expect(calledParams.get('dateFilter')).toBe('today');
  });

  it('should throw error when calling API without admin token', async () => {
    localStorage.removeItem('vista_admin_token');
    const mockHttp = { get: () => of({}) } as any;
    const service = new AdminPromotionService(mockHttp);

    service.getPromotions().subscribe({
      next: () => {
        throw new Error('Should have failed without token');
      },
      error: (err) => {
        expect(err.message).toMatch(/Phiên làm việc đã hết hạn hoặc chưa đăng nhập/);
      }
    });
  });

  it('should call getPromotionById with encoded ID', async () => {
    localStorage.setItem('vista_admin_token', 'mock_jwt_token');
    let calledUrl = '';
    const mockHttp = {
      get: (url: string) => {
        calledUrl = url;
        return of({ success: true, data: { id: 'PRM_001', code: 'PROMO1' } });
      }
    } as any;

    const service = new AdminPromotionService(mockHttp);
    service.getPromotionById('PRM_001').subscribe((res) => {
      expect(calledUrl).toContain('/admin/promotions/PRM_001');
      expect(res.data.code).toBe('PROMO1');
    });
  });

  it('should call changeStatus with PATCH and correct body', async () => {
    localStorage.setItem('vista_admin_token', 'mock_jwt_token');
    let calledMethod = '';
    let calledBody: any = null;
    const mockHttp = {
      patch: (url: string, body: any) => {
        calledMethod = 'PATCH';
        calledBody = body;
        return of({ success: true, message: 'Status updated' });
      }
    } as any;

    const service = new AdminPromotionService(mockHttp);
    service.changeStatus('PRM_001', 'paused').subscribe((res) => {
      expect(calledMethod).toBe('PATCH');
      expect(calledBody).toEqual({ status: 'paused' });
      expect(res.success).toBe(true);
    });
  });

  it('should call deletePromotion with DELETE method', async () => {
    localStorage.setItem('vista_admin_token', 'mock_jwt_token');
    let calledMethod = '';
    const mockHttp = {
      delete: (url: string) => {
        calledMethod = 'DELETE';
        return of({ success: true, message: 'Deleted' });
      }
    } as any;

    const service = new AdminPromotionService(mockHttp);
    service.deletePromotion('PRM_001').subscribe((res) => {
      expect(calledMethod).toBe('DELETE');
      expect(res.success).toBe(true);
    });
  });

  describe('Frontend Formatting & Labels (getDiscountDisplay, getTypeLabel, getStatusLabel)', () => {
    let component: any;

    beforeEach(async () => {
      const { AdminPromotionsComponent } = await import('./admin-promotions');
      component = Object.create(AdminPromotionsComponent.prototype);
    });

    it('Freeship: Displays "Miễn phí vận chuyển" neutrally when no maxDiscountAmount, or with cap if available', () => {
      // Freeship không có mức giảm tối đa -> Nhãn trung tính
      const promoUncapped: any = {
        type: 'free_shipping',
        discountValue: 0,
        maxDiscountAmount: 0
      };
      expect(component.getDiscountDisplay(promoUncapped)).toBe('Miễn phí vận chuyển');

      // Freeship có mức giảm tối đa 30.000₫
      const promoCapped: any = {
        type: 'free_shipping',
        discountValue: 30000,
        maxDiscountAmount: 30000
      };
      expect(component.getDiscountDisplay(promoCapped)).toBe('Miễn phí vận chuyển (Tối đa 30.000₫)');
    });

    it('Percent & Fixed: Formats percent and fixed amount discounts correctly', () => {
      // Percent
      const percentPromo: any = {
        type: 'percent',
        discountValue: 15,
        maxDiscountAmount: 500000
      };
      expect(component.getDiscountDisplay(percentPromo)).toBe('Giảm 15% (Tối đa 500.000₫)');

      // Fixed Amount
      const fixedPromo: any = {
        type: 'fixed_amount',
        discountValue: 50000
      };
      expect(component.getDiscountDisplay(fixedPromo)).toBe('Giảm 50.000₫');

      // Alias 'fixed'
      const fixedAliasPromo: any = {
        type: 'fixed',
        discountValue: 25000
      };
      expect(component.getDiscountDisplay(fixedAliasPromo)).toBe('Giảm 25.000₫');
    });

    it('Type Label: Translates percent, fixed_amount, fixed, free_shipping, shipping to Vietnamese', () => {
      expect(component.getTypeLabel('percent')).toBe('Giảm theo %');
      expect(component.getTypeLabel('fixed_amount')).toBe('Giảm tiền mặt');
      expect(component.getTypeLabel('fixed')).toBe('Giảm tiền mặt');
      expect(component.getTypeLabel('free_shipping')).toBe('Freeship');
      expect(component.getTypeLabel('shipping')).toBe('Freeship');
    });

    it('Status Label: Translates both standard and legacy status codes to Vietnamese', () => {
      expect(component.getStatusLabel('active')).toBe('Đang diễn ra');
      expect(component.getStatusLabel('upcoming')).toBe('Sắp diễn ra');
      expect(component.getStatusLabel('paused')).toBe('Đã tạm dừng');
      expect(component.getStatusLabel('draft')).toBe('Bản nháp');
      expect(component.getStatusLabel('expired')).toBe('Đã kết thúc');
      expect(component.getStatusLabel('out_of_quota')).toBe('Đã hết lượt');
      expect(component.getStatusLabel('available')).toBe('Khả dụng');
      expect(component.getStatusLabel('expiring')).toBe('Sắp hết hạn');
      expect(component.getStatusLabel('used')).toBe('Đã hết lượt');
    });

    it('opens list details immediately without requesting the detail endpoint', async () => {
      const { AdminPromotionsComponent } = await import('./admin-promotions');
      const page = Object.create(AdminPromotionsComponent.prototype);
      let detailRequestCalled = false;
      page.detailRequestId = 3;
      page.promotionService = {
        getPromotionById: () => {
          detailRequestCalled = true;
          return of({});
        }
      };
      page.selectedPromotion = null;
      page.isDetailOpen = false;
      page.isDetailLoading = true;

      const promotion = {
        id: 'promo-1',
        code: 'SAVE',
        usedCount: 5,
        usageLimit: 10000
      };
      page.openDetail(promotion);

      expect(detailRequestCalled).toBe(false);
      expect(page.selectedPromotion).toEqual(promotion);
      expect(page.isDetailOpen).toBe(true);
      expect(page.isDetailLoading).toBe(false);
      expect(page.detailRequestId).toBe(4);
    });

    it('does not let a stale detail response lower usage below the list count', () => {
      const merged = component.mergePromotionUsage(
        { id: 'promo-1', code: 'SAVE', usedCount: 0 } as any,
        { id: 'promo-1', code: 'SAVE', usedCount: 5 } as any
      );

      expect(merged.usedCount).toBe(5);
      expect(component.getUsagePercent(merged.usedCount, 10000)).toBe(0);
    });
  });
});
