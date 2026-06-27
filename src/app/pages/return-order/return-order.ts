import { ChangeDetectorRef, Component, HostListener, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { OrderService, VietnamDistrict, VietnamProvince, VietnamWard } from '../../services/order';
import { OrderHistory as OrderHistoryApi } from '../../services/order-history';
import { CreateReturnOrderPayload, ReturnOrder as ReturnOrderApi } from '../../services/return-order';

interface ReturnReasonOption {
  value: string;
  label: string;
}

interface ReturnInfoForm {
  fullName: string;
  phone: string;
  email: string;
  province: string;
  district: string;
  ward: string;
  specificAddress: string;
  saveForNext: boolean;
  savedAt?: number;
}

interface EvidenceFile {
  name: string;
  type: 'image' | 'video';
  size: number;
  preview: string;
}

const SAVED_RETURN_ADDRESSES_KEY = 'vista_saved_return_addresses';

@Component({
  selector: 'app-return-order',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './return-order.html',
  styleUrls: ['./return-order.scss'],
})
export class ReturnOrder implements OnInit {
  orderId = '';
  order: any = null;
  isLoadingOrder = true;
  loadError = '';
  submitError = '';
  addressFormError = '';
  isSubmitting = false;

  isReturnInfoModalOpen = false;
  isConfirmModalOpen = false;
  isSuccessModalOpen = false;
  createdReturnRequestId = '';

  provinces: VietnamProvince[] = [];
  districts: VietnamDistrict[] = [];
  wards: VietnamWard[] = [];
  selectedProvinceCode = '';
  selectedDistrictCode = '';
  selectedWardCode = '';
  openLocationDropdown: 'province' | 'district' | 'ward' | null = null;

  readonly maxImageCount = 6;
  readonly maxVideoCount = 1;

  readonly returnReasons: ReturnReasonOption[] = [
    { value: 'damaged', label: 'Hàng lỗi, không hoạt động' },
    { value: 'not_as_described', label: 'Khác với mô tả' },
    { value: 'used_item', label: 'Hàng đã qua sử dụng' },
    { value: 'counterfeit', label: 'Hàng giả, nhái' },
    { value: 'missing_accessories', label: 'Hàng nguyên vẹn nhưng không còn nhu cầu (sẽ trả nguyên seal, tem, hộp sản phẩm)' },
    { value: 'other', label: 'Lý do khác' },
  ];

  selectedReasonValues: string[] = [];
  otherReasonText = '';
  description = '';
  evidenceFiles: EvidenceFile[] = [];
  pendingEvidenceReads = 0;
  returnQuantities: Record<string, number> = {};
  selectedReturnItems: Record<string, boolean> = {};

  returnInfo: ReturnInfoForm = this.createEmptyReturnInfo();
  returnInfoDraft: ReturnInfoForm = this.createEmptyReturnInfo();
  savedReturnAddresses: ReturnInfoForm[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderService: OrderService,
    private orderHistoryService: OrderHistoryApi,
    private returnOrderService: ReturnOrderApi,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.orderId = String(this.route.snapshot.queryParamMap.get('orderId') || '').trim();
    this.loadSavedReturnAddresses();
    this.loadLocations();
    this.loadOrderForReturn();
  }

  @HostListener('document:click')
  closeLocationDropdownFromOutside(): void {
    this.openLocationDropdown = null;
  }

  get items(): any[] {
    return Array.isArray(this.order?.Items) ? this.order.Items : [];
  }

  get selectedOrderItems(): any[] {
    return this.items.filter((item) => this.isItemSelected(item));
  }

  get imageCount(): number {
    return this.evidenceFiles.filter((file) => file.type === 'image').length;
  }

  get videoCount(): number {
    return this.evidenceFiles.filter((file) => file.type === 'video').length;
  }

  get hasEvidence(): boolean {
    return this.imageCount > 0 || this.videoCount > 0;
  }

  get isReadingEvidence(): boolean {
    return this.pendingEvidenceReads > 0;
  }

  get selectedReasonLabels(): string[] {
    return this.selectedReasonValues
      .map((value) => {
        if (value === 'other') {
          return this.otherReasonText.trim() || 'Lý do khác';
        }

        return this.returnReasons.find((reason) => reason.value === value)?.label || '';
      })
      .filter(Boolean);
  }

  get selectedReasonLabel(): string {
    return this.selectedReasonLabels.join('; ') || 'Chưa chọn lý do';
  }

  get returnAddressLine(): string {
    return [
      this.returnInfo.specificAddress,
      this.returnInfo.ward,
      this.returnInfo.district,
      this.returnInfo.province,
    ].map((part) => String(part || '').trim()).filter(Boolean).join(', ');
  }

  get returnInfoSummary(): string {
    return [this.returnInfo.fullName, this.returnInfo.phone].filter(Boolean).join(' - ') || 'Vui lòng nhập thông tin trả hàng';
  }

  get isReturnInfoComplete(): boolean {
    return this.isReturnInfoFilled(this.returnInfo);
  }

  get isReturnInfoDraftComplete(): boolean {
    return this.isReturnInfoFilled(this.returnInfoDraft);
  }

  get canSubmitReturnRequest(): boolean {
    return !this.validateBeforeConfirm();
  }

  loadOrderForReturn(): void {
    const stateOrder = this.readOrderFromHistoryState();
    const storedOrder = this.readStoredReturnOrder();
    const candidate = this.pickUsableOrder(stateOrder) || this.pickUsableOrder(storedOrder);

    if (candidate) {
      this.setOrder(candidate);
      this.isLoadingOrder = false;
      return;
    }

    this.orderHistoryService.getOrderHistory('all').subscribe({
      next: (res) => {
        const orders = Array.isArray(res?.data) ? res.data : [];
        const foundOrder = orders.find((item: any) => {
          const code = String(item?.Order_code || item?.Order_id || '').trim();
          return this.orderId ? code === this.orderId : false;
        });

        if (!foundOrder) {
          this.loadError = 'Không tìm thấy đơn hàng cần hoàn trả.';
          this.order = null;
        } else {
          this.setOrder(foundOrder);
        }

        this.isLoadingOrder = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadError = err?.error?.message || 'Không thể tải thông tin đơn hàng hoàn trả.';
        this.isLoadingOrder = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadLocations(): void {
    this.orderService.getVietnamLocations().subscribe({
      next: (locations) => {
        this.provinces = Array.isArray(locations) ? locations : [];
        if (this.isReturnInfoModalOpen) {
          this.syncLocationSelectionsFromDraft();
        }
      },
      error: () => {
        this.provinces = [];
      },
    });
  }

  setOrder(order: any): void {
    this.order = order;
    this.orderId = String(order?.Order_code || order?.Order_id || this.orderId || '').trim();
    this.returnInfo = this.buildReturnInfoFromOrder(order);
    this.returnInfoDraft = { ...this.returnInfo };
    this.initializeReturnQuantities();
    this.initializeReturnSelections();
  }

  openReturnInfoModal(): void {
    this.loadSavedReturnAddresses();
    this.returnInfoDraft = { ...this.returnInfo };
    this.syncLocationSelectionsFromDraft();
    this.addressFormError = '';
    this.openLocationDropdown = null;
    this.isReturnInfoModalOpen = true;
  }

  closeReturnInfoModal(): void {
    this.isReturnInfoModalOpen = false;
    this.addressFormError = '';
    this.openLocationDropdown = null;
  }

  confirmReturnInfo(): void {
    const error = this.validateReturnInfoDraft();
    if (error) {
      this.addressFormError = error;
      return;
    }

    this.returnInfo = { ...this.returnInfoDraft };
    if (this.returnInfo.saveForNext) {
      this.saveReturnAddress(this.returnInfo);
    }

    this.submitError = '';
    this.addressFormError = '';
    this.closeReturnInfoModal();
  }

  selectSavedReturnAddress(address: ReturnInfoForm): void {
    this.returnInfoDraft = {
      ...address,
      saveForNext: true,
    };
    this.syncLocationSelectionsFromDraft();
    this.addressFormError = '';
  }

  deleteSavedReturnAddress(address: ReturnInfoForm, event: Event): void {
    event.stopPropagation();
    const deleteKey = this.buildReturnAddressKey(address);
    this.savedReturnAddresses = this.savedReturnAddresses.filter(
      (item) => this.buildReturnAddressKey(item) !== deleteKey
    );

    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SAVED_RETURN_ADDRESSES_KEY, JSON.stringify(this.savedReturnAddresses));
    }

    if (this.buildReturnAddressKey(this.returnInfoDraft) === deleteKey) {
      this.returnInfoDraft = { ...this.returnInfo };
      this.syncLocationSelectionsFromDraft();
    }
  }

  toggleLocationDropdown(type: 'province' | 'district' | 'ward', event: Event): void {
    event.stopPropagation();

    if (type === 'district' && this.districts.length === 0) {
      return;
    }

    if (type === 'ward' && this.wards.length === 0) {
      return;
    }

    this.openLocationDropdown = this.openLocationDropdown === type ? null : type;
  }

  selectProvinceOption(province: VietnamProvince): void {
    this.selectedProvinceCode = String(province.code);
    this.onProvinceChange();
    this.openLocationDropdown = null;
  }

  selectDistrictOption(district: VietnamDistrict): void {
    this.selectedDistrictCode = String(district.code);
    this.onDistrictChange();
    this.openLocationDropdown = null;
  }

  selectWardOption(ward: VietnamWard): void {
    this.selectedWardCode = String(ward.code);
    this.onWardChange();
    this.openLocationDropdown = null;
  }

  onProvinceChange(): void {
    const province = this.provinces.find((item) => String(item.code) === this.selectedProvinceCode) || null;
    this.returnInfoDraft.province = province?.name || '';
    this.returnInfoDraft.district = '';
    this.returnInfoDraft.ward = '';
    this.districts = province?.districts || [];
    this.wards = [];
    this.selectedDistrictCode = '';
    this.selectedWardCode = '';
  }

  onDistrictChange(): void {
    const district = this.districts.find((item) => String(item.code) === this.selectedDistrictCode) || null;
    this.returnInfoDraft.district = district?.name || '';
    this.returnInfoDraft.ward = '';
    this.wards = district?.wards || [];
    this.selectedWardCode = '';
  }

  onWardChange(): void {
    const ward = this.wards.find((item) => String(item.code) === this.selectedWardCode) || null;
    this.returnInfoDraft.ward = ward?.name || '';
  }

  toggleReason(value: string): void {
    if (this.isReasonSelected(value)) {
      this.selectedReasonValues = this.selectedReasonValues.filter((item) => item !== value);
      if (value === 'other') {
        this.otherReasonText = '';
      }
      return;
    }

    this.selectedReasonValues = [...this.selectedReasonValues, value];
  }

  isReasonSelected(value: string): boolean {
    return this.selectedReasonValues.includes(value);
  }

  onEvidenceSelected(event: Event, type: 'image' | 'video'): void {
    const input = event.target as HTMLInputElement;
    const selectedFiles = Array.from(input.files || []);
    const currentCount = type === 'image' ? this.imageCount : this.videoCount;
    const maxCount = type === 'image' ? this.maxImageCount : this.maxVideoCount;
    const remaining = Math.max(0, maxCount - currentCount);

    selectedFiles.slice(0, remaining).forEach((file) => {
      const evidence: EvidenceFile = {
        name: file.name,
        type,
        size: file.size,
        preview: '',
      };

      this.evidenceFiles.push(evidence);

      const reader = new FileReader();
      this.pendingEvidenceReads += 1;
      reader.onload = () => {
        evidence.preview = String(reader.result || '');
        this.pendingEvidenceReads = Math.max(0, this.pendingEvidenceReads - 1);
        this.cdr.detectChanges();
      };
      reader.onerror = () => {
        this.evidenceFiles = this.evidenceFiles.filter((item) => item !== evidence);
        this.pendingEvidenceReads = Math.max(0, this.pendingEvidenceReads - 1);
        this.submitError = 'Không thể đọc tệp bằng chứng. Vui lòng chọn ảnh/video khác.';
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    });

    input.value = '';
  }

  removeEvidence(index: number): void {
    this.evidenceFiles.splice(index, 1);
  }

  openConfirmModal(): void {
    const error = this.validateBeforeConfirm();
    if (error) {
      this.submitError = error;
      return;
    }

    this.submitError = '';
    this.isConfirmModalOpen = true;
  }

  closeConfirmModal(): void {
    if (!this.isSubmitting) {
      this.isConfirmModalOpen = false;
    }
  }

  submitReturnOrder(): void {
    const error = this.validateBeforeConfirm();
    if (error) {
      this.submitError = error;
      this.isConfirmModalOpen = false;
      return;
    }

    const payload: CreateReturnOrderPayload = {
      Order_id: this.orderId,
      Reason_type: this.selectedReasonLabel,
      Description: this.description.trim(),
      Evidence_images: this.evidenceFiles.map((file) => file.preview || file.name),
      Refund_amount: this.getRefundAmount(),
      Return_name: this.returnInfo.fullName.trim(),
      Return_phone: this.returnInfo.phone.trim(),
      Return_email: this.returnInfo.email.trim(),
      Return_address: this.returnAddressLine,
      items: this.selectedOrderItems.map((item) => ({
        Product_variant_id: this.getItemVariantId(item),
        Quantity: this.getItemReturnQuantity(item),
      })).filter((item) => !!item.Product_variant_id && item.Quantity > 0),
    };

    this.isSubmitting = true;
    this.submitError = '';

    this.returnOrderService.createReturnOrder(payload).subscribe({
      next: (res) => {
        this.isSubmitting = false;

        if (!res.success) {
          this.submitError = res.message || 'Không thể gửi yêu cầu hoàn trả.';
          this.cdr.detectChanges();
          return;
        }

        this.order = { ...this.order, Status: 'returning' };
        this.createdReturnRequestId = this.extractReturnRequestId(res);
        this.isConfirmModalOpen = false;
        this.isSuccessModalOpen = true;

        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.removeItem('vista_return_order_data');
        }

        this.cdr.detectChanges();
      },
      error: (err) => {
        this.isSubmitting = false;
        this.submitError = this.resolveSubmitError(err);
        this.cdr.detectChanges();
      },
    });
  }

  cancelRequest(): void {
    this.router.navigate(['/order-history'], { queryParams: { status: 'review' } });
  }

  goToReturningHistory(): void {
    this.router.navigate(['/order-history'], { queryParams: { status: 'returning' } });
  }

  formatPrice(value: number): string {
    return `${Number(value || 0).toLocaleString('vi-VN').replace(/,/g, '.')}đ`;
  }

  getTotalQuantity(): number {
    return this.selectedOrderItems.reduce((sum, item) => sum + this.getItemReturnQuantity(item), 0);
  }

  getItemsSubtotal(): number {
    return this.selectedOrderItems.reduce((sum, item) => {
      return sum + this.getItemUnitPrice(item) * this.getItemReturnQuantity(item);
    }, 0);
  }

  getOrderItemsSubtotal(): number {
    return this.items.reduce((sum, item) => {
      return sum + this.getItemUnitPrice(item) * this.getPurchasedQuantity(item);
    }, 0);
  }

  getPaidOrderAmount(): number {
    return Number(this.order?.Total_amount || this.order?.totalAmount || 0) || this.getOrderItemsSubtotal();
  }

  getTotalPurchasedQuantity(): number {
    return this.items.reduce((sum, item) => sum + this.getPurchasedQuantity(item), 0);
  }

  getRefundAmount(): number {
    const selectedSubtotal = this.getItemsSubtotal();
    const paidAmount = this.getPaidOrderAmount();

    if (this.selectedOrderItems.length === 0) {
      return 0;
    }

    if (this.isFullQuantityReturn()) {
      return paidAmount;
    }

    const orderSubtotal = this.getOrderItemsSubtotal();
    const orderAdjustment = paidAmount - orderSubtotal;
    const adjustmentPerUnit = orderAdjustment / Math.max(this.getTotalPurchasedQuantity(), 1);

    return Math.max(0, Math.round(selectedSubtotal + adjustmentPerUnit * this.getTotalQuantity()));
  }

  getItemVariantId(item: any): string {
    return String(item?.Product_variant_id || item?.productVariantId || '').trim();
  }

  getPurchasedQuantity(item: any): number {
    return Math.max(1, Number(item?.Quantity || item?.quantity || 1));
  }

  getItemUnitPrice(item: any): number {
    const purchasedQuantity = this.getPurchasedQuantity(item);
    const explicitUnitPrice = Number(
      item?.Unit_price
      || item?.UnitPrice
      || item?.unitPrice
      || item?.Product_price
      || item?.productPrice
      || 0
    );

    if (explicitUnitPrice > 0) {
      return explicitUnitPrice;
    }

    const price = Number(item?.Price || item?.price || 0);
    const totalPrice = Number(
      item?.Total_price
      || item?.TotalPrice
      || item?.totalPrice
      || item?.Line_total
      || item?.lineTotal
      || 0
    );

    if (totalPrice > 0 && purchasedQuantity > 1 && Math.abs(price - totalPrice) < 1) {
      return Math.round(totalPrice / purchasedQuantity);
    }

    return price;
  }

  getItemOriginalUnitPrice(item: any): number {
    const purchasedQuantity = this.getPurchasedQuantity(item);
    const currentUnitPrice = this.getItemUnitPrice(item);
    const originalPrice = Number(
      item?.Original_price
      || item?.OriginalPrice
      || item?.originalPrice
      || item?.Compare_at_price
      || item?.compareAtPrice
      || 0
    );

    if (!originalPrice) {
      return 0;
    }

    if (purchasedQuantity > 1 && originalPrice > currentUnitPrice * 1.5) {
      return Math.round(originalPrice / purchasedQuantity);
    }

    return originalPrice;
  }

  getItemReturnQuantity(item: any): number {
    const variantId = this.getItemVariantId(item);
    const purchasedQuantity = this.getPurchasedQuantity(item);
    const selectedQuantity = Number(this.returnQuantities[variantId]);

    if (!Number.isFinite(selectedQuantity)) {
      return purchasedQuantity;
    }

    return Math.min(Math.max(1, Math.round(selectedQuantity)), purchasedQuantity);
  }

  shouldShowItemSelector(): boolean {
    return this.items.length > 1;
  }

  isItemSelected(item: any): boolean {
    const variantId = this.getItemVariantId(item);

    if (!variantId) {
      return false;
    }

    if (!this.shouldShowItemSelector()) {
      return true;
    }

    return this.selectedReturnItems[variantId] !== false;
  }

  onReturnItemToggle(item: any, event: Event): void {
    const input = event.target as HTMLInputElement;
    const variantId = this.getItemVariantId(item);

    if (!variantId) {
      return;
    }

    this.selectedReturnItems[variantId] = input.checked;

    if (input.checked && !this.returnQuantities[variantId]) {
      this.returnQuantities[variantId] = this.getPurchasedQuantity(item);
    }

    this.submitError = '';
  }

  changeReturnQuantity(item: any, delta: number): void {
    this.setReturnQuantity(item, this.getItemReturnQuantity(item) + delta);
  }

  setReturnQuantity(item: any, quantity: number): void {
    const variantId = this.getItemVariantId(item);
    if (!variantId) {
      return;
    }

    const purchasedQuantity = this.getPurchasedQuantity(item);
    this.returnQuantities[variantId] = Math.min(Math.max(1, Math.round(Number(quantity) || 1)), purchasedQuantity);
  }

  canDecreaseReturnQuantity(item: any): boolean {
    return this.getItemReturnQuantity(item) > 1;
  }

  canIncreaseReturnQuantity(item: any): boolean {
    return this.getItemReturnQuantity(item) < this.getPurchasedQuantity(item);
  }

  shouldShowReturnQuantityControl(item: any): boolean {
    return this.getPurchasedQuantity(item) > 1;
  }

  getReturnLineTotal(item: any): number {
    if (!this.isItemSelected(item)) {
      return 0;
    }

    const variantId = this.getItemVariantId(item);
    return this.getReturnLineRefundAmounts()[variantId] || 0;
  }

  isFullQuantityReturn(): boolean {
    return this.items.length > 0 && this.items.every((item) => {
      return this.isItemSelected(item) && this.getItemReturnQuantity(item) === this.getPurchasedQuantity(item);
    });
  }

  isEvidenceImage(file: EvidenceFile): boolean {
    return file.type === 'image' && !!file.preview;
  }

  isEvidenceVideo(file: EvidenceFile): boolean {
    return file.type === 'video' && !!file.preview;
  }

  getProductImage(item: any): string {
    return item?.Image || item?.image || '/assets/images/default-product.png';
  }

  hideBrokenImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.src = '/assets/images/default-product.png';
  }

  isReturnableOrder(): boolean {
    const status = this.normalizeStatus(this.order?.Status);
    return status === 'delivered' || status === 'review';
  }

  private initializeReturnQuantities(): void {
    this.returnQuantities = this.items.reduce((result, item) => {
      const variantId = this.getItemVariantId(item);
      if (variantId) {
        result[variantId] = this.getPurchasedQuantity(item);
      }
      return result;
    }, {} as Record<string, number>);
  }

  private initializeReturnSelections(): void {
    this.selectedReturnItems = this.items.reduce((result, item) => {
      const variantId = this.getItemVariantId(item);
      if (variantId) {
        result[variantId] = true;
      }
      return result;
    }, {} as Record<string, boolean>);
  }

  private getReturnLineRefundAmounts(): Record<string, number> {
    const selectedItems = this.selectedOrderItems;
    const targetRefundAmount = this.getRefundAmount();
    const orderSubtotal = this.getOrderItemsSubtotal();
    const orderAdjustment = this.getPaidOrderAmount() - orderSubtotal;
    const adjustmentPerUnit = orderAdjustment / Math.max(this.getTotalPurchasedQuantity(), 1);
    let allocated = 0;

    return selectedItems.reduce((result, item, index) => {
      const variantId = this.getItemVariantId(item);
      if (!variantId) {
        return result;
      }

      const quantity = this.getItemReturnQuantity(item);
      const itemSubtotal = this.getItemUnitPrice(item) * quantity;
      const amount = index === selectedItems.length - 1
        ? Math.max(0, targetRefundAmount - allocated)
        : Math.max(0, Math.round(itemSubtotal + adjustmentPerUnit * quantity));

      allocated += amount;
      result[variantId] = amount;
      return result;
    }, {} as Record<string, number>);
  }

  private createEmptyReturnInfo(): ReturnInfoForm {
    return {
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

  private buildReturnInfoFromOrder(order: any): ReturnInfoForm {
    return {
      fullName: String(order?.Receiver_name || order?.Customer_name || '').trim(),
      phone: String(order?.Receiver_phone || order?.Phone_number || '').trim(),
      email: String(order?.Email || '').trim(),
      province: String(order?.Province || '').trim(),
      district: String(order?.District || '').trim(),
      ward: String(order?.Ward || '').trim(),
      specificAddress: String(order?.Specific_address || '').trim() || this.getSpecificAddressFallback(order),
      saveForNext: false,
    };
  }

  private getSpecificAddressFallback(order: any): string {
    const fullAddress = String(order?.Address || '').trim();
    if (!fullAddress) {
      return '';
    }

    return fullAddress.split(',')[0]?.trim() || fullAddress;
  }

  private syncLocationSelectionsFromDraft(): void {
    const province = this.findLocationByName(this.provinces, this.returnInfoDraft.province);
    this.selectedProvinceCode = province ? String(province.code) : '';
    this.districts = province?.districts || [];

    const district = this.findLocationByName(this.districts, this.returnInfoDraft.district);
    this.selectedDistrictCode = district ? String(district.code) : '';
    this.wards = district?.wards || [];

    const ward = this.findLocationByName(this.wards, this.returnInfoDraft.ward);
    this.selectedWardCode = ward ? String(ward.code) : '';
  }

  private findLocationByName<T extends { name: string }>(items: T[], value: string): T | null {
    const normalizedValue = this.normalizeText(value);
    if (!normalizedValue) {
      return null;
    }

    return items.find((item) => this.normalizeText(item.name) === normalizedValue) || null;
  }

  private validateBeforeConfirm(): string {
    if (!this.orderId || !this.order) {
      return 'Không tìm thấy đơn hàng cần hoàn trả.';
    }

    if (!this.isReturnableOrder()) {
      return 'Chỉ đơn hàng đã giao hoặc đang ở mục đánh giá mới có thể yêu cầu hoàn trả.';
    }

    if (!this.items.length) {
      return 'Đơn hàng không có sản phẩm để hoàn trả.';
    }

    if (!this.selectedOrderItems.length) {
      return 'Vui lòng chọn ít nhất một sản phẩm cần hoàn trả.';
    }

    if (this.getTotalQuantity() <= 0 || this.selectedOrderItems.some((item) => this.getItemReturnQuantity(item) > this.getPurchasedQuantity(item))) {
      return 'Số lượng sản phẩm hoàn trả chưa hợp lệ.';
    }

    if (!this.isReturnInfoComplete) {
      return 'Vui lòng nhập đầy đủ thông tin trả hàng.';
    }

    if (!this.isSpecificAddressRealistic(this.returnInfo.specificAddress)) {
      return 'Địa chỉ chi tiết cần có số nhà và tên đường/ấp/hẻm/thôn/xóm/tổ/khu thực tế, không chỉ nhập mỗi số.';
    }

    if (this.selectedReasonValues.length === 0) {
      return 'Vui lòng chọn ít nhất một lý do hoàn trả.';
    }

    if (this.isReasonSelected('other') && !this.otherReasonText.trim()) {
      return 'Vui lòng nhập lý do hoàn trả khác.';
    }

    if (!this.description.trim()) {
      return 'Vui lòng nhập mô tả chi tiết cho yêu cầu hoàn trả.';
    }

    if (!this.hasEvidence) {
      return 'Vui lòng thêm ít nhất một hình ảnh hoặc một video bằng chứng.';
    }

    if (this.isReadingEvidence) {
      return 'Vui lòng chờ ảnh/video bằng chứng tải xong trước khi xác nhận hoàn trả.';
    }

    return '';
  }

  private isReturnInfoFilled(info: ReturnInfoForm): boolean {
    return !!(
      info.fullName.trim() &&
      info.phone.trim() &&
      info.email.trim() &&
      info.province.trim() &&
      info.district.trim() &&
      info.ward.trim() &&
      info.specificAddress.trim()
    );
  }

  private validateReturnInfoDraft(): string {
    if (!this.isReturnInfoDraftComplete) {
      return 'Vui lòng nhập đầy đủ họ tên, số điện thoại, email và địa chỉ trả hàng.';
    }

    if (!this.isSpecificAddressRealistic(this.returnInfoDraft.specificAddress)) {
      return 'Địa chỉ chi tiết cần có số nhà và tên đường/ấp/hẻm/thôn/xóm/tổ/khu thực tế, không chỉ nhập mỗi số.';
    }

    return '';
  }

  private isSpecificAddressRealistic(value?: string | null): boolean {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    const normalized = this.normalizeText(text);
    const compact = normalized.replace(/[,.#-]/g, ' ').replace(/\s+/g, ' ').trim();

    if (text.length < 5 || /^\d+$/.test(text) || /^(so\s*)?\d+[a-z]?(\/\d+[a-z]?)?$/.test(compact)) {
      return false;
    }

    const hasNumber = /\d/.test(text);
    const hasLetter = /[a-zA-ZÀ-ỹ]/.test(text);
    const hasAddressKeyword = [
      'duong',
      'pho',
      'hem',
      'ngo',
      'thon',
      'xom',
      'ap',
      'ban',
      'khu',
      'toa',
      'chung cu',
      'quoc lo',
      'tinh lo',
    ].some((keyword) => compact.includes(keyword));
    const namedPart = compact
      .replace(/^(so\s*)?\d+[a-z]?(\/\d+[a-z]?)?\s*/, '')
      .split(' ')
      .filter((part) => part.length >= 2 && !/^\d+$/.test(part));

    return hasNumber && hasLetter && (hasAddressKeyword || namedPart.length >= 2);
  }

  private loadSavedReturnAddresses(): void {
    if (typeof localStorage === 'undefined') {
      this.savedReturnAddresses = [];
      return;
    }

    const raw = localStorage.getItem(SAVED_RETURN_ADDRESSES_KEY);
    if (!raw) {
      this.savedReturnAddresses = [];
      return;
    }

    try {
      const parsed = JSON.parse(raw);
      this.savedReturnAddresses = this.dedupeReturnAddresses(Array.isArray(parsed) ? parsed : []);
    } catch {
      this.savedReturnAddresses = [];
    }
  }

  private saveReturnAddress(info: ReturnInfoForm): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const savedAddress: ReturnInfoForm = {
      ...info,
      fullName: info.fullName.trim(),
      phone: info.phone.trim(),
      email: info.email.trim(),
      province: info.province.trim(),
      district: info.district.trim(),
      ward: info.ward.trim(),
      specificAddress: info.specificAddress.trim(),
      saveForNext: true,
      savedAt: Date.now(),
    };

    this.savedReturnAddresses = this.dedupeReturnAddresses([savedAddress, ...this.savedReturnAddresses]);
    localStorage.setItem(SAVED_RETURN_ADDRESSES_KEY, JSON.stringify(this.savedReturnAddresses));
  }

  private dedupeReturnAddresses(addresses: ReturnInfoForm[]): ReturnInfoForm[] {
    const result = new Map<string, ReturnInfoForm>();

    addresses
      .filter((item) => this.isReturnInfoFilled(item))
      .sort((a, b) => Number(b.savedAt || 0) - Number(a.savedAt || 0))
      .forEach((item) => {
        const key = this.buildReturnAddressKey(item);
        if (!result.has(key)) {
          result.set(key, {
            fullName: String(item.fullName || '').trim(),
            phone: String(item.phone || '').trim(),
            email: String(item.email || '').trim(),
            province: String(item.province || '').trim(),
            district: String(item.district || '').trim(),
            ward: String(item.ward || '').trim(),
            specificAddress: String(item.specificAddress || '').trim(),
            saveForNext: true,
            savedAt: Number(item.savedAt || 0),
          });
        }
      });

    return Array.from(result.values());
  }

  private buildReturnAddressKey(info: ReturnInfoForm): string {
    return [
      info.fullName,
      info.phone,
      info.email,
      info.specificAddress,
      info.ward,
      info.district,
      info.province,
    ].map((part) => this.normalizeText(part)).join('|');
  }

  private extractReturnRequestId(res: any): string {
    const data = res?.data || {};
    return String(
      data.Return_order_id ||
      data.returnSummary?.latest?.Return_order_id ||
      data.returnSummary?.requests?.[0]?.Return_order_id ||
      ''
    ).trim();
  }

  private resolveSubmitError(err: any): string {
    if (err?.status === 413) {
      return err?.error?.message || 'Dung lượng ảnh/video bằng chứng quá lớn. Vui lòng chọn tệp nhỏ hơn rồi thử lại.';
    }

    return err?.error?.message || err?.message || 'Không thể gửi yêu cầu hoàn trả. Vui lòng thử lại sau.';
  }

  private readOrderFromHistoryState(): any {
    try {
      return history.state?.order || null;
    } catch {
      return null;
    }
  }

  private readStoredReturnOrder(): any {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    const raw = sessionStorage.getItem('vista_return_order_data');
    if (!raw) {
      return null;
    }

    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  private pickUsableOrder(order: any): any {
    if (!order) {
      return null;
    }

    const code = String(order?.Order_code || order?.Order_id || '').trim();
    if (!this.orderId || code === this.orderId) {
      return order;
    }

    return null;
  }

  private normalizeStatus(value: any): string {
    return this.normalizeText(value);
  }

  private normalizeText(value: any): string {
    return String(value || '')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'd');
  }
}
