import { CommonModule } from '@angular/common';
import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
  expiresInDays?: number;
  description: string;
  benefits: string[];
  conditions: string[];
  startDate: string;
  usageLimit: string;
  statusText: string;
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

  tabs: { key: VoucherTab; label: string }[] = [
    { key: 'all', label: 'Tất cả' },
    { key: 'freeship', label: 'Freeship' },
    { key: 'discount', label: 'Giảm sản phẩm' },
    { key: 'used', label: 'Đã dùng' },
    { key: 'expiring', label: 'Sắp hết hạn' },
  ];

  // Khai báo mảng rỗng, đợi API trả dữ liệu về
  vouchers: VoucherItem[] = [];

  constructor(
    private voucherService: VoucherService,
    private cdr: ChangeDetectorRef
  ) {}

  // Vừa vào trang là gọi API liền
  ngOnInit(): void {
    this.voucherService.getAllVouchers().subscribe({
      next: (res) => {
        if (res.success) {
          this.vouchers = res.data;
          this.cdr.detectChanges(); // Báo cho giao diện cập nhật
        }
      },
      error: (err) => console.error('Lỗi khi lấy voucher từ API:', err)
    });
  }

  get filteredVouchers(): VoucherItem[] {
    if (this.activeTab === 'all') return this.vouchers;
    if (this.activeTab === 'used') return this.vouchers.filter(voucher => voucher.status === 'used');
    if (this.activeTab === 'expiring') return this.vouchers.filter(voucher => voucher.status === 'expiring');
    return this.vouchers.filter(voucher => voucher.category === this.activeTab);
  }

  setTab(tab: VoucherTab): void {
    this.activeTab = tab;
  }

  getDaysLeft(voucher: VoucherItem): number {
    return voucher.expiresInDays ?? 0;
  }

  getExpiryDate(voucher: VoucherItem): string {
    if (voucher.expiresInDays !== undefined) {
      const date = new Date();
      date.setDate(date.getDate() + voucher.expiresInDays);

      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();

      return `${day}/${month}/${year}`;
    }

    return voucher.expiry ?? '';
  }

  copyCode(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.copyMessage = 'Đã sao chép mã giảm giá';

      setTimeout(() => {
        this.copyMessage = '';
      }, 1800);
    });
  }

  openVoucherDetail(voucher: VoucherItem): void {
    this.selectedVoucher = voucher;
  }

  closeVoucherDetail(): void {
    this.selectedVoucher = null;
  }
}