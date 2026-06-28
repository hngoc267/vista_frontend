import { ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { NotificationService } from '../../components/notification/notification.service';
import { OrderHistory as OrderHistoryApi } from '../../services/order-history';
import { CreateReviewPayload, ReviewService } from '../../services/review';

interface ReviewAttachment {
  name: string;
  type: 'image' | 'video';
  size: number;
  preview: string;
}

interface ReviewDraft {
  rating: number;
  hoverRating: number;
  comment: string;
  attachments: ReviewAttachment[];
  pendingAttachmentReads: number;
  submitError: string;
}

interface SubmittedReviewSummary {
  reviewId: string;
  orderDetailId: string;
  productName: string;
  rating: number;
}

const REVIEW_ORDER_STORAGE_KEY = 'vista_review_order_data';
const REVIEW_PRODUCT_STORAGE_KEY = 'vista_product_reviews_cache';

@Component({
  selector: 'app-review',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './review.html',
  styleUrls: ['./review.scss'],
})
export class Review implements OnInit {
  orderId = '';
  selectedOrderDetailId = '';
  order: any = null;
  selectedItem: any = null;
  reviewTargets: any[] = [];
  reviewDrafts: Record<string, ReviewDraft> = {};
  currentReviewIndex = 0;

  readonly maxAttachmentCount = 3;
  readonly stars = [1, 2, 3, 4, 5];

  isLoadingOrder = true;
  loadError = '';
  submitError = '';
  isSubmitting = false;
  isSuccessModalOpen = false;
  createdReviewId = '';
  submittedReviews: SubmittedReviewSummary[] = [];

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private orderHistoryService: OrderHistoryApi,
    private reviewService: ReviewService,
    private notificationService: NotificationService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.orderId = String(this.route.snapshot.queryParamMap.get('orderId') || '').trim();
    this.selectedOrderDetailId = String(this.route.snapshot.queryParamMap.get('orderDetailId') || '').trim();
    this.loadOrderForReview();
  }

  get items(): any[] {
    const candidates = [
      this.order?.Items,
      this.order?.items,
      this.order?.Order_items,
      this.order?.orderItems,
      this.order?.Products,
      this.order?.products,
    ];
    const matched = candidates.find((value) => Array.isArray(value));
    return Array.isArray(matched) ? matched : [];
  }

  get activeReviewTargets(): any[] {
    const targets = Array.isArray(this.reviewTargets)
      ? this.reviewTargets.filter(Boolean)
      : [];

    if (targets.length) {
      return targets;
    }

    return this.selectedItem ? [this.selectedItem] : [];
  }

  get currentReviewItem(): any {
    return this.activeReviewTargets[this.safeCurrentReviewIndex] || null;
  }

  get additionalReviewTargets(): any[] {
    return this.activeReviewTargets.slice(1);
  }

  get safeCurrentReviewIndex(): number {
    const maxIndex = Math.max(0, this.activeReviewTargets.length - 1);
    return Math.min(Math.max(0, this.currentReviewIndex), maxIndex);
  }

  get canGoPreviousReviewItem(): boolean {
    return this.safeCurrentReviewIndex > 0;
  }

  get canGoNextReviewItem(): boolean {
    return this.safeCurrentReviewIndex < this.activeReviewTargets.length - 1;
  }

  get completedReviewCount(): number {
    return this.activeReviewTargets.filter((item) => this.isReviewDraftComplete(item)).length;
  }

  get attachmentSlots(): number[] {
    return Array.from({ length: this.maxAttachmentCount });
  }

  get canSubmitReview(): boolean {
    return !this.validateBeforeSubmit();
  }

  loadOrderForReview(): void {
    const stateOrder = this.readOrderFromHistoryState();
    const storedOrder = this.readStoredReviewOrder();
    const candidate = this.pickUsableOrder(stateOrder) || this.pickUsableOrder(storedOrder);

    if (candidate) {
      this.setOrder(candidate);
      this.isLoadingOrder = false;
      return;
    }

    if (!this.orderId) {
      this.loadError = 'Không tìm thấy mã đơn hàng cần đánh giá.';
      this.isLoadingOrder = false;
      return;
    }

    this.orderHistoryService.getOrderHistory('all').subscribe({
      next: (res) => {
        const orders = Array.isArray(res?.data) ? res.data : [];
        const foundOrder = orders.find((item: any) => {
          const code = String(item?.Order_code || item?.Order_id || '').trim();
          return code === this.orderId;
        });

        if (!foundOrder) {
          this.loadError = 'Không tìm thấy đơn hàng cần đánh giá.';
          this.order = null;
        } else {
          this.setOrder(foundOrder);
        }

        this.isLoadingOrder = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        this.loadError = err?.error?.message || 'Không thể tải thông tin sản phẩm cần đánh giá.';
        this.isLoadingOrder = false;
        this.cdr.detectChanges();
      },
    });
  }

  setOrder(order: any): void {
    this.order = order;
    this.orderId = String(order?.Order_code || order?.Order_id || this.orderId || '').trim();

    const stateItem = this.readReviewItemFromHistoryState();
    const stateDetailId = this.getItemOrderDetailId(stateItem);
    if (!this.selectedOrderDetailId && stateDetailId) {
      this.selectedOrderDetailId = stateDetailId;
    }

    if (!this.items.length && stateItem) {
      this.order = {
        ...this.order,
        Items: [stateItem],
      };
    }

    const itemsWithDetailId = this.items.filter((item, index) => {
      if (item && !item.__reviewDraftKey) {
        item.__reviewDraftKey = this.buildItemDraftKey(item, index);
      }

      return !!item;
    });
    if (!this.items.length) {
      this.loadError = 'Đơn hàng này chưa có sản phẩm hợp lệ để đánh giá.';
      return;
    }

    if (!itemsWithDetailId.length) {
      this.loadError = 'Thiếu mã chi tiết đơn hàng. Vui lòng bổ sung Order_detail_id trong API lịch sử đơn hàng.';
      return;
    }

    const targets = itemsWithDetailId.filter((item) => !this.isItemReviewed(item));
    if (!targets.length) {
      this.loadError = 'Tất cả sản phẩm trong đơn hàng này đã được đánh giá.';
      return;
    }

    this.reviewTargets = this.sortReviewTargets(targets);
    this.selectedItem = this.reviewTargets[0] || null;
    this.selectedOrderDetailId = this.getItemOrderDetailId(this.selectedItem);
    this.currentReviewIndex = 0;
    this.reviewDrafts = {};
    this.reviewTargets.forEach((item) => this.ensureReviewDraft(this.getItemDraftKey(item)));
    this.loadError = '';
  }

  selectReviewTarget(index: number): void {
    const nextIndex = Math.max(0, Math.min(index, this.activeReviewTargets.length - 1));
    this.currentReviewIndex = nextIndex;
    this.selectedItem = this.activeReviewTargets[nextIndex] || null;
    this.selectedOrderDetailId = this.getItemOrderDetailId(this.selectedItem);
    this.submitError = '';
  }

  showPreviousReviewItem(): void {
    if (this.canGoPreviousReviewItem) {
      this.selectReviewTarget(this.safeCurrentReviewIndex - 1);
    }
  }

  showNextReviewItem(): void {
    if (this.canGoNextReviewItem) {
      this.selectReviewTarget(this.safeCurrentReviewIndex + 1);
    }
  }

  setItemRating(item: any, value: number): void {
    const draft = this.getReviewDraft(item);
    draft.rating = value;
    draft.submitError = '';
    this.submitError = '';
  }

  previewItemRating(item: any, value: number): void {
    this.getReviewDraft(item).hoverRating = value;
  }

  clearItemRatingPreview(item: any): void {
    this.getReviewDraft(item).hoverRating = 0;
  }

  getItemDisplayRating(item: any): number {
    const draft = this.getReviewDraft(item);
    return draft.hoverRating || draft.rating;
  }

  setItemComment(item: any, value: string): void {
    const draft = this.getReviewDraft(item);
    draft.comment = String(value || '').slice(0, 1000);
    draft.submitError = '';
    this.submitError = '';
  }

  onItemAttachmentSelected(event: Event, item: any): void {
    const input = event.target as HTMLInputElement;
    const draft = this.getReviewDraft(item);
    const selectedFiles = Array.from(input.files || []);
    const remaining = Math.max(0, this.maxAttachmentCount - draft.attachments.length);

    selectedFiles.slice(0, remaining).forEach((file) => {
      const attachment: ReviewAttachment = {
        name: file.name,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        size: file.size,
        preview: '',
      };

      draft.attachments.push(attachment);

      const reader = new FileReader();
      draft.pendingAttachmentReads += 1;
      reader.onload = () => {
        attachment.preview = String(reader.result || '');
        draft.pendingAttachmentReads = Math.max(0, draft.pendingAttachmentReads - 1);
        this.cdr.detectChanges();
      };
      reader.onerror = () => {
        draft.attachments = draft.attachments.filter((fileItem) => fileItem !== attachment);
        draft.pendingAttachmentReads = Math.max(0, draft.pendingAttachmentReads - 1);
        draft.submitError = 'Không thể đọc tệp đính kèm. Vui lòng chọn tệp khác.';
        this.cdr.detectChanges();
      };
      reader.readAsDataURL(file);
    });

    input.value = '';
  }

  removeItemAttachment(item: any, index: number): void {
    const draft = this.getReviewDraft(item);
    draft.attachments.splice(index, 1);
    draft.submitError = '';
    this.submitError = '';
  }

  canAddItemAttachment(item: any): boolean {
    return this.getReviewDraft(item).attachments.length < this.maxAttachmentCount;
  }

  getItemAttachment(item: any, index: number): ReviewAttachment | null {
    return this.getReviewDraft(item).attachments[index] || null;
  }

  isReviewDraftComplete(item: any): boolean {
    const draft = this.getReviewDraft(item);
    return draft.rating >= 1 && draft.rating <= 5;
  }

  async submitReview(): Promise<void> {
    const error = this.validateBeforeSubmit();
    if (error) {
      this.submitError = error;
      return;
    }

    this.isSubmitting = true;
    this.submitError = '';
    this.submittedReviews = [];

    try {
      const summaries: SubmittedReviewSummary[] = [];

      for (const item of this.activeReviewTargets) {
        const orderDetailId = this.getItemOrderDetailId(item);
        const draft = this.getReviewDraft(item);
        const payload: CreateReviewPayload = {
          Order_detail_id: orderDetailId,
          Rating: draft.rating,
          Comment: draft.comment.trim(),
          Images: this.serializeAttachments(draft.attachments),
        };

        const res = await firstValueFrom(this.reviewService.createReview(payload));
        if (!res.success) {
          draft.submitError = res.message || 'Không thể gửi đánh giá. Vui lòng thử lại.';
          throw new Error(draft.submitError);
        }

        const reviewData = res.data as any;
        const reviewId = String(reviewData?.Review_id || '').trim();
        try {
          this.cacheProductReview(item, reviewData, draft);
        } catch {
          // Cache phu, khong de loi storage chan viec gui danh gia.
        }
        this.markItemReviewed(item, reviewData, draft);
        summaries.push({
          reviewId,
          orderDetailId,
          productName: String(item?.Product_name || item?.productName || 'Sản phẩm').trim(),
          rating: draft.rating,
        });
      }

      this.submittedReviews = summaries;
      this.createdReviewId = summaries.map((item) => item.reviewId).filter(Boolean).join(', ');
      this.isSuccessModalOpen = true;

      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(REVIEW_ORDER_STORAGE_KEY);
      }

      this.notificationService.success('Đã gửi đánh giá sản phẩm thành công.');
    } catch (err) {
      this.reviewTargets = this.reviewTargets.filter((item) => !this.isItemReviewed(item));
      this.submitError = this.resolveSubmitError(err);
    } finally {
      this.isSubmitting = false;
      this.cdr.detectChanges();
    }
  }

  goBack(): void {
    this.router.navigate(['/order-history'], { queryParams: { status: 'review' } });
  }

  finishReview(): void {
    this.router.navigate(['/order-history'], { queryParams: { status: 'review' } });
  }

  formatPrice(value: number): string {
    return `${Number(value || 0).toLocaleString('vi-VN').replace(/,/g, '.')} đ`;
  }

  getItemOrderDetailId(item: any): string {
    return String(
      item?.Order_detail_id ||
      item?.OrderDetail_id ||
      item?.orderDetailId ||
      item?.detailId ||
      ''
    ).trim();
  }

  getItemProductId(item: any): string {
    return String(
      item?.Product_id ||
      item?.productId ||
      item?.Product?.Product_id ||
      item?.product?.Product_id ||
      ''
    ).trim();
  }

  getItemProductVariantId(item: any): string {
    return String(
      item?.Product_variant_id ||
      item?.productVariantId ||
      item?.Variant_id ||
      item?.variantId ||
      ''
    ).trim();
  }

  getItemVariantName(item: any): string {
    return String(item?.Variant_name || item?.variantName || 'Tiêu chuẩn').trim();
  }

  getItemQuantity(item: any): number {
    return Math.max(1, Number(item?.Quantity || item?.quantity || 1) || 1);
  }

  getProductImage(item: any): string {
    return item?.Image || item?.image || '/assets/images/default-product.png';
  }

  hideBrokenImage(event: Event): void {
    const image = event.target as HTMLImageElement;
    image.src = '/assets/images/default-product.png';
  }

  isAttachmentImage(file: ReviewAttachment): boolean {
    return file.type === 'image' && !!file.preview;
  }

  isAttachmentVideo(file: ReviewAttachment): boolean {
    return file.type === 'video' && !!file.preview;
  }

  isItemReviewed(item: any): boolean {
    const reviewId = String(item?.Review_id || item?.reviewId || '').trim();
    const reviewStatus = this.normalizeText(item?.Review_status || item?.reviewStatus || '');
    return !!reviewId || reviewStatus === 'reviewed' || reviewStatus === 'da danh gia' || item?.Reviewed === true;
  }

  trackByOrderDetail(index: number, item: any): string {
    return this.getItemDraftKey(item) || String(index);
  }

  trackByAttachment(index: number, file: ReviewAttachment): string {
    return `${index}-${file.name}-${file.size}`;
  }

  getReviewDraft(item: any): ReviewDraft {
    return this.ensureReviewDraft(this.getItemDraftKey(item));
  }

  getItemDraftKey(item: any): string {
    const storedKey = String(item?.__reviewDraftKey || '').trim();
    if (storedKey) {
      return storedKey;
    }

    return this.getItemOrderDetailId(item)
      || this.getItemProductVariantId(item)
      || this.getItemProductId(item)
      || String(item?.Product_name || item?.productName || item?.Name || '').trim()
      || `review-item-${this.activeReviewTargets.indexOf(item)}`;
  }

  private buildItemDraftKey(item: any, index: number): string {
    return this.getItemOrderDetailId(item)
      || this.getItemProductVariantId(item)
      || this.getItemProductId(item)
      || `${String(item?.Product_name || item?.productName || item?.Name || 'product').trim()}-${index}`;
  }

  private ensureReviewDraft(draftKey: string): ReviewDraft {
    const key = draftKey || 'missing-detail-id';
    if (!this.reviewDrafts[key]) {
      this.reviewDrafts[key] = this.createEmptyReviewDraft();
    }

    return this.reviewDrafts[key];
  }

  private createEmptyReviewDraft(): ReviewDraft {
    return {
      rating: 0,
      hoverRating: 0,
      comment: '',
      attachments: [],
      pendingAttachmentReads: 0,
      submitError: '',
    };
  }

  private sortReviewTargets(items: any[]): any[] {
    if (!this.selectedOrderDetailId) {
      return [...items];
    }

    return [...items].sort((a, b) => {
      const aSelected = this.getItemOrderDetailId(a) === this.selectedOrderDetailId;
      const bSelected = this.getItemOrderDetailId(b) === this.selectedOrderDetailId;
      if (aSelected === bSelected) {
        return 0;
      }

      return aSelected ? -1 : 1;
    });
  }

  private markItemReviewed(item: any, reviewData: any, draft: ReviewDraft): void {
    const selectedDetailId = this.getItemOrderDetailId(item);
    const images = reviewData?.Images || this.serializeAttachments(draft.attachments);
    const reviewedPatch = {
      Review_id: reviewData?.Review_id || 'reviewed',
      Review_status: 'reviewed',
      Review_rating: reviewData?.Rating || draft.rating,
      Review_comment: reviewData?.Comment ?? draft.comment.trim(),
      Review_images: images,
      Review_created_at: reviewData?.Created_at || new Date().toISOString(),
      Reviewed: true,
    };

    Object.assign(item, reviewedPatch);

    this.order = {
      ...this.order,
      Items: this.items.map((orderItem) => {
        if (this.getItemOrderDetailId(orderItem) !== selectedDetailId) {
          return orderItem;
        }

        return {
          ...orderItem,
          ...reviewedPatch,
        };
      }),
    };
  }

  private validateBeforeSubmit(): string {
    if (!this.order || !this.activeReviewTargets.length) {
      return 'Không tìm thấy sản phẩm cần đánh giá.';
    }

    for (const item of this.activeReviewTargets) {
      const orderDetailId = this.getItemOrderDetailId(item);
      const draft = this.getReviewDraft(item);

      if (!orderDetailId) {
        return 'Thiếu mã chi tiết đơn hàng. Vui lòng bổ sung Order_detail_id trong dữ liệu lịch sử đơn hàng.';
      }

      if (draft.rating < 1 || draft.rating > 5) {
        return `Vui lòng chọn số sao cho "${item?.Product_name || 'sản phẩm'}".`;
      }

      if (draft.pendingAttachmentReads > 0) {
        return 'Vui lòng chờ tệp đính kèm tải xong trước khi gửi đánh giá.';
      }
    }

    return '';
  }

  private serializeAttachments(attachments: ReviewAttachment[]): string[] {
    return attachments
      .filter((file) => !!file.preview)
      .map((file) => file.preview || file.name)
      .filter(Boolean);
  }

  private cacheProductReview(item: any, reviewData: any, draft: ReviewDraft): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    const productId = this.getItemProductId(item);
    const productVariantId = this.getItemProductVariantId(item);
    if (!productId && !productVariantId) {
      return;
    }

    const cachedReview = {
      Review_id: reviewData?.Review_id || `local-${Date.now()}-${this.getItemOrderDetailId(item)}`,
      Order_detail_id: this.getItemOrderDetailId(item),
      Product_id: productId,
      Product_variant_id: productVariantId,
      User_name: this.getCurrentReviewerName(),
      Rating: reviewData?.Rating || draft.rating,
      Comment: reviewData?.Comment ?? draft.comment.trim(),
      Images: this.getCacheSafeReviewImages(reviewData?.Images),
      Created_at: reviewData?.Created_at || new Date().toISOString(),
    };

    try {
      const reviews = this.readProductReviewCacheForWrite();
      const nextReviews = Array.isArray(reviews)
        ? reviews.filter((review) => review?.Order_detail_id !== cachedReview.Order_detail_id)
        : [];
      nextReviews.unshift(cachedReview);
      this.writeProductReviewCache(nextReviews);
    } catch {
      this.clearProductReviewCache();
    }
  }

  private readProductReviewCacheForWrite(): any[] {
    try {
      const raw = localStorage.getItem(REVIEW_PRODUCT_STORAGE_KEY);
      const reviews = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(reviews)) {
        return [];
      }

      return reviews.map((review) => ({
        ...review,
        Images: this.getCacheSafeReviewImages(review?.Images),
      }));
    } catch {
      return [];
    }
  }

  private writeProductReviewCache(reviews: any[]): void {
    const compactReviews = (Array.isArray(reviews) ? reviews : [])
      .slice(0, 20)
      .map((review) => ({
        Review_id: review?.Review_id || review?.id || '',
        Order_detail_id: review?.Order_detail_id || '',
        Product_id: review?.Product_id || review?.productId || '',
        Product_variant_id: review?.Product_variant_id || review?.productVariantId || '',
        User_name: review?.User_name || review?.user || this.getCurrentReviewerName(),
        Rating: review?.Rating || review?.rating || 5,
        Comment: review?.Comment ?? review?.comment ?? '',
        Images: this.getCacheSafeReviewImages(review?.Images || review?.images),
        Created_at: review?.Created_at || review?.createdAt || new Date().toISOString(),
      }));

    try {
      localStorage.setItem(REVIEW_PRODUCT_STORAGE_KEY, JSON.stringify(compactReviews));
      return;
    } catch {
      this.clearProductReviewCache();
    }

    try {
      const latestReview = compactReviews[0]
        ? [{ ...compactReviews[0], Images: [] }]
        : [];
      localStorage.setItem(REVIEW_PRODUCT_STORAGE_KEY, JSON.stringify(latestReview));
    } catch {
      this.clearProductReviewCache();
    }
  }

  private clearProductReviewCache(): void {
    try {
      localStorage.removeItem(REVIEW_PRODUCT_STORAGE_KEY);
    } catch {
      // Cache phu, khong de loi storage chan viec gui danh gia.
    }
  }

  private getCacheSafeReviewImages(value: any): string[] {
    const items = Array.isArray(value) ? value : value ? [value] : [];
    return items
      .flatMap((item) => Array.isArray(item) ? item : [item])
      .map((item) => String(item || '').trim())
      .filter((item) => this.isCacheSafeReviewImage(item))
      .slice(0, this.maxAttachmentCount);
  }

  private isCacheSafeReviewImage(value: string): boolean {
    if (!value || value.length > 600) {
      return false;
    }

    return /^(https?:\/\/|\/|assets\/|uploads\/|public\/|static\/)/i.test(value)
      && !/^(data:|blob:)/i.test(value);
  }

  private getCurrentReviewerName(): string {
    const storageSources = [
      typeof localStorage !== 'undefined' ? localStorage : null,
      typeof sessionStorage !== 'undefined' ? sessionStorage : null,
    ];

    for (const storage of storageSources) {
      const name = this.getReviewerNameFromStorage(storage);
      if (name) {
        return name;
      }
    }

    return 'Khách hàng VISTA';
  }

  private getReviewerNameFromStorage(storage: Storage | null): string {
    if (!storage) {
      return '';
    }

    const preferredKeys = [
      'vista_user',
      'currentUser',
      'current_user',
      'authUser',
      'auth_user',
      'loggedInUser',
      'user',
      'User',
      'account',
      'profile',
    ];

    for (const key of preferredKeys) {
      const value = this.extractReviewerName(storage.getItem(key));
      if (value) {
        return value;
      }
    }

    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index) || '';
      if (!/(user|auth|account|profile|customer)/i.test(key)) {
        continue;
      }

      const value = this.extractReviewerName(storage.getItem(key));
      if (value) {
        return value;
      }
    }

    return '';
  }

  private extractReviewerName(value: any): string {
    if (!value) {
      return '';
    }

    if (typeof value === 'object') {
      const directName = this.cleanReviewerName(
        value.Full_name
        || value.full_name
        || value.FullName
        || value.fullName
        || value.Customer_name
        || value.customerName
        || value.Name
        || value.name
        || value.Username
        || value.username
        || value.Email
        || value.email
      );

      if (directName) {
        return directName;
      }

      return this.extractReviewerName(value.user || value.customer || value.account || value.profile || value.data);
    }

    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }

    try {
      return this.extractReviewerName(JSON.parse(raw));
    } catch {
      const decodedPayload = this.decodeJwtPayload(raw);
      if (decodedPayload) {
        return this.extractReviewerName(decodedPayload);
      }

      return this.cleanReviewerName(raw);
    }
  }

  private decodeJwtPayload(token: string): any {
    const payload = String(token || '').split('.')[1];
    if (!payload) {
      return null;
    }

    try {
      const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      const json = decodeURIComponent(
        atob(padded)
          .split('')
          .map((char) => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
          .join('')
      );

      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  private cleanReviewerName(value: any): string {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text || text.length > 80 || /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\./.test(text)) {
      return '';
    }

    return text;
  }

  private resolveSubmitError(err: any): string {
    if (err?.status === 409) {
      return err?.error?.message || 'Sản phẩm này đã được đánh giá trước đó.';
    }

    if (err?.status === 413) {
      return err?.error?.message || 'Dung lượng tệp đính kèm quá lớn. Vui lòng chọn tệp nhỏ hơn.';
    }

    return err?.error?.message || err?.message || 'Không thể gửi đánh giá. Vui lòng thử lại sau.';
  }

  private normalizeText(value: any): string {
    return String(value || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');
  }

  private readOrderFromHistoryState(): any {
    try {
      return history.state?.order || null;
    } catch {
      return null;
    }
  }

  private readReviewItemFromHistoryState(): any {
    try {
      return history.state?.item || null;
    } catch {
      return null;
    }
  }

  private readStoredReviewOrder(): any {
    if (typeof sessionStorage === 'undefined') {
      return null;
    }

    const raw = sessionStorage.getItem(REVIEW_ORDER_STORAGE_KEY);
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
}
