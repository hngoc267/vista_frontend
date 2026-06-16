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
  expiry: string;
  daysLeft?: number;
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
      expiry: '31/12/2026',
      daysLeft: 4,
    },
    {
      code: 'VISTA60',
      title: 'Giảm 60K',
      condition: 'Cho đơn hàng từ 2.000.000',
      type: 'shipping',
      category: 'freeship',
      status: 'expiring',
      expiry: '31/12/2026',
      daysLeft: 4,
    },
    {
      code: 'FREESHIP',
      title: 'Freeship toàn quốc',
      condition: 'Đơn từ 5.000.000đ',
      type: 'shipping',
      category: 'freeship',
      status: 'available',
      expiry: '31/12/2026',
    },
    {
      code: 'COMBO10',
      title: 'Combo sản phẩm',
      condition: 'Mua từ 2 sản phẩm trở lên giảm 10%',
      type: 'percent',
      category: 'discount',
      status: 'available',
      expiry: '31/12/2026',
    },
    {
      code: 'WELCOME10',
      title: 'Giảm 10%',
      condition: 'Cho đơn đầu tiên',
      type: 'percent',
      category: 'discount',
      status: 'available',
      expiry: '31/12/2026',
    },
    {
      code: 'LASTDAY',
      title: 'Giảm 15%',
      condition: 'Chỉ hôm nay',
      type: 'percent',
      category: 'discount',
      status: 'expiring',
      expiry: '16/06/2026',
      daysLeft: 1,
    },
  ];

  get filteredVouchers(): VoucherItem[] {
    if (this.activeTab === 'all') {
      return this.vouchers;
    }

    if (this.activeTab === 'used') {
      return this.vouchers.filter(voucher => voucher.status === 'used');
    }

    if (this.activeTab === 'expiring') {
      return this.vouchers.filter(voucher => voucher.status === 'expiring');
    }

    return this.vouchers.filter(voucher => voucher.category === this.activeTab);
  }

  setTab(tab: VoucherTab): void {
    this.activeTab = tab;
  }

  copyCode(code: string): void {
    navigator.clipboard.writeText(code).then(() => {
      this.copyMessage = 'Đã sao chép mã giảm giá';

      setTimeout(() => {
        this.copyMessage = '';
      }, 1800);
    });
  }
}