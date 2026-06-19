import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { CartApiItem, CartService } from '../../services/cart';
import { CartStateService } from '../../services/cart-state.service';
import {
  AddressItem,
  CreateOrderPayload,
  OrderService,
  VietnamDistrict,
  VietnamProvince,
  VietnamWard,
  VoucherItem,
} from '../../services/order';

type CheckoutStep = 'checkout' | 'confirm' | 'success';
type PaymentMethodId = 'bank_transfer' | 'cod';
type PaymentStatus = 'pending' | 'paid' | 'failed';

interface CheckoutVariantOption {
  productVariantId: string;
  variantName: string;
  price: number;
  stock: number;
}

interface CheckoutItem {
  cartItemId: string;
  productVariantId: string;
  productId: string | null;
  name: string;
  variantName: string;
  specs: string;
  selectedVariantId: string;
  variantOptions: CheckoutVariantOption[];
  image: string;
  price: number;
  quantity: number;
  stock: number;
}

interface ReceiverInfo {
  addressId: string;
  fullName: string;
  phone: string;
  email: string;
  province: string;
  district: string;
  ward: string;
  specificAddress: string;
  saveForNext: boolean;
}

interface ShippingMethod {
  id: string;
  partner: string;
  name: string;
  minDays: number;
  maxDays: number;
  fee: number;
  note: string;
}

interface PaymentMethod {
  id: PaymentMethodId;
  label: string;
  description: string;
  icon: string;
  prepaid: boolean;
  backendType: 'BankTransfer' | 'COD';
}

interface AppliedVoucher {
  code: string;
  voucherId: string | null;
  discountAmount: number;
  shippingDiscount: number;
  message: string;
  error: string;
}

interface StoredUser {
  User_id?: string;
  userId?: string;
  id?: string;
  Full_name?: string;
  fullName?: string;
  Username?: string;
  username?: string;
  Phone_number?: string;
  phoneNumber?: string;
  phone?: string;
  Email?: string;
  email?: string;
}

const CHECKOUT_ITEMS_KEY = 'vista_checkout_items';

@Component({
  selector: 'app-order',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './order.html',
  styleUrl: './order.scss',
})
export class Order implements OnInit, OnDestroy {
  step: CheckoutStep = 'checkout';
  items: CheckoutItem[] = [];

  receiver: ReceiverInfo = this.createEmptyReceiver();
  tempReceiver: ReceiverInfo = this.createEmptyReceiver();

  savedAddresses: AddressItem[] = [];
  vietnamLocations: VietnamProvince[] = [];
  districtOptions: VietnamDistrict[] = [];
  wardOptions: VietnamWard[] = [];
  selectedProvinceCode = '';
  selectedDistrictCode = '';
  selectedWardCode = '';

  shippingMethods: ShippingMethod[] = [
    {
      id: 'spx',
      partner: 'SPX Express',
      name: 'SPX Express',
      minDays: 2,
      maxDays: 4,
      fee: 0,
      note: 'Miễn phí cho đơn đủ điều kiện.',
    },
    {
      id: 'ghn',
      partner: 'Giao Hàng Nhanh',
      name: 'Giao Hàng Nhanh',
      minDays: 1,
      maxDays: 2,
      fee: 45000,
      note: 'Giao nhanh tại khu vực hỗ trợ.',
    },
    {
      id: 'jnt',
      partner: 'J&T Express',
      name: 'J&T Express - tiết kiệm',
      minDays: 3,
      maxDays: 6,
      fee: 15000,
      note: 'Phù hợp giao liên tỉnh.',
    },
  ];
  selectedShippingId = 'spx';
  tempShippingId = 'spx';

  paymentMethods: PaymentMethod[] = [
    {
      id: 'bank_transfer',
      label: 'Chuyển khoản ngân hàng',
      description: 'Quét mã VietQR Nam Á Bank để thanh toán trước.',
      icon: 'ph-bank',
      prepaid: true,
      backendType: 'BankTransfer',
    },
    {
      id: 'cod',
      label: 'Thanh toán tiền mặt khi nhận hàng',
      description: 'Thanh toán trực tiếp cho nhân viên giao hàng.',
      icon: 'ph-money',
      prepaid: false,
      backendType: 'COD',
    },
  ];
  selectedPaymentId: PaymentMethodId = 'bank_transfer';
  paymentStatus: PaymentStatus = 'pending';

  availableVouchers: VoucherItem[] = [];
  voucherCode = '';
  voucher: AppliedVoucher = this.createEmptyVoucher();
  orderNotes = '';
  errorMessage = '';

  isLoading = false;
  isSubmitting = false;
  isApplyingVoucher = false;
  isLoadingVouchers = false;
  isLoadingAddresses = false;
  isLoadingLocations = false;
  isAddressModalOpen = false;
  isShippingModalOpen = false;
  isPaymentModalOpen = false;
  addressFormError = '';
  openLocationDropdown: 'province' | 'district' | 'ward' | null = null;

  paymentCode = '';
  paymentSecondsLeft = 300;
  createdOrder: CreateOrderPayload | null = null;
  pendingBankOrder: CreateOrderPayload | null = null;

  readonly bankInfo = {
    bankName: 'Ngân hàng TMCP Nam Á',
    bankBin: '970428',
    accountNumber: '630156268400001',
    accountHolder: 'LE THANH TOAN',
  };

  private paymentTimerId: ReturnType<typeof setInterval> | null = null;
  private paymentPollingId: ReturnType<typeof setInterval> | null = null;

  constructor(
    private cdr: ChangeDetectorRef,
    private router: Router,
    private cartService: CartService,
    private cartState: CartStateService,
    private orderService: OrderService
  ) {}

  ngOnInit(): void {
    this.receiver = this.loadReceiverInfo();
    this.tempReceiver = { ...this.receiver };
    this.paymentCode = this.generatePaymentCode();
    this.loadCheckoutItems();
    this.loadVietnamLocations();
    this.loadAvailableVouchers();
    this.loadSavedAddresses();
  }

  ngOnDestroy(): void {
    this.stopPaymentTimer();
    this.stopPaymentStatusPolling();
  }

  @HostListener('document:click')
  closeLocationDropdownFromOutside(): void {
    this.openLocationDropdown = null;
  }

  get userId(): string {
    return this.cartService.getCurrentUserId() || this.getStoredUserId() || '';
  }

  get selectedShipping(): ShippingMethod {
    return this.shippingMethods.find((method) => method.id === this.selectedShippingId) || this.shippingMethods[0];
  }

  get selectedPayment(): PaymentMethod {
    return this.paymentMethods.find((method) => method.id === this.selectedPaymentId) || this.paymentMethods[0];
  }

  get isTempReceiverComplete(): boolean {
    return !!(
      this.cleanText(this.tempReceiver.fullName) &&
      this.cleanText(this.tempReceiver.phone) &&
      this.cleanText(this.tempReceiver.email) &&
      this.cleanText(this.tempReceiver.province) &&
      this.cleanText(this.tempReceiver.district) &&
      this.cleanText(this.tempReceiver.ward) &&
      this.cleanText(this.tempReceiver.specificAddress)
    );
  }

  get productSubtotal(): number {
    return this.items.reduce((sum, item) => sum + this.lineTotal(item), 0);
  }

  get productDiscount(): number {
    return Math.min(this.voucher.discountAmount, this.productSubtotal);
  }

  get shippingDiscount(): number {
    return Math.min(this.voucher.shippingDiscount, this.selectedShipping.fee);
  }

  get shippingFeeAfterDiscount(): number {
    return Math.max(0, this.selectedShipping.fee - this.shippingDiscount);
  }

  get totalDiscount(): number {
    return this.productDiscount + this.shippingDiscount;
  }

  get grandTotal(): number {
    return Math.max(0, this.productSubtotal - this.productDiscount + this.shippingFeeAfterDiscount);
  }

  get totalQuantity(): number {
    return this.items.reduce((sum, item) => sum + item.quantity, 0);
  }

  get hasReceiverInfo(): boolean {
    return !!(this.receiver.fullName && this.receiver.phone && this.receiver.email && this.fullAddress);
  }

  get receiverSummary(): string {
    if (!this.receiver.fullName && !this.receiver.phone) {
      return 'Vui lòng chọn địa chỉ nhận hàng';
    }

    return [this.receiver.fullName, this.receiver.phone].filter(Boolean).join(' - ');
  }

  get fullAddress(): string {
    return [this.receiver.specificAddress, this.receiver.ward, this.receiver.district, this.receiver.province]
      .filter(Boolean)
      .join(', ');
  }

  get shippingEstimateText(): string {
    return this.buildShippingEstimate(this.selectedShipping);
  }

  get paymentTimerLabel(): string {
    const minutes = Math.floor(this.paymentSecondsLeft / 60).toString().padStart(2, '0');
    const seconds = (this.paymentSecondsLeft % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  get transferContent(): string {
    return this.paymentCode;
  }

  get vietQrUrl(): string {
    const params = new URLSearchParams({
      amount: String(Math.round(this.grandTotal)),
      addInfo: this.transferContent,
      accountName: this.bankInfo.accountHolder,
    });

    return `https://img.vietqr.io/image/${this.bankInfo.bankBin}-${this.bankInfo.accountNumber}-compact2.png?${params.toString()}`;
  }

  get qrDownloadFileName(): string {
    return `vista-vietqr-${this.paymentCode || 'don-hang'}.png`;
  }

  get createdOrderId(): string {
    return this.createdOrder?.order.Order_id || '';
  }

  formatPrice(value: number): string {
    return `${Number(value || 0).toLocaleString('vi-VN').replace(/,/g, '.')}đ`;
  }

  lineTotal(item: CheckoutItem): number {
    return item.price * item.quantity;
  }

  trackByItemId(_index: number, item: CheckoutItem): string {
    return item.cartItemId || item.productVariantId;
  }

  addressLine(address: AddressItem): string {
    return [address.Specific_address, address.Ward, address.District, address.Province].filter(Boolean).join(', ');
  }

  voucherCodeOf(voucher: VoucherItem): string {
    return voucher.code || '';
  }

  voucherTitleOf(voucher: VoucherItem): string {
    return voucher.title || voucher.code || 'Voucher';
  }

  voucherConditionOf(voucher: VoucherItem): string {
    const directCondition = this.cleanText(voucher.condition);
    if (directCondition) {
      return directCondition;
    }

    const conditionList = Array.isArray(voucher.conditions)
      ? voucher.conditions.map((item) => this.cleanText(item)).filter(Boolean).join(' - ')
      : '';
    if (conditionList) {
      return conditionList;
    }

    const description = this.cleanText(voucher.description);
    if (description) {
      return description;
    }

    const benefits = Array.isArray(voucher.benefits)
      ? voucher.benefits.map((item) => this.cleanText(item)).filter(Boolean).join(' - ')
      : '';
    if (benefits) {
      return benefits;
    }

    const generatedConditions = [
      voucher.minOrderValue ? `Đơn tối thiểu ${this.formatPrice(voucher.minOrderValue)}` : '',
      voucher.maxDiscountAmount ? `Giảm tối đa ${this.formatPrice(voucher.maxDiscountAmount)}` : '',
      voucher.usageLimit ? `Giới hạn ${voucher.usageLimit} lượt dùng` : '',
    ]
      .filter(Boolean)
      .join(' - ');
    if (generatedConditions) {
      return generatedConditions;
    }

    return 'Áp dụng theo điều kiện voucher';
  }

  chooseVoucher(voucher: VoucherItem): void {
    this.voucherCode = this.voucherCodeOf(voucher);
    this.applyVoucher();
  }

  displayItemColor(item: CheckoutItem): string {
    return item.variantName || item.specs || 'Tiêu chuẩn';
  }

  getVariantOptions(item: CheckoutItem): CheckoutVariantOption[] {
    if (item.variantOptions.length > 0) {
      return item.variantOptions;
    }

    return [
      {
        productVariantId: item.productVariantId,
        variantName: this.displayItemColor(item),
        price: item.price,
        stock: item.stock,
      },
    ];
  }

  hasMultipleVariantOptions(item: CheckoutItem): boolean {
    return this.getVariantOptions(item).length > 1;
  }

  changeItemVariant(item: CheckoutItem, productVariantId: string): void {
    const selectedVariant = this.getVariantOptions(item).find(
      (variant) => variant.productVariantId === productVariantId
    );

    if (!selectedVariant) {
      return;
    }

    item.selectedVariantId = selectedVariant.productVariantId;
    item.productVariantId = selectedVariant.productVariantId;
    item.variantName = selectedVariant.variantName;
    item.specs = selectedVariant.variantName;
    item.price = Number(selectedVariant.price) || item.price;
    item.stock = Number(selectedVariant.stock) || item.stock;
    this.removeVoucher();
  }

  changeQuantity(item: CheckoutItem, delta: number): void {
    const nextQuantity = item.quantity + delta;
    if (nextQuantity < 1 || (item.stock > 0 && nextQuantity > item.stock)) {
      return;
    }

    item.quantity = nextQuantity;
    this.removeVoucher();
  }

  openAddressModal(): void {
    this.tempReceiver = { ...this.receiver };
    this.syncLocationSelectsFromReceiver(this.tempReceiver);
    this.addressFormError = '';
    this.openLocationDropdown = null;
    this.isAddressModalOpen = true;
  }

  closeAddressModal(): void {
    this.isAddressModalOpen = false;
    this.addressFormError = '';
    this.openLocationDropdown = null;
  }

  selectSavedAddress(address: AddressItem): void {
    this.tempReceiver = {
      addressId: address.Address_id,
      fullName: address.Receiver_name,
      phone: address.Receiver_phone,
      email: address.Email || '',
      province: address.Province,
      district: address.District,
      ward: address.Ward,
      specificAddress: address.Specific_address,
      saveForNext: address.Is_default,
    };
    this.syncLocationSelectsFromReceiver(this.tempReceiver);
  }

  confirmReceiverInfo(): void {
    this.addressFormError = '';
    if (!this.isTempReceiverComplete) {
      this.addressFormError = 'Vui lòng nhập đầy đủ họ tên, số điện thoại, email và địa chỉ nhận hàng.';
      return;
    }

    this.receiver = { ...this.tempReceiver };
    this.isAddressModalOpen = false;
    this.openLocationDropdown = null;
  }

  toggleLocationDropdown(type: 'province' | 'district' | 'ward', event: Event): void {
    event.stopPropagation();

    if (type === 'district' && this.districtOptions.length === 0) {
      return;
    }

    if (type === 'ward' && this.wardOptions.length === 0) {
      return;
    }

    this.openLocationDropdown = this.openLocationDropdown === type ? null : type;
  }

  selectProvinceOption(province: VietnamProvince): void {
    this.onProvinceChange(String(province.code));
    this.openLocationDropdown = null;
  }

  selectDistrictOption(district: VietnamDistrict): void {
    this.onDistrictChange(String(district.code));
    this.openLocationDropdown = null;
  }

  selectWardOption(ward: VietnamWard): void {
    this.onWardChange(String(ward.code));
    this.openLocationDropdown = null;
  }

  onProvinceChange(provinceCode: string): void {
    this.selectedProvinceCode = provinceCode;
    const province = this.vietnamLocations.find((item) => String(item.code) === String(provinceCode));

    this.districtOptions = province?.districts || [];
    this.wardOptions = [];
    this.selectedDistrictCode = '';
    this.selectedWardCode = '';

    this.tempReceiver.province = province?.name || '';
    this.tempReceiver.district = '';
    this.tempReceiver.ward = '';
  }

  onDistrictChange(districtCode: string): void {
    this.selectedDistrictCode = districtCode;
    const district = this.districtOptions.find((item) => String(item.code) === String(districtCode));

    this.wardOptions = district?.wards || [];
    this.selectedWardCode = '';

    this.tempReceiver.district = district?.name || '';
    this.tempReceiver.ward = '';
  }

  onWardChange(wardCode: string): void {
    this.selectedWardCode = wardCode;
    const ward = this.wardOptions.find((item) => String(item.code) === String(wardCode));
    this.tempReceiver.ward = ward?.name || '';
  }

  openShippingModal(): void {
    this.tempShippingId = this.selectedShippingId;
    this.isShippingModalOpen = true;
  }

  closeShippingModal(): void {
    this.isShippingModalOpen = false;
  }

  confirmShippingMethod(): void {
    this.selectedShippingId = this.tempShippingId;
    this.removeVoucher();
    this.isShippingModalOpen = false;
  }

  selectPayment(paymentId: PaymentMethodId): void {
    this.selectedPaymentId = paymentId;
    this.paymentStatus = 'pending';
  }

  applyVoucher(): void {
    const code = this.voucherCode.trim().toUpperCase();
    if (!code) {
      this.voucher = {
        ...this.createEmptyVoucher(),
        error: 'Vui lòng nhập hoặc chọn mã giảm giá.',
      };
      return;
    }

    this.isApplyingVoucher = true;
    this.orderService
      .applyVoucher({
        voucherCode: code,
        totalItemsPrice: this.productSubtotal,
        shippingFee: this.selectedShipping.fee,
      })
      .subscribe({
        next: (res) => {
          this.isApplyingVoucher = false;
          if (!res.success) {
            this.voucher = {
              ...this.createEmptyVoucher(),
              code,
              error: res.message || 'Voucher không hợp lệ hoặc đã hết hạn.',
            };
          } else {
            this.voucher = {
              code,
              voucherId: res.data?.voucherId || code,
              discountAmount: Number(res.data?.discountAmount || 0),
              shippingDiscount: Number(res.data?.shippingDiscount || 0),
              message: res.message || `Đã áp dụng mã ${code}.`,
              error: '',
            };
          }
          this.cdr.detectChanges();
        },
        error: (err) => {
          this.isApplyingVoucher = false;
          this.voucher = {
            ...this.createEmptyVoucher(),
            code,
            error: err?.error?.message || 'Không thể kiểm tra voucher. Backend cần route POST /api/vouchers/apply.',
          };
          this.cdr.detectChanges();
        },
      });
  }

  removeVoucher(): void {
    this.voucherCode = '';
    this.voucher = this.createEmptyVoucher();
  }

  placeOrder(): void {
    if (!this.canContinue()) {
      return;
    }

    if (this.selectedPaymentId === 'bank_transfer' && this.paymentStatus !== 'paid') {
      this.prepareBankTransferOrder();
      return;
    }

    this.goToConfirm();
  }

  goToConfirm(): void {
    this.errorMessage = '';
    this.step = 'confirm';
    this.scrollTop();
  }

  backToCheckout(): void {
    this.step = 'checkout';
    this.scrollTop();
  }

  openPaymentModal(): void {
    this.paymentStatus = 'pending';
    this.paymentSecondsLeft = 300;
    this.isPaymentModalOpen = true;
    this.startPaymentTimer();
    this.startPaymentStatusPolling();
  }

  cancelPayment(): void {
    this.paymentStatus = 'failed';
    this.isPaymentModalOpen = false;
    this.stopPaymentTimer();
    this.stopPaymentStatusPolling();
  }

  prepareBankTransferOrder(): void {
    if (this.pendingBankOrder) {
      this.openPaymentModal();
      return;
    }

    this.paymentCode = this.generatePaymentCode();
    const payload = this.buildOrderPayload('pending', this.paymentCode);

    this.isSubmitting = true;
    this.errorMessage = '';

    this.orderService.createOrder(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (!res.success) {
          this.errorMessage = res.message || 'Không thể tạo đơn hàng chờ thanh toán.';
          this.cdr.detectChanges();
          return;
        }

        this.pendingBankOrder = payload;
        this.openPaymentModal();
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || 'Không thể tạo đơn hàng chờ thanh toán.';
        this.cdr.detectChanges();
      },
    });
  }

  async downloadVietQr(): Promise<void> {
    try {
      const response = await fetch(this.vietQrUrl, { mode: 'cors' });
      if (!response.ok) {
        throw new Error('Cannot download QR');
      }

      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = this.qrDownloadFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);
    } catch {
      window.open(this.vietQrUrl, '_blank', 'noopener');
    }
  }

  submitOrder(): void {
    if (this.selectedPaymentId === 'bank_transfer') {
      if (this.paymentStatus === 'paid' && this.pendingBankOrder) {
        this.finishOrder(this.pendingBankOrder);
        return;
      }

      this.prepareBankTransferOrder();
      return;
    }

    const payload = this.buildOrderPayload();
    this.isSubmitting = true;
    this.errorMessage = '';

    this.orderService.createOrder(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        if (!res.success) {
          this.errorMessage = res.message || 'Không thể tạo đơn hàng.';
          this.cdr.detectChanges();
          return;
        }

        this.finishOrder(payload);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.errorMessage = err?.error?.message || 'Không thể tạo đơn hàng. Backend cần route POST /api/orders.';
        this.cdr.detectChanges();
      },
    });
  }

  closeSuccess(): void {
    this.router.navigate(['/']);
  }

  private loadCheckoutItems(): void {
    const itemsFromStorage = this.readCheckoutItemsFromSession();
    if (itemsFromStorage.length > 0) {
      this.items = itemsFromStorage;
      return;
    }

    this.loadCartFallback();
  }

  private loadCartFallback(): void {
    const userId = this.cartService.getCurrentUserId();
    if (!userId) {
      this.items = [];
      return;
    }

    this.isLoading = true;
    this.cartService.getCart(userId).subscribe({
      next: (res) => {
        this.items = (res.data?.items || []).map((item) => this.mapApiItem(item));
        this.isLoading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.items = [];
        this.isLoading = false;
        this.cdr.detectChanges();
      },
    });
  }

  private loadVietnamLocations(): void {
    this.isLoadingLocations = true;
    this.orderService.getVietnamLocations().subscribe({
      next: (res) => {
        this.vietnamLocations = res || [];
        this.isLoadingLocations = false;
        this.syncLocationSelectsFromReceiver(this.tempReceiver);
        this.cdr.detectChanges();
      },
      error: () => {
        this.vietnamLocations = [];
        this.isLoadingLocations = false;
        this.cdr.detectChanges();
      },
    });
  }

  private loadAvailableVouchers(): void {
    this.isLoadingVouchers = true;
    this.orderService.getAvailableVouchers().subscribe({
      next: (res) => {
        this.availableVouchers = (res.data || []).filter((item) => item.status !== 'used');
        this.isLoadingVouchers = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.availableVouchers = [];
        this.isLoadingVouchers = false;
        this.cdr.detectChanges();
      },
    });
  }

  private loadSavedAddresses(): void {
    if (!this.userId) {
      return;
    }

    this.isLoadingAddresses = true;
    this.orderService.getUserAddresses(this.userId).subscribe({
      next: (res) => {
        this.savedAddresses = res.data || [];
        const defaultAddress = this.savedAddresses.find((item) => item.Is_default) || this.savedAddresses[0];

        if (defaultAddress && !this.hasReceiverInfo) {
          this.selectSavedAddress(defaultAddress);
          this.receiver = { ...this.tempReceiver };
        }

        this.isLoadingAddresses = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.savedAddresses = [];
        this.isLoadingAddresses = false;
        this.cdr.detectChanges();
      },
    });
  }

  private syncLocationSelectsFromReceiver(receiver: ReceiverInfo): void {
    const province = this.vietnamLocations.find((item) => item.name === receiver.province);
    this.selectedProvinceCode = province ? String(province.code) : '';
    this.districtOptions = province?.districts || [];

    const district = this.districtOptions.find((item) => item.name === receiver.district);
    this.selectedDistrictCode = district ? String(district.code) : '';
    this.wardOptions = district?.wards || [];

    const ward = this.wardOptions.find((item) => item.name === receiver.ward);
    this.selectedWardCode = ward ? String(ward.code) : '';
  }

  private readCheckoutItemsFromSession(): CheckoutItem[] {
    const raw = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(CHECKOUT_ITEMS_KEY) : null;
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed)
        ? parsed.map((item) => this.mapStorageItem(item)).filter((item) => !!item.productVariantId)
        : [];
    } catch {
      return [];
    }
  }

  private mapStorageItem(item: any): CheckoutItem {
    const variantName = item.variantName || item.Variant_name || item.specs || '';
    const specs = item.specs || item.variantName || item.Variant_name || '';
    const productVariantId = item.productVariantId || item.Product_variant_id || '';
    const price = Number(item.price ?? item.unitPrice ?? item.Price ?? 0);
    const stock = Number(item.stock ?? item.stockQuantity ?? item.Stock_quantity ?? 0);
    const variantOptions = this.buildVariantOptions(
      {
        productVariantId,
        variantName: variantName || specs || 'Tiêu chuẩn',
        price,
        stock,
      },
      item.variantOptions || item.variants
    );

    return {
      cartItemId: item.cartItemId || item.id || '',
      productVariantId,
      productId: item.productId || item.Product_id || null,
      name: item.name || item.productName || item.Product_name || 'Sản phẩm VISTA',
      variantName,
      specs,
      selectedVariantId: productVariantId,
      variantOptions,
      image: this.resolveImageSrc(item.image || item.img),
      price,
      quantity: Math.max(1, Number(item.quantity ?? item.qty ?? item.Quantity ?? 1)),
      stock,
    };
  }

  private mapApiItem(item: CartApiItem): CheckoutItem {
    const variantName = item.variantName || item.specs || '';
    const specs = item.specs || item.variantName || '';
    const price = Number(item.unitPrice) || 0;
    const stock = Number(item.stockQuantity) || 0;

    return {
      cartItemId: item.cartItemId,
      productVariantId: item.productVariantId,
      productId: item.productId,
      name: item.productName,
      variantName,
      specs,
      selectedVariantId: item.productVariantId,
      variantOptions: this.buildVariantOptions(
        {
          productVariantId: item.productVariantId,
          variantName: variantName || specs || 'Tiêu chuẩn',
          price,
          stock,
        },
        item.variantOptions
      ),
      image: this.resolveImageSrc(item.image),
      price,
      quantity: Math.max(1, Number(item.quantity) || 1),
      stock,
    };
  }

  private buildVariantOptions(
    currentVariant: CheckoutVariantOption,
    source?: unknown
  ): CheckoutVariantOption[] {
    const fromSource = Array.isArray(source)
      ? source
          .map((variant: any) => ({
            productVariantId: variant.productVariantId || variant.Product_variant_id || '',
            variantName: variant.variantName || variant.Variant_name || '',
            price: Number(variant.price ?? variant.Price ?? 0),
            stock: Number(variant.stock ?? variant.Stock_quantity ?? 0),
          }))
          .filter((variant) => variant.productVariantId && variant.variantName)
      : [];

    const options = [currentVariant, ...fromSource].filter(
      (variant) => variant.productVariantId && variant.variantName
    );

    return Array.from(
      new Map(options.map((variant) => [variant.productVariantId, variant])).values()
    );
  }

  private cleanText(value?: string | null): string {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  private resolveImageSrc(image?: string): string {
    if (!image) {
      return '/assets/images/asus-vivobook-15-indie-black.jpg';
    }

    if (image.startsWith('http://') || image.startsWith('https://') || image.startsWith('/')) {
      return image;
    }

    return `/assets/images/${image}`;
  }

  private loadReceiverInfo(): ReceiverInfo {
    const user = this.getStoredUser();
    const receiver = this.createEmptyReceiver();
    receiver.fullName = user?.Full_name || user?.fullName || user?.Username || user?.username || '';
    receiver.phone = user?.Phone_number || user?.phoneNumber || user?.phone || '';
    receiver.email = user?.Email || user?.email || '';
    return receiver;
  }

  private createEmptyReceiver(): ReceiverInfo {
    return {
      addressId: this.buildId('ADDR'),
      fullName: '',
      phone: '',
      email: '',
      province: '',
      district: '',
      ward: '',
      specificAddress: '',
      saveForNext: false,
    };
  }

  private getStoredUser(): StoredUser | null {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('user') : null;
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw) as StoredUser;
    } catch {
      return null;
    }
  }

  private getStoredUserId(): string | null {
    const user = this.getStoredUser();
    return user?.User_id || user?.userId || user?.id || null;
  }

  private canContinue(): boolean {
    this.errorMessage = '';

    if (this.items.length === 0) {
      this.errorMessage = 'Không có sản phẩm nào để đặt mua.';
      return false;
    }

    if (!this.userId) {
      this.errorMessage = 'Bạn cần đăng nhập để đặt hàng.';
      return false;
    }

    if (!this.receiver.fullName || !this.receiver.phone || !this.receiver.email || !this.receiver.province || !this.receiver.district || !this.receiver.ward || !this.receiver.specificAddress) {
      this.errorMessage = 'Vui lòng chọn hoặc nhập đầy đủ họ tên, số điện thoại, email và địa chỉ nhận hàng.';
      return false;
    }

    if (this.items.some((item) => !item.productVariantId || item.quantity < 1)) {
      this.errorMessage = 'Thông tin sản phẩm chưa hợp lệ. Vui lòng kiểm tra lại giỏ hàng.';
      return false;
    }

    return true;
  }

  private buildOrderPayload(paymentStatus?: PaymentStatus, fixedOrderId?: string): CreateOrderPayload {
    const orderId = fixedOrderId || this.buildId('ORD');
    const paymentId = this.selectedPaymentId === 'bank_transfer' ? orderId : this.buildId('PAY');
    const createdAt = new Date().toISOString();

    return {
      order: {
        Order_id: orderId,
        User_id: this.userId,
        Voucher_id: this.voucher.voucherId,
        Total_items_price: this.productSubtotal,
        Discount_amount: this.totalDiscount,
        Total_amount: this.grandTotal,
        Order_notes: this.orderNotes.trim(),
        Created_at: createdAt,
      },
      orderDetails: this.items.map((item, index) => ({
        Order_detail_id: this.buildId(`OD${index + 1}`),
        Product_variant_id: item.productVariantId,
        Order_id: orderId,
        Variant_name: this.displayItemColor(item) || item.name,
        Price: item.price,
        Quantity: item.quantity,
        Total_price: this.lineTotal(item),
      })),
      address: {
        Address_id: this.receiver.addressId,
        User_id: this.userId,
        Receiver_name: this.receiver.fullName,
        Receiver_phone: this.receiver.phone,
        Email: this.receiver.email,
        Province: this.receiver.province,
        District: this.receiver.district,
        Ward: this.receiver.ward,
        Specific_address: this.receiver.specificAddress,
        Is_default: this.receiver.saveForNext,
      },
      delivery: {
        Delivery_id: this.buildId('DLV'),
        Order_id: orderId,
        Shipping_partner: this.selectedShipping.partner,
        Tracking_number: this.buildTrackingNumber(),
        Shipping_fee: this.shippingFeeAfterDiscount,
        Estimated_delivery_date: this.getEstimatedDeliveryDate().toISOString(),
        Status: 'pending',
      },
      payment: {
        Payment_id: paymentId,
        Order_id: orderId,
        Payment_type: this.selectedPayment.backendType,
        Payment_status: paymentStatus || (this.selectedPayment.prepaid ? 'paid' : 'pending'),
      },
      cartItemIds: this.items.map((item) => item.cartItemId).filter(Boolean),
    };
  }

  private finishOrder(payload: CreateOrderPayload): void {
    this.createdOrder = payload;
    this.pendingBankOrder = null;
    this.step = 'success';

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(CHECKOUT_ITEMS_KEY);
    }

    this.removeOrderedCartItems(payload.cartItemIds);
    this.scrollTop();
    this.cdr.detectChanges();
  }

  private removeOrderedCartItems(cartItemIds: string[]): void {
    const userId = this.cartService.getCurrentUserId();
    if (!userId || cartItemIds.length === 0) {
      this.refreshCartBadge();
      return;
    }

    this.cartService.removeSelectedItems(userId, cartItemIds).subscribe({
      next: (res) => {
        const count = res.data?.cart?.Total_product ?? this.cartState.getTotalQuantity(res.data?.items || []);
        this.cartState.setCount(count);
      },
      error: () => this.refreshCartBadge(),
    });
  }

  private refreshCartBadge(): void {
    const userId = this.cartService.getCurrentUserId();
    if (!userId) {
      this.cartState.setCount(0);
      return;
    }

    this.cartService.getCart(userId).subscribe({
      next: (res) => {
        const count = res.data?.cart?.Total_product ?? this.cartState.getTotalQuantity(res.data?.items || []);
        this.cartState.setCount(count);
      },
      error: () => undefined,
    });
  }

  private createEmptyVoucher(): AppliedVoucher {
    return {
      code: '',
      voucherId: null,
      discountAmount: 0,
      shippingDiscount: 0,
      message: '',
      error: '',
    };
  }

  private generatePaymentCode(): string {
    return this.buildId('ORD');
  }

  private goToPaidBankConfirm(): void {
    if (!this.pendingBankOrder) {
      return;
    }

    this.pendingBankOrder.payment.Payment_status = 'paid';
    this.paymentStatus = 'paid';
    this.isPaymentModalOpen = false;
    this.stopPaymentTimer();
    this.stopPaymentStatusPolling();
    this.step = 'confirm';
    this.scrollTop();
    this.cdr.detectChanges();
  }

  private buildTrackingNumber(): string {
    return `${this.selectedShipping.id.toUpperCase()}${Date.now().toString().slice(-9)}`;
  }

  private getEstimatedDeliveryDate(): Date {
    const date = new Date();
    date.setDate(date.getDate() + this.selectedShipping.maxDays);
    return date;
  }

  buildShippingEstimate(method: ShippingMethod): string {
    const from = new Date();
    const to = new Date();
    from.setDate(from.getDate() + method.minDays);
    to.setDate(to.getDate() + method.maxDays);

    if (method.minDays === method.maxDays) {
      return `Nhận trong ${this.formatDisplayDate(from)}`;
    }

    return `Nhận trong ${this.formatDisplayDate(from)} - ${this.formatDisplayDate(to)}`;
  }

  private formatDisplayDate(date: Date): string {
    return date.toLocaleDateString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private buildId(prefix: string): string {
    const stamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `${prefix}_${stamp}${random}`;
  }

  private startPaymentTimer(): void {
    this.stopPaymentTimer();
    this.paymentTimerId = setInterval(() => {
      this.paymentSecondsLeft = Math.max(0, this.paymentSecondsLeft - 1);
      if (this.paymentSecondsLeft === 0) {
        this.cancelPayment();
      }
      this.cdr.detectChanges();
    }, 1000);
  }

  private stopPaymentTimer(): void {
    if (this.paymentTimerId) {
      clearInterval(this.paymentTimerId);
      this.paymentTimerId = null;
    }
  }

  private startPaymentStatusPolling(): void {
    this.stopPaymentStatusPolling();
    this.checkPaymentStatusOnce();
    this.paymentPollingId = setInterval(() => {
      this.checkPaymentStatusOnce();
    }, 3000);
  }

  private stopPaymentStatusPolling(): void {
    if (this.paymentPollingId) {
      clearInterval(this.paymentPollingId);
      this.paymentPollingId = null;
    }
  }

  private checkPaymentStatusOnce(): void {
    if (!this.paymentCode || !this.pendingBankOrder) {
      return;
    }

    this.orderService.checkPaymentStatus(this.paymentCode).subscribe({
      next: (res) => {
        const data = res.data as { paymentStatus?: PaymentStatus; status?: PaymentStatus } | undefined;
        const status = data?.paymentStatus || data?.status;
        if (status === 'paid') {
          this.goToPaidBankConfirm();
        }

        if (status === 'failed') {
          this.paymentStatus = 'failed';
          this.errorMessage = 'Giao dịch thanh toán thất bại.';
          this.isPaymentModalOpen = false;
          this.stopPaymentTimer();
          this.stopPaymentStatusPolling();
        }
      },
      error: () => undefined,
    });
  }

  private scrollTop(): void {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
