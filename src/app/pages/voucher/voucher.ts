import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';

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
  imports: [CommonModule],
  templateUrl: './voucher.html',
  styleUrl: './voucher.scss',
})
export class Voucher {
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

  vouchers: VoucherItem[] = [
    {
      code: 'VISTA10',
      title: 'Giảm 10%',
      condition: 'Cho đơn hàng từ 5.000.000',
      type: 'percent',
      category: 'discount',
      status: 'expiring',
      expiresInDays: 4,
      description: 'Giảm 10% toàn đơn hàng',
      benefits: ['Giảm 10% giá trị đơn hàng.', 'Giảm tối đa 500.000đ.'],
      conditions: ['Đơn hàng từ 5.000.000đ.', 'Áp dụng cho tất cả sản phẩm trên hệ thống.'],
      startDate: '01/01/2026',
      usageLimit: 'Mỗi tài khoản sử dụng 1 lần.',
      statusText: 'Còn hiệu lực.',
    },
    {
      code: 'VISTA30',
      title: 'Giảm 30K',
      condition: 'Cho đơn hàng từ 2.000.000',
      type: 'shipping',
      category: 'freeship',
      status: 'expiring',
      expiresInDays: 4,
      description: 'Giảm 30.000đ phí vận chuyển',
      benefits: ['Giảm trực tiếp 30.000đ phí vận chuyển.', 'Áp dụng khi thanh toán đơn hàng hợp lệ.'],
      conditions: ['Đơn hàng từ 2.000.000đ.', 'Áp dụng cho đơn giao hàng toàn quốc.'],
      startDate: '01/01/2026',
      usageLimit: 'Mỗi tài khoản sử dụng 1 lần.',
      statusText: 'Còn hiệu lực.',
    },
    {
      code: 'FREESHIP',
      title: 'Freeship toàn quốc',
      condition: 'Đơn từ 5.000.000đ',
      type: 'shipping',
      category: 'freeship',
      status: 'available',
      expiry: '31/12/2026',
      description: 'Miễn phí vận chuyển toàn quốc',
      benefits: ['Miễn phí vận chuyển cho đơn hàng hợp lệ.'],
      conditions: ['Đơn hàng từ 5.000.000đ.', 'Áp dụng toàn quốc.'],
      startDate: '01/01/2026',
      usageLimit: 'Mỗi tài khoản sử dụng 1 lần.',
      statusText: 'Còn hiệu lực.',
    },
    {
      code: 'COMBO10',
      title: 'Combo sản phẩm',
      condition: 'Mua từ 2 sản phẩm trở lên',
      type: 'percent',
      category: 'discount',
      status: 'available',
      expiry: '31/12/2026',
      description: 'Giảm 10% khi mua combo sản phẩm',
      benefits: ['Giảm 10% giá trị đơn hàng.', 'Áp dụng khi mua từ 2 sản phẩm trở lên.'],
      conditions: ['Mua tối thiểu 2 sản phẩm.', 'Áp dụng cho các sản phẩm trên hệ thống.'],
      startDate: '01/01/2026',
      usageLimit: 'Mỗi tài khoản sử dụng 1 lần.',
      statusText: 'Còn hiệu lực.',
    },
    {
      code: 'WELCOME10',
      title: 'Giảm 10%',
      condition: 'Cho đơn đầu tiên',
      type: 'percent',
      category: 'discount',
      status: 'available',
      expiry: '31/12/2026',
      description: 'Giảm 10% cho đơn hàng đầu tiên',
      benefits: ['Giảm 10% giá trị đơn hàng đầu tiên.', 'Giảm tối đa 300.000đ.'],
      conditions: ['Chỉ áp dụng cho đơn hàng đầu tiên.', 'Áp dụng cho tài khoản mới.'],
      startDate: '01/01/2026',
      usageLimit: 'Mỗi tài khoản sử dụng 1 lần.',
      statusText: 'Còn hiệu lực.',
    },
    {
      code: 'LASTDAY',
      title: 'Giảm 15%',
      condition: 'Chỉ hôm nay',
      type: 'percent',
      category: 'discount',
      status: 'expiring',
      expiresInDays: 1,
      description: 'Giảm 15% chỉ trong hôm nay',
      benefits: ['Giảm 15% giá trị đơn hàng.', 'Giảm tối đa 700.000đ.'],
      conditions: ['Áp dụng cho đơn hàng hợp lệ.', 'Không áp dụng đồng thời với mã giảm giá khác.'],
      startDate: '01/01/2026',
      usageLimit: 'Mỗi tài khoản sử dụng 1 lần.',
      statusText: 'Sắp hết hạn.',
    },
    {
      code: 'LAPTOP150',
      title: 'Giảm 150.000đ Laptop',
      condition: 'Đơn hàng từ 8.000.000đ',
      type: 'percent',
      category: 'discount',
      status: 'used',
      expiry: '31/12/2026',
      description: 'Voucher đã sử dụng 1',
      benefits: ['Giảm trực tiếp 150.000đ.'],
      conditions: ['Đơn hàng từ 8.000.000đ.', 'Áp dụng cho danh mục Laptop.'],
      startDate: '01/01/2026',
      usageLimit: 'Đơn hàng: DH202606021\nNgày sử dụng: 08/06/2026\nGiá trị giảm: 150.000đ',
      statusText: 'Đã sử dụng.',
    },
    {
      code: 'ACC20',
      title: 'Giảm 20% Phụ kiện',
      condition: 'Đơn hàng từ 1.000.000đ',
      type: 'percent',
      category: 'discount',
      status: 'used',
        expiry: '31/12/2026',
      description: 'Voucher đã sử dụng 2',
      benefits: ['Giảm 20% giá trị sản phẩm phụ kiện.', 'Giảm tối đa 200.000đ.'],
      conditions: ['Đơn hàng từ 1.000.000đ.', 'Áp dụng cho tai nghe, chuột, bàn phím, loa.'],
      startDate: '01/01/2026',
      usageLimit: 'Đơn hàng: DH202606037\nNgày sử dụng: 12/06/2026\nGiá trị giảm: 180.000đ',
      statusText: 'Đã sử dụng.',
    },
  ];

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