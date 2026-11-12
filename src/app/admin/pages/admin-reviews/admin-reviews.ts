import { ChangeDetectorRef, Component, HostListener, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription, finalize } from 'rxjs';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideSearch,
  lucideX,
  lucideEye,
  lucideTriangleAlert,
  lucideRefreshCw,
  lucideMessageSquare,
  lucideStar,
  lucideSparkles,
} from '@ng-icons/lucide';
import { getAdminRole } from '../../../guards/admin-guard';
import { ResizableDrawerDirective } from '../../directives/resizable-drawer.directive';
import {
  AdminReviewDetail,
  AdminReviewService,
  AdminReviewSummary,
  ReviewDisplayStatus,
  ReviewHistoryItem,
} from '../../services/admin-review';

const STATUS_LABELS: Record<ReviewDisplayStatus, string> = {
  pending: 'Chờ kiểm duyệt',
  approved: 'Đã duyệt',
  replied: 'Đã phản hồi',
  rejected: 'Từ chối',
};

const REPLY_MAX_LENGTH = 1000;
const REPLY_MIN_LENGTH = 10;

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule, NgIcon, ResizableDrawerDirective],
  providers: [
    provideIcons({
      lucideSearch,
      lucideX,
      lucideEye,
      lucideTriangleAlert,
      lucideRefreshCw,
      lucideMessageSquare,
      lucideStar,
      lucideSparkles,
    }),
  ],
  templateUrl: './admin-reviews.html',
  styleUrl: './admin-reviews.scss',
})
export class AdminReviews implements OnInit, OnDestroy {
  // Staff duyệt, soạn và gửi phản hồi. Manager chỉ xem.
  readonly role = getAdminRole();
  readonly canEdit = this.role === 'Staff';
  readonly statusOptions = (Object.keys(STATUS_LABELS) as ReviewDisplayStatus[]).map((value) => ({
    value,
    label: STATUS_LABELS[value],
  }));
  readonly ratingOptions = [5, 4, 3, 2, 1];
  readonly pageSizeOptions = [10, 20, 50];
  readonly replyMaxLength = REPLY_MAX_LENGTH;

  // Bộ lọc danh sách
  keyword = '';
  statusFilter = '';
  ratingFilter: number | '' = '';
  fromDate = '';
  toDate = '';
  page = 1;
  limit = 10;

  reviews: AdminReviewSummary[] = [];
  total = 0;
  counts: Record<string, number> = {};
  isLoading = false;
  loadError = '';

  // Drawer chi tiết
  isDetailOpen = false;
  isDetailLoading = false;
  detailError = '';
  detail: AdminReviewDetail | null = null;

  // Soạn phản hồi
  draftText = '';
  isEditing = false;
  isSuggesting = false;
  isSaving = false;
  isSending = false;
  isModerating = false;
  replyError = '';

  // Popup xác nhận gửi / từ chối
  isSendConfirmOpen = false;
  isRejectOpen = false;
  rejectNote = '';
  modalError = '';

  toastMessage = '';
  toastType: 'success' | 'error' = 'success';

  private searchTimer?: ReturnType<typeof setTimeout>;
  private toastTimer?: ReturnType<typeof setTimeout>;
  private queryParamsSubscription?: Subscription;
  private detailLoadId = 0;

  constructor(
    private readonly reviewService: AdminReviewService,
    private readonly changeDetectorRef: ChangeDetectorRef,
    private readonly route: ActivatedRoute,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    // Mở từ thông báo: /admin/reviews?reviewId=... → mở chi tiết đánh giá đó
    this.queryParamsSubscription = this.route.queryParamMap.subscribe((params) => {
      const reviewId = params.get('reviewId')?.trim();
      if (reviewId) {
        this.openDetail(reviewId);
        this.router.navigate([], { relativeTo: this.route, queryParams: {}, replaceUrl: true });
        return;
      }

      this.loadReviews();
    });
  }

  ngOnDestroy(): void {
    clearTimeout(this.searchTimer);
    clearTimeout(this.toastTimer);
    this.queryParamsSubscription?.unsubscribe();
  }

  // ===== Danh sách =====

  loadReviews(silent = false): void {
    if (!silent) {
      this.isLoading = true;
      this.loadError = '';
    }

    this.reviewService
      .getReviews({
        keyword: this.keyword.trim(),
        status: this.statusFilter,
        rating: this.ratingFilter,
        fromDate: this.fromDate,
        toDate: this.toDate,
        page: this.page,
        limit: this.limit,
      })
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.changeDetectorRef.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          this.reviews = response.data?.items ?? [];
          this.total = response.data?.total ?? 0;
          this.counts = response.data?.counts ?? {};
          this.loadError = '';
        },
        error: () => {
          // Tải lại ngầm bị lỗi thì giữ nguyên dữ liệu đang hiển thị
          if (silent) return;
          this.reviews = [];
          this.total = 0;
          this.loadError = 'Không tải được danh sách đánh giá. Vui lòng thử lại.';
        },
      });
  }

  onKeywordChange(): void {
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.applyFilters(), 400);
  }

  applyFilters(): void {
    this.page = 1;
    this.loadReviews();
  }

  // Bấm nhãn trạng thái phía trên bảng để lọc nhanh (bấm lại để bỏ lọc)
  toggleStatusChip(status: ReviewDisplayStatus): void {
    this.statusFilter = this.statusFilter === status ? '' : status;
    this.applyFilters();
  }

  clearFilters(): void {
    this.keyword = '';
    this.statusFilter = '';
    this.ratingFilter = '';
    this.fromDate = '';
    this.toDate = '';
    this.applyFilters();
  }

  get hasActiveFilters(): boolean {
    return this.hasFilters;
  }

  onLimitChange(): void {
    this.page = 1;
    this.loadReviews();
  }

  get hasFilters(): boolean {
    return !!(this.keyword.trim() || this.statusFilter || this.ratingFilter || this.fromDate || this.toDate);
  }

  getCount(key: string): number {
    return this.counts[key] ?? 0;
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }

  get rangeStart(): number {
    return this.total === 0 ? 0 : (this.page - 1) * this.limit + 1;
  }

  get rangeEnd(): number {
    return Math.min(this.page * this.limit, this.total);
  }

  goToPage(page: number): void {
    if (page < 1 || page > this.totalPages || page === this.page) {
      return;
    }

    this.page = page;
    this.loadReviews();
  }

  // ===== Chi tiết =====

  openDetail(reviewId: string, summary?: AdminReviewSummary): void {
    this.isDetailOpen = true;
    this.isDetailLoading = true;
    this.detailError = '';
    this.detail = summary ? this.createDetailPreview(summary) : null;
    this.replyError = '';
    this.isEditing = false;
    const loadId = ++this.detailLoadId;

    this.reviewService
      .getReviewDetail(reviewId)
      .pipe(
        finalize(() => {
          if (loadId !== this.detailLoadId) return;
          this.isDetailLoading = false;
          this.changeDetectorRef.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          if (loadId !== this.detailLoadId) return;
          if (!response.data) {
            this.detailError = 'Không có dữ liệu chi tiết đánh giá.';
            return;
          }
          this.detail = response.data;
          this.resetDraftFromDetail();
        },
        error: () => {
          if (loadId !== this.detailLoadId) return;
          this.detailError = 'Không tải được chi tiết đánh giá. Vui lòng thử lại.';
        },
      });
  }

  private createDetailPreview(review: AdminReviewSummary): AdminReviewDetail {
    return {
      Review_id: review.Review_id,
      Created_at: review.Created_at,
      Rating: review.Rating,
      Comment: review.Comment,
      Images: [],
      Display_status: review.Display_status,
      Available_actions: [],
      Customer_name: review.Customer_name,
      Customer_phone: '',
      Customer_email: '',
      Order_id: '',
      Is_verified_purchase: false,
      Product_id: '',
      Product_name: review.Product_name,
      Variant_name: review.Variant_name,
      Product_variant_id: review.Product_variant_id,
      Image: review.Image,
      Moderated_by_name: '',
      Moderated_at: null,
      Moderation_note: '',
      AI_reply_draft: '',
      Reply_draft: '',
      Reply_draft_version: 0,
      Reply_draft_by_name: '',
      Reply_draft_at: null,
      Reply_reviewed: false,
      Reply_content: '',
      Replied_by_name: '',
      Replied_at: review.Replied_at,
      History: [],
    };
  }

  // Tải lại chi tiết đang mở. keepDraft = giữ nguyên nội dung Staff đang gõ.
  private refreshDetail(reviewId: string, keepDraft = false): void {
    this.reviewService.getReviewDetail(reviewId).subscribe({
      next: (response) => {
        if (this.isDetailOpen && this.detail?.Review_id === reviewId && response.data) {
          this.detail = response.data;
          if (!keepDraft) {
            this.resetDraftFromDetail();
          }
          this.changeDetectorRef.detectChanges();
        }
      },
    });
  }

  closeDetail(): void {
    if (this.isSending || this.isSaving) {
      return;
    }

    this.detailLoadId++;
    this.isDetailOpen = false;
    this.detail = null;
    this.isSendConfirmOpen = false;
    this.isRejectOpen = false;
    this.replyError = '';
  }

  // Có bản nháp đã rà soát → hiển thị chỉ đọc. Có gợi ý AI hoặc chưa có gì → cho soạn ngay.
  private resetDraftFromDetail(): void {
    const detail = this.detail;
    this.replyError = '';

    if (!detail) {
      this.draftText = '';
      this.isEditing = false;
      return;
    }

    if (detail.Reply_draft) {
      this.draftText = detail.Reply_draft;
      this.isEditing = false;
    } else {
      this.draftText = detail.AI_reply_draft || '';
      this.isEditing = true;
    }
  }

  hasAction(action: string): boolean {
    return this.canEdit && !!this.detail?.Available_actions.includes(action as never);
  }

  get isApproved(): boolean {
    return this.detail?.Display_status === 'approved';
  }

  get draftTrimmed(): string {
    return this.draftText.trim();
  }

  // Nội dung đang gõ khác với bản nháp đã lưu
  get isDirty(): boolean {
    return this.draftTrimmed !== (this.detail?.Reply_draft ?? '').trim();
  }

  get canSaveDraft(): boolean {
    return (
      this.canEdit &&
      this.isApproved &&
      this.isEditing &&
      this.draftTrimmed.length > 0 &&
      (!this.detail?.Reply_reviewed || this.isDirty) &&
      !this.isSaving &&
      !this.isSuggesting
    );
  }

  // Chỉ gửi được bản đã rà soát và không có chỉnh sửa chưa lưu
  get canSend(): boolean {
    return (
      this.canEdit &&
      this.isApproved &&
      !!this.detail?.Reply_reviewed &&
      !!this.detail?.Reply_draft &&
      !this.isDirty &&
      !this.isSaving &&
      !this.isSuggesting &&
      !this.isSending
    );
  }

  get isAiDraftShown(): boolean {
    return !this.detail?.Reply_reviewed && !!this.detail?.AI_reply_draft;
  }

  get historyItems(): ReviewHistoryItem[] {
    return this.detail?.History ?? [];
  }

  startEditing(): void {
    this.isEditing = true;
  }

  // ===== Duyệt / từ chối đánh giá =====

  approveReview(): void {
    if (!this.detail || this.isModerating) return;
    this.runModeration('approve', '');
  }

  openRejectModal(): void {
    if (!this.canEdit) return;
    this.rejectNote = '';
    this.modalError = '';
    this.isRejectOpen = true;
  }

  closeRejectModal(): void {
    if (this.isModerating) return;
    this.isRejectOpen = false;
  }

  submitReject(): void {
    if (!this.detail || this.isModerating) return;

    const note = this.rejectNote.trim();
    if (note.length < 5) {
      this.modalError = 'Vui lòng nhập lý do từ chối (tối thiểu 5 ký tự).';
      return;
    }

    this.runModeration('reject', note);
  }

  private runModeration(decision: 'approve' | 'reject', note: string): void {
    if (!this.detail) return;
    const reviewId = this.detail.Review_id;

    this.isModerating = true;
    this.modalError = '';

    this.reviewService
      .moderate(reviewId, decision, note)
      .pipe(
        finalize(() => {
          this.isModerating = false;
          this.changeDetectorRef.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          this.isRejectOpen = false;
          this.showToast(response.message || 'Đã cập nhật đánh giá', 'success');
          this.refreshDetail(reviewId);
          this.loadReviews(true);
        },
        error: (error: unknown) => {
          this.handleActionError(error, reviewId);
        },
      });
  }

  // ===== Soạn phản hồi =====

  suggestReply(): void {
    if (!this.detail || !this.isApproved || this.isSuggesting) return;
    const reviewId = this.detail.Review_id;

    this.isSuggesting = true;
    this.replyError = '';

    this.reviewService
      .suggestReply(reviewId)
      .pipe(
        finalize(() => {
          this.isSuggesting = false;
          this.changeDetectorRef.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          // Gợi ý mới thay vào ô soạn, Staff phải rà soát và lưu lại trước khi gửi
          this.draftText = response.data?.AI_reply_draft ?? this.draftText;
          this.isEditing = true;
          this.showToast(response.message || 'Đã tạo gợi ý phản hồi', 'success');
          this.refreshDetail(reviewId, true);
        },
        error: (error: unknown) => {
          const message = this.getErrorMessage(error, 'Không tạo được gợi ý. Vui lòng thử lại.');
          this.replyError = message;
          this.showToast(message, 'error');
        },
      });
  }

  saveDraft(): void {
    if (!this.detail || !this.canSaveDraft) return;
    const reviewId = this.detail.Review_id;
    const content = this.draftTrimmed;

    if (content.length < REPLY_MIN_LENGTH) {
      this.replyError = `Nội dung phản hồi quá ngắn (tối thiểu ${REPLY_MIN_LENGTH} ký tự).`;
      return;
    }

    this.isSaving = true;
    this.replyError = '';

    this.reviewService
      .saveDraft(reviewId, content)
      .pipe(
        finalize(() => {
          this.isSaving = false;
          this.changeDetectorRef.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          this.showToast(response.message || 'Đã lưu và rà soát phản hồi', 'success');
          this.refreshDetail(reviewId);
          this.loadReviews(true);
        },
        error: (error: unknown) => {
          this.handleActionError(error, reviewId, true);
        },
      });
  }

  openSendConfirm(): void {
    if (!this.canSend) return;
    this.modalError = '';
    this.isSendConfirmOpen = true;
  }

  closeSendConfirm(): void {
    if (this.isSending) return;
    this.isSendConfirmOpen = false;
  }

  confirmSend(): void {
    if (!this.detail || !this.canSend) return;
    const reviewId = this.detail.Review_id;

    this.isSending = true;
    this.modalError = '';

    this.reviewService
      .sendReply(reviewId, this.detail.Reply_draft_version)
      .pipe(
        finalize(() => {
          this.isSending = false;
          this.changeDetectorRef.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          this.isSendConfirmOpen = false;
          this.showToast(response.message || 'Đã gửi phản hồi cho khách hàng', 'success');
          this.refreshDetail(reviewId);
          this.loadReviews(true);
        },
        error: (error: unknown) => {
          // Không xác nhận thành công, giữ nguyên nội dung để Staff gửi lại (UC-18, 4b)
          this.isSendConfirmOpen = false;
          this.handleActionError(error, reviewId, true);
        },
      });
  }

  private handleActionError(error: unknown, reviewId: string, showInReplyBox = false): void {
    const message = this.getErrorMessage(error, 'Thao tác thất bại. Vui lòng kiểm tra kết nối và thử lại.');
    if (showInReplyBox) {
      this.replyError = message;
    } else {
      this.modalError = message;
    }
    this.showToast(message, 'error');

    // Đánh giá đã bị người khác cập nhật: tải lại dữ liệu mới nhất
    if (this.getErrorStatus(error) === 409) {
      this.isRejectOpen = false;
      this.refreshDetail(reviewId);
      this.loadReviews(true);
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isSendConfirmOpen) {
      this.closeSendConfirm();
      return;
    }

    if (this.isRejectOpen) {
      this.closeRejectModal();
      return;
    }

    if (this.isDetailOpen) {
      this.closeDetail();
    }
  }

  // ===== Hiển thị =====

  getStatusLabel(status: ReviewDisplayStatus | undefined): string {
    return status ? STATUS_LABELS[status] ?? status : '';
  }

  // Dòng chữ nhỏ dưới trạng thái trong bảng
  getRowNote(review: AdminReviewSummary): string {
    switch (review.Display_status) {
      case 'replied':
        return review.Replied_at ? `Đã gửi · ${this.formatShortDate(review.Replied_at)}` : 'Đã gửi';
      case 'rejected':
        return 'Không phản hồi';
      case 'approved':
        return review.Has_draft ? 'Bản nháp · Chưa gửi' : 'Chưa có phản hồi';
      default:
        return 'Chưa có phản hồi';
    }
  }

  // Trạng thái phản hồi trong drawer
  get replyStatusLabel(): string {
    const detail = this.detail;
    if (!detail) return '';

    switch (detail.Display_status) {
      case 'replied':
        return 'Đã gửi cho khách';
      case 'rejected':
        return 'Không phản hồi';
      case 'pending':
        return 'Chờ kiểm duyệt đánh giá';
      default:
        return detail.Reply_reviewed ? 'Đã rà soát · Chưa gửi' : 'Chưa rà soát · Chưa gửi';
    }
  }

  get replyStatusClass(): string {
    const detail = this.detail;
    if (!detail) return '';
    if (detail.Display_status === 'replied') return 'replied';
    if (detail.Display_status === 'rejected') return 'rejected';
    if (detail.Display_status === 'pending') return 'pending';
    return detail.Reply_reviewed ? 'approved' : 'pending';
  }

  get replyStatusNote(): string {
    const detail = this.detail;
    if (!detail) return '';

    switch (detail.Display_status) {
      case 'replied':
        return `${detail.Replied_by_name || 'Staff'} gửi lúc ${this.formatDateTime(detail.Replied_at)}`;
      case 'rejected':
        return detail.Moderation_note ? `Lý do từ chối: ${detail.Moderation_note}` : 'Đánh giá đã bị từ chối';
      case 'pending':
        return 'Duyệt đánh giá để bắt đầu phản hồi cho khách hàng';
      default:
        if (detail.Reply_reviewed) {
          return `Phiên bản v${detail.Reply_draft_version} · ${detail.Reply_draft_by_name || 'Staff'} chỉnh sửa và rà soát lúc ${this.formatDateTime(detail.Reply_draft_at)} · Chưa gửi`;
        }
        return detail.AI_reply_draft
          ? 'Gợi ý AI · Chưa Staff rà soát hoặc chỉnh sửa · Chưa gửi cho khách hàng'
          : 'Chưa có phản hồi · Staff soạn nội dung hoặc tạo gợi ý AI';
    }
  }

  isVideo(source: string): boolean {
    return /^data:video\//i.test(source) || /\.(mp4|webm|mov)(\?|$)/i.test(source);
  }

  formatDateTime(value: string | null | undefined): string {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    const pad = (number: number) => String(number).padStart(2, '0');
    return `${pad(date.getHours())}:${pad(date.getMinutes())}, ${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
  }

  formatShortDate(value: string | null | undefined): string {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    const pad = (number: number) => String(number).padStart(2, '0');
    return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}`;
  }

  hideBrokenImage(event: Event): void {
    const img = event.target as HTMLImageElement;
    img.onerror = null;
    img.src =
      'data:image/svg+xml;utf8,' +
      encodeURIComponent(
        '<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48"><rect width="48" height="48" rx="8" fill="#E2E8F0"/></svg>',
      );
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    clearTimeout(this.toastTimer);
    this.toastMessage = message;
    this.toastType = type;
    this.toastTimer = setTimeout(() => {
      this.toastMessage = '';
      this.changeDetectorRef.detectChanges();
    }, 3000);
  }

  private getErrorStatus(error: unknown): number | undefined {
    return typeof error === 'object' && error !== null && 'status' in error && typeof error.status === 'number'
      ? error.status
      : undefined;
  }

  private getErrorMessage(error: unknown, fallback: string): string {
    return typeof error === 'object' && error !== null &&
      'error' in error && typeof error.error === 'object' &&
      error.error !== null && 'message' in error.error &&
      typeof error.error.message === 'string'
      ? error.error.message
      : fallback;
  }
}
