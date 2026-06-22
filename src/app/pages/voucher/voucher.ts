import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { VoucherService } from '../../services/voucher';

type VoucherTab = 'all' | 'freeship' | 'discount' | 'used' | 'expiring';

interface VoucherItem {
  code: string;
  title: string;
  condition: string;
  type: 'percent' | 'shipping';
  category: 'freeship' | 'discount';
  status: 'available' | 'used' | 'expiring';
  expiry?: string;
  daysLeft?: number | null;
  description: string;
  benefits: string[];
  conditions: string[];
  startDate: string;
  usageLimit: string;
  statusText: string;
}

interface VoucherResponse {
  success: boolean;
  data: VoucherItem[];
}

@Component({
  selector: 'app-voucher',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './voucher.html',
  styleUrl: './voucher.scss',
})
export class Voucher implements OnInit {
  activeTab: VoucherTab = 'all';
  copyMessage = '';
  selectedVoucher: VoucherItem | null = null;
  vouchers: VoucherItem[] = [];
  isLoading = false;

  tabs: { key: VoucherTab; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'freeship', label: 'Freeship' },
    { key: 'discount', label: 'Giảm sản phẩm' },
    { key: 'used', label: 'Đã dùng' },
    { key: 'expiring', label: 'Sắp hết hạn' },
  ];

  constructor(
    private voucherService: VoucherService,
    private cdr: ChangeDetectorRef,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.activeTab = 'all';
    this.loadVouchers();
  }

  loadVouchers(): void {
    this.isLoading = true;

    this.voucherService.getMyVouchers().subscribe({
      next: (res: VoucherResponse) => {
        this.vouchers = [...(res.data || [])].filter((voucher) => this.isVoucherStillValid(voucher));
        this.activeTab = 'all';
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: (err: unknown) => {
        console.error('Không thể tải voucher:', err);
        this.vouchers = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  get filteredVouchers(): VoucherItem[] {
    if (this.activeTab === 'all') {
      return this.vouchers.filter((voucher: VoucherItem) => voucher.status !== 'used');
    }

    if (this.activeTab === 'used') {
      return this.vouchers.filter((voucher: VoucherItem) => voucher.status === 'used');
    }

    if (this.activeTab === 'expiring') {
      return this.vouchers.filter((voucher: VoucherItem) => voucher.status === 'expiring');
    }

    return this.vouchers.filter((voucher: VoucherItem) => voucher.category === this.activeTab);
  }

  setTab(tab: VoucherTab): void {
    this.activeTab = tab;
  }

  getDaysLeft(voucher: VoucherItem): number {
    return voucher.daysLeft ?? 0;
  }

  getExpiryDate(voucher: VoucherItem): string {
    return voucher.expiry || '';
  }

  copyCode(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.copyMessage = 'Đã sao chép mã giảm giá';

      setTimeout(() => {
        this.copyMessage = '';
        this.cdr.detectChanges();
      }, 1800);
    });
  }

  openVoucherDetail(voucher: VoucherItem): void {
    this.selectedVoucher = voucher;
  }

  closeVoucherDetail(): void {
    this.selectedVoucher = null;
  }

  applyVoucher(voucher: VoucherItem): void {
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem('vista_pending_voucher_code', voucher.code);
    }

    this.selectedVoucher = null;
    this.router.navigate(['/order']);
  }

  private isVoucherStillValid(voucher: VoucherItem): boolean {
    if (!voucher.expiry) {
      return true;
    }

    const [day, month, year] = String(voucher.expiry).split('/').map((part) => Number(part));
    if (!day || !month || !year) {
      return true;
    }

    const expiry = new Date(year, month - 1, day, 23, 59, 59, 999);
    return expiry >= new Date();
  }
}
