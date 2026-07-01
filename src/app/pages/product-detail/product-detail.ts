import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../services/product';
import { CartService } from '../../services/cart';
import { CartStateService } from '../../services/cart-state.service';
import { ReviewService } from '../../services/review';
import { CompareService, CompareItem } from '../../services/compare';
import { NotificationService } from '../../components/notification/notification.service';
import { Subscription } from 'rxjs'
import Swal from 'sweetalert2';

const REVIEW_PRODUCT_STORAGE_KEY = 'vista_product_reviews_cache';

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './product-detail.html',
  styleUrl: './product-detail.scss'
})
export class ProductDetail implements OnInit {
  product: any = null;
  variants: any[] = [];
  category: any = null;
  brand: any = null;
  relatedProducts: any[] = [];
  visibleReviewsCount = 5; // Mặc định chỉ hiện 5 đánh giá
  selectedVariant: any = null;
  selectedImageIndex = 0;
  quantity = 1;
  activeTab = 'description';
  allReviews: any[] = [];
  mockReviews: any[] = [];
  persistedReviews: any[] = [];
  reviewMediaFilterActive = false;
  reviewCommentFilterActive = false;
  reviewSortDirection: 'none' | 'asc' | 'desc' = 'none';
  private readonly defaultMockReviewFallback = 67;
  private readonly defaultReviewComments = [
    "Sản phẩm quá xịn, đóng gói cẩn thận. Giao hàng nhanh!",
    "Dùng ngon, mượt mà. Rất đáng tiền.",
    "Chất lượng tuyệt vời, đúng như mô tả.",
    "Nhân viên hỗ trợ nhiệt tình, 10 điểm không có nhưng.",
    "Tạm ổn trong tầm giá, mua lúc sale nên thấy khá hời."
  ];
  
  private compareSubscription?: Subscription;
  
  reviews: any[] = []; // <-- Đã thêm mảng chứa đánh giá

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private cartState: CartStateService,
    private reviewService: ReviewService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef,
    private compareService: CompareService,
    private notificationService: NotificationService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.loadProduct(params['id']);
      window.scrollTo(0, 0);
    });

    // Lắng nghe thay đổi danh sách so sánh để cập nhật nút
    this.compareSubscription = this.compareService.items$.subscribe(() => {
    // Chỉ cần trigger detectChanges để cập nhật trạng thái nút
    this.cdr.detectChanges();
    });
  }

  ngOnDestroy(): void {
  this.compareSubscription?.unsubscribe();
  }

  loadProduct(id: string) {
    this.productService.getProductById(id).subscribe({
      next: (res) => {
        this.product = res.data;
        this.variants = res.data.variants || [];
        this.category = res.data.category;
        this.brand = res.data.brand;
        if (this.variants.length > 0) {
          this.selectedVariant = this.variants[0];
        }
        this.selectedImageIndex = 0;
        
        // <-- GỌI HÀM SINH ĐÁNH GIÁ Ở ĐÂY
        const productId = this.product?.Product_id || id;
        const cachedReviews = this.getCachedProductReviews(
          productId,
          this.variants.map((variant) => variant?.Product_variant_id).filter(Boolean)
        );
        const persistedReviews = this.mergeReviewItems(this.normalizePersistedReviews([
          ...cachedReviews,
          ...(res.data?.Reviews || res.data?.reviews || res.data?.Real_reviews || []),
        ]));
        const reviewSummary = res.data?.Review_summary || {};
        const mockReviewCount = this.resolveMockReviewCount(
          productId,
          Number(this.product.Total_reviews || 0),
          persistedReviews.length,
          reviewSummary
        );

        this.persistedReviews = persistedReviews;
        this.mockReviews = this.generateMockReviews(mockReviewCount, this.product.Average_rating)
          .map((review, index) => this.normalizeLegacyMockReview(review, index));
        this.rebuildReviewList();
        this.loadReviewsFromReviewApi(productId, reviewSummary);
        
        this.cdr.detectChanges();
        this.loadRelated(id);
      },
      error: (err) => console.error(err)
    });
  }

  loadRelated(id: string) {
    this.productService.getRelatedProducts(id).subscribe({
      next: (res) => {
        this.relatedProducts = res.data;
        this.cdr.detectChanges();
      }
    });
  }

  selectVariant(variant: any) {
    this.selectedVariant = variant;
    this.cdr.detectChanges();
  }

  changeQuantity(delta: number) {
    const nextQuantity = Math.max(1, this.quantity + delta);
    const maxStock = Number(this.selectedVariant?.Stock_quantity || 0);

    if (maxStock > 0 && nextQuantity > maxStock) {
      return;
    }

    this.quantity = nextQuantity;
  }

  addToCart() {
    const userId = this.cartService.getCurrentUserId();
    if (!userId) {
      Swal.fire({
        icon: 'warning',
        title: 'Vui lòng đăng nhập',
        text: 'Bạn cần đăng nhập để thêm sản phẩm vào giỏ hàng.',
        confirmButtonColor: '#2563B0'
      });
      return;
    }

    const variantId = this.selectedVariant?.Product_variant_id || this.variants[0]?.Product_variant_id;
    if (!variantId) {
      Swal.fire({
        icon: 'warning',
        title: 'Chưa chọn phiên bản',
        text: 'Vui lòng chọn một phiên bản sản phẩm trước khi thêm vào giỏ hàng.',
        confirmButtonColor: '#2563B0'
      });
      return;
    }

    this.cartService.addToCart(userId, variantId, this.quantity).subscribe({
      next: (res) => {
        const totalProducts = res.data?.cart?.Total_product ?? this.cartState.getTotalQuantity(res.data?.items || []);
        this.cartState.setCount(totalProducts);

        Swal.fire({
          icon: 'success',
          title: 'Đã thêm vào giỏ hàng',
          text: 'Sản phẩm đã được cập nhật vào giỏ hàng của bạn.',
          confirmButtonColor: '#2563B0'
        });
      },
      error: (err) => {
        Swal.fire({
          icon: 'error',
          title: 'Không thể thêm vào giỏ hàng',
          text: err.error?.message || 'Vui lòng thử lại sau.',
          confirmButtonColor: '#2563B0'
        });
      }
    });
  }

  buyNow(): void {
    const userId = this.cartService.getCurrentUserId();
    if (!userId) {
      Swal.fire({
        icon: 'warning',
        title: 'Vui lòng đăng nhập',
        text: 'Bạn cần đăng nhập để đặt mua sản phẩm.',
        confirmButtonColor: '#2563B0'
      });
      return;
    }

    const variant = this.selectedVariant || this.variants[0];
    if (!variant?.Product_variant_id) {
      Swal.fire({
        icon: 'warning',
        title: 'Chưa chọn phiên bản',
        text: 'Vui lòng chọn một phiên bản sản phẩm trước khi mua.',
        confirmButtonColor: '#2563B0'
      });
      return;
    }

    const checkoutItem = {
      cartItemId: '',
      productVariantId: variant.Product_variant_id,
      productId: this.product?.Product_id || null,
      name: this.product?.Product_name || 'Sản phẩm VISTA',
      variantName: variant.Variant_name || '',
      specs: variant.Variant_name || '',
      image: this.product?.Images?.[0] || '',
      price: this.getFinalPrice(Number(variant.Price) || 0, Number(this.product?.Discount) || 0),
      originalPrice: Number(variant.Price) || 0,
      discountPercent: Number(this.product?.Discount) || 0,
      quantity: this.quantity,
      stock: Number(variant.Stock_quantity) || 0,
      categoryId: this.category?.Category_id || this.product?.Category_id || '',
      categoryName: this.category?.Category_name || '',
      categorySlug: this.category?.Category_slug || '',
      checkoutSource: 'buy_now',
      variantOptions: this.variants.map((item) => ({
        productVariantId: item.Product_variant_id,
        variantName: item.Variant_name,
        price: this.getFinalPrice(Number(item.Price) || 0, Number(this.product?.Discount) || 0),
        originalPrice: Number(item.Price) || 0,
        discountPercent: Number(this.product?.Discount) || 0,
        stock: Number(item.Stock_quantity) || 0,
      })),
    };

    sessionStorage.setItem('vista_checkout_items', JSON.stringify([checkoutItem]));
    sessionStorage.setItem('vista_checkout_source', JSON.stringify({
      type: 'buy_now',
      categoryId: checkoutItem.categoryId,
      categoryName: checkoutItem.categoryName,
      categorySlug: checkoutItem.categorySlug,
    }));
    this.router.navigate(['/order']);
  }

  // ===== PHƯƠNG THỨC XỬ LÝ SO SÁNH =====

/** Kiểm tra xem variant hiện tại đã có trong danh sách so sánh chưa */
isInCompare(): boolean {
  if (!this.selectedVariant) return false;
  return this.compareService.isInCompare(this.selectedVariant.Product_variant_id);
}

/** Kiểm tra danh sách so sánh đã đầy chưa */
isCompareFull(): boolean {
  return this.compareService.isFull();
}

/** Thêm sản phẩm hiện tại vào danh sách so sánh */
addToCompare(): void {
  // --- KIỂM TRA ĐÃ CHỌN BIẾN THỂ CHƯA ---
  if (!this.selectedVariant) {
    this.notificationService.error('Vui lòng chọn một phiên bản sản phẩm trước khi thêm vào so sánh.');
    return;
  }

    // --- KIỂM TRA DANH SÁCH ĐÃ ĐẦY CHƯA ---
  if (this.isCompareFull()) {

    this.compareService.openWidget();
    
    Swal.fire({
        icon: 'warning',
        title: 'Danh sách đã đầy',
        text: 'Vui lòng xoá bớt sản phẩm để tiếp tục so sánh.',
        confirmButtonColor: '#2563B0'
      });
      return;
    }

  // --- LOGIC KIỂM TRA CÙNG LOẠI SẢN PHẨM ---
  const currentItems = this.compareService.getCurrentItems();
  // ----------------------------------------------------

  const variant = this.selectedVariant;
  const product = this.product;
  const compareItem = this.buildCompareItem(product, variant);

  const result = this.compareService.addItem(compareItem);

  if (result.success) {
    this.notificationService.success('Đã thêm sản phẩm vào danh sách so sánh.');

  } else if (result.needConfirm) {
    // Lấy loại sản phẩm của item hiện tại và item mới
    const currentType = currentItems[0]?.productType || '';
    const newType = this.getNormalizedType(this.product);

    // Dùng tên sản phẩm nếu type không xác định được
    const currentLabel = (currentType && currentType !== 'Khác')
      ? currentType
      : currentItems[0]?.productName || currentItems[0]?.categoryName || '';
    const newLabel = (newType && newType !== 'Khác')
      ? newType
      : this.product?.Product_name || this.category?.Category_name || '';

    Swal.fire({
      title: 'Thay danh sách so sánh?',
      html: `
        Bạn đang so sánh <strong>${currentLabel}</strong>.
        Thêm sản phẩm này sẽ xóa danh sách cũ và bắt đầu so sánh <strong>${newLabel}</strong>.
      `,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#2563B0',
      cancelButtonColor: '#94A3B8',
      confirmButtonText: 'Xóa và thêm mới',
      cancelButtonText: 'Hủy'
    }).then((swalResult) => {
      if (swalResult.isConfirmed) {
        this.compareService.addItemAfterClear(compareItem);
        this.notificationService.success('Đã thêm sản phẩm vào danh sách so sánh.');
      }
    });
  } else {
    this.notificationService.error(result.message || 'Không thể thêm sản phẩm vào so sánh.');
  }
}

  // Hàm buildCompareItem để tránh lặp code
  private buildCompareItem(product: any, variant: any): CompareItem {
    const productType = this.getNormalizedType(product);
    return {
      productId: product.Product_id,
      variantId: variant.Product_variant_id,
      productName: product.Product_name,
      thumbnail: product.Images?.[0] || '',
      price: this.getFinalPrice(Number(variant.Price), Number(product.Discount)),
      categoryId: product.Category_id,
      categoryName: this.category?.Category_name || '',
      brandName: this.brand?.Brand_name || '',
      productType: this.getNormalizedType(product)
    };
  }

  setTab(tab: string) {
    this.activeTab = tab;
    this.cdr.detectChanges();
  }

  loadReviewsFromReviewApi(productId: string, reviewSummary: any = {}): void {
    if (!productId) {
      return;
    }

    this.reviewService.getReviewsByProductId(productId).subscribe({
      next: (res) => {
        const apiReviews = Array.isArray(res?.data) ? res.data : [];
        if (!apiReviews.length) {
          return;
        }

        const variantIds = this.variants
          .map((variant) => variant?.Product_variant_id)
          .filter(Boolean);
        const cachedReviews = this.getCachedProductReviews(productId, variantIds);
        const persistedReviews = this.mergeReviewItems(this.normalizePersistedReviews([
          ...apiReviews,
          ...cachedReviews,
        ]));
        const mockReviewCount = this.resolveMockReviewCount(
          productId,
          Number(this.product?.Total_reviews || 0),
          persistedReviews.length,
          reviewSummary || this.product?.Review_summary || {}
        );

        this.persistedReviews = persistedReviews;
        this.mockReviews = this.generateMockReviews(mockReviewCount, this.product?.Average_rating)
          .map((review, index) => this.normalizeLegacyMockReview(review, index));
        this.rebuildReviewList();
        this.cdr.detectChanges();
      },
      error: () => {
        // Product detail van hien review co san neu API review rieng chua duoc gan route.
      },
    });
  }

  toggleReviewMediaFilter(): void {
    this.reviewMediaFilterActive = !this.reviewMediaFilterActive;
    this.visibleReviewsCount = 5;
    this.rebuildReviewList();
  }

  toggleReviewCommentFilter(): void {
    this.reviewCommentFilterActive = !this.reviewCommentFilterActive;
    this.visibleReviewsCount = 5;
    this.rebuildReviewList();
  }

  toggleReviewSortDirection(): void {
    this.reviewSortDirection = this.reviewSortDirection === 'desc' ? 'asc' : 'desc';
    this.visibleReviewsCount = 5;
    this.rebuildReviewList();
  }

  clearReviewFilters(): void {
    this.reviewMediaFilterActive = false;
    this.reviewCommentFilterActive = false;
    this.reviewSortDirection = 'none';
    this.visibleReviewsCount = 5;
    this.rebuildReviewList();
  }

  getReviewSortLabel(): string {
    if (this.reviewSortDirection === 'asc') {
      return 'Sao tăng dần';
    }

    if (this.reviewSortDirection === 'desc') {
      return 'Sao giảm dần';
    }

    return 'Sắp xếp sao';
  }

  hasActiveReviewFilters(): boolean {
    return this.reviewMediaFilterActive || this.reviewCommentFilterActive || this.reviewSortDirection !== 'none';
  }

  getReviewTotalCount(): number {
    return this.allReviews.length;
  }

  getDisplayAverageRating(): string {
    const value = Number(this.product?.Average_rating || 0);
    return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
  }

  getReviewImages(review: any): string[] {
    return Array.isArray(review?.mediaItems)
      ? review.mediaItems
      : this.buildReviewMediaItems(review?.images ?? review?.Images ?? review?.media ?? review?.attachments);
  }

  getReviewMediaSource(media: any): string {
    if (typeof media === 'string') {
      const raw = media.trim();
      if (raw.startsWith('{') || raw.startsWith('[')) {
        try {
          const parsed = JSON.parse(raw);
          return this.getReviewMediaSource(Array.isArray(parsed) ? parsed[0] : parsed);
        } catch {
          return this.normalizeReviewMediaUrl(raw, {});
        }
      }

      return this.normalizeReviewMediaUrl(raw, {});
    }

    if (!media || typeof media !== 'object') {
      return '';
    }

    const directValue = media.url
      || media.src
      || media.preview
      || media.dataUrl
      || media.dataURL
      || media.fileUrl
      || media.file_url
      || media.filePath
      || media.file_path
      || media.path
      || media.Location
      || media.location
      || media.secure_url
      || media.Image_url
      || media.imageUrl
      || media.Video_url
      || media.videoUrl
      || media.Attachment_url
      || media.attachmentUrl
      || media.Media_url
      || media.mediaUrl
      || media.File_url
      || media.File_path
      || media.base64
      || media.Base64
      || media.content
      || media.Content;

    if (directValue) {
      return this.normalizeReviewMediaUrl(directValue, media);
    }

    const nestedValue = media.file || media.File || media.image || media.Image || media.video || media.Video || media.media || media.Media || media.attachment || media.Attachment || media.data || media.Data;
    return nestedValue && nestedValue !== media ? this.getReviewMediaSource(nestedValue) : '';
  }

  isReviewMediaImage(media: any): boolean {
    const value = this.getReviewMediaSource(media);
    const type = typeof media === 'object' ? String(media?.type || media?.mediaType || '').toLowerCase() : '';
    return type === 'image' || type.startsWith('image/')
      || value.startsWith('data:image/')
      || /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(value)
      || (!!value && !this.isReviewMediaVideo(media));
  }

  isReviewMediaVideo(media: any): boolean {
    const value = this.getReviewMediaSource(media);
    const type = typeof media === 'object' ? String(media?.type || media?.mediaType || '').toLowerCase() : '';
    return type === 'video' || type.startsWith('video/') || value.startsWith('data:video/') || /\.(mp4|webm|mov|avi|mkv)$/i.test(value);
  }

  trackByReview(index: number, review: any): string {
    return String(review?.id || review?.Review_id || index);
  }

  trackByReviewMedia(index: number, media: string): string {
    return `${index}-${String(media || '').slice(0, 80)}`;
  }

  getReviewMediaName(media: string, index: number): string {
    const source = String(media || '').trim();
    const fileName = source.split('/').pop()?.split('?')[0] || '';
    return fileName || `Tệp ${index + 1}`;
  }

  getReviewMediaTypeLabel(media: string): string {
    if (this.isReviewMediaVideo(media)) {
      return 'video';
    }

    return 'image/jpeg';
  }

  formatPrice(price: number): string {
    return price ? price.toLocaleString('vi-VN') + ' ₫' : 'Liên hệ';
  }

  getFinalPrice(price: number, discount: number): number {
    if (!discount || discount === 0) return price;
    return price - (price * discount / 100);
  }

  getStarFill(index: number): number {
    const rating = Number(this.product?.Average_rating || 0);
    const fill = Math.max(0, Math.min(1, rating - (index - 1)));
    return fill * 100;
  }

  getSpecEntries(): {key: string, value: string}[] {
    if (!this.product?.Technical_specs) return [];
    const exclude = ['Usage_Type', 'User_Segment', 'Performance_Level', 'Portability', 'Gaming_Support', 'AI_Tag'];
    return Object.entries(this.product.Technical_specs)
      .filter(([key]) => !exclude.includes(key))
      .map(([key, value]) => ({ key, value: String(value) }));
  }

  // <-- THUẬT TOÁN ĐÃ ĐƯỢC TÍCH HỢP
  generateMockReviews(totalReviews: number, averageRating: number): any[] {
    this.visibleReviewsCount = 5; // Reset về 5 khi đổi sang sản phẩm khác
    if (!totalReviews || totalReviews <= 0) {
      return [];
    }

    let totalStarsNeeded = Math.round(totalReviews * averageRating);
    let ratings = new Array(totalReviews).fill(1);
    let remainingStars = totalStarsNeeded - totalReviews;

    for (let i = 0; i < ratings.length && remainingStars > 0; i++) {
      let add = Math.min(4, remainingStars);
      ratings[i] += add;
      remainingStars -= add;
    }

    for (let i = ratings.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [ratings[i], ratings[j]] = [ratings[j], ratings[i]];
    }

    const hoList = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô'];
    const lotList = ['Văn', 'Thị', 'Minh', 'Ngọc', 'Hải', 'Tuấn', 'Thanh', 'Đức', 'Thu', 'Hoàng', 'Gia', 'Bảo'];

    const sampleComments = this.defaultReviewComments;

    return ratings.map((rating, index) => {
      const randomDay = Math.floor(Math.random() * 11) + 1; 

      const randomHo = hoList[Math.floor(Math.random() * hoList.length)];
      const randomLot = lotList[Math.floor(Math.random() * lotList.length)];
      const maskedName = `${randomHo} ${randomLot} ***`; // Kết quả: "Trần Minh ***"

      return {
        user: maskedName, // Gán tên đã che vào đây
        rating: rating,
        comment: sampleComments[index % sampleComments.length],
        date: `${randomDay < 10 ? '0'+randomDay : randomDay}/06/2026`
      };
    });
  }

  private rebuildReviewList(): void {
    const normalizedPersistedReviews = this.persistedReviews
      .map((review, index) => this.ensureDisplayReview(review, index));
    const normalizedMockReviews = this.mockReviews
      .map((review, index) => this.ensureDisplayReview(review, normalizedPersistedReviews.length + index));
    const persistedWithContent = normalizedPersistedReviews.filter((review) => this.hasReviewVisibleContent(review));
    const persistedStarOnly = normalizedPersistedReviews.filter((review) => !this.hasReviewVisibleContent(review));
    const mergedReviews = [
      ...persistedWithContent,
      ...normalizedMockReviews,
      ...persistedStarOnly,
    ];

    this.allReviews = mergedReviews;

    if (this.product) {
      this.product.Total_reviews = mergedReviews.length;
      this.product.Average_rating = this.calculateAverageRating(mergedReviews);
    }

    let filteredReviews = [...mergedReviews];

    if (this.reviewMediaFilterActive) {
      filteredReviews = filteredReviews.filter((review) => this.getReviewImages(review).length > 0);
    }

    if (this.reviewCommentFilterActive) {
      filteredReviews = filteredReviews.filter((review) => String(review?.comment || '').trim().length > 0);
    }

    if (this.reviewSortDirection === 'asc' || this.reviewSortDirection === 'desc') {
      const direction = this.reviewSortDirection === 'asc' ? 1 : -1;
      filteredReviews.sort((a, b) => {
        const ratingDiff = (Number(a.rating || 0) - Number(b.rating || 0)) * direction;
        if (ratingDiff !== 0) {
          return ratingDiff;
        }

        return Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0);
      });
    }

    this.reviews = filteredReviews;
  }

  private calculateAverageRating(reviews: any[]): number {
    if (!reviews.length) {
      return 0;
    }

    const total = reviews.reduce((sum, review) => sum + Number(review?.rating || 0), 0);
    return Number((total / reviews.length).toFixed(1));
  }

  private normalizePersistedReviews(reviews: any[]): any[] {
    return (Array.isArray(reviews) ? reviews : [])
      .map((review: any, index: number) => {
        const createdAt = review.Created_at || review.createdAt || review.date || '';
        const mediaItems = this.buildReviewMediaItems(review.Images ?? review.images ?? review.media ?? review.attachments);
        const reviewerName = this.resolvePersistedReviewerName(review.User_name || review.user || review.Customer_name);

        return {
          id: String(review.Review_id || review.id || `review-${index}`),
          user: this.maskReviewerName(reviewerName || `Khách hàng ${index + 1}`),
          rating: Math.max(1, Math.min(5, Number(review.Rating || review.rating || 5) || 5)),
          comment: String(review.Comment || review.comment || '').trim(),
          date: this.formatReviewDate(createdAt),
          createdAtMs: this.getReviewTime(createdAt),
          images: mediaItems,
          mediaItems,
          isPersisted: true,
        };
      })
      .sort((a, b) => Number(b.createdAtMs || 0) - Number(a.createdAtMs || 0));
  }

  private normalizeLegacyMockReview(review: any, index: number): any {
    return {
      id: `mock-${this.product?.Product_id || 'product'}-${index}`,
      user: String(review?.user || 'Khách hàng VISTA').trim(),
      rating: Math.max(1, Math.min(5, Number(review?.rating || 5) || 5)),
      comment: String(review?.comment || (index < this.defaultReviewComments.length ? this.defaultReviewComments[index] : '')).trim(),
      date: String(review?.date || '').trim(),
      createdAtMs: this.parseReviewDateToMs(String(review?.date || '')),
      images: [],
      mediaItems: [],
      isPersisted: false,
    };
  }

  private ensureDisplayReview(review: any, index: number): any {
    const mediaItems = Array.isArray(review?.mediaItems)
      ? review.mediaItems
      : this.buildReviewMediaItems(review?.images ?? review?.Images ?? review?.media ?? review?.attachments);

    return {
      ...review,
      id: String(review?.id || review?.Review_id || `review-${index}`),
      user: String(review?.user || review?.User_name || `Khách hàng ${index + 1} ***`).trim(),
      rating: Math.max(1, Math.min(5, Number(review?.rating || review?.Rating || 5) || 5)),
      comment: String(review?.comment || review?.Comment || '').trim(),
      date: String(review?.date || review?.Created_at || new Date().toLocaleDateString('vi-VN')).trim(),
      images: mediaItems,
      mediaItems,
      createdAtMs: Number(review?.createdAtMs || 0),
    };
  }

  private hasReviewVisibleContent(review: any): boolean {
    return String(review?.comment || review?.Comment || '').trim().length > 0
      || (Array.isArray(review?.mediaItems) && review.mediaItems.length > 0)
      || (Array.isArray(review?.images) && review.images.length > 0);
  }

  private buildReviewMediaItems(value: any): string[] {
    return this.normalizeReviewImages(value)
      .map((media) => {
        const source = this.getReviewMediaSource(media);
        return source || null;
      })
      .filter(Boolean) as string[];
  }

  private normalizeReviewImages(value: any): any[] {
    if (Array.isArray(value)) {
      return value.flatMap((item) => this.normalizeReviewImages(item));
    }

    if (!value) {
      return [];
    }

    if (typeof value === 'object') {
      const nested = value.Images ?? value.images ?? value.files ?? value.Files ?? value.attachments ?? value.Attachments ?? value.mediaList ?? value.MediaList;
      if (nested && nested !== value) {
        const nestedItems = this.normalizeReviewImages(nested);
        if (nestedItems.length) {
          return nestedItems;
        }
      }

      return [value];
    }

    const raw = String(value || '').trim();
    if (!raw) {
      return [];
    }

    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.flatMap((item) => this.normalizeReviewImages(item));
      }
      if (parsed && typeof parsed === 'object') {
        return [parsed];
      }
    } catch {
      return [raw];
    }

    return [raw];
  }

  private getCachedProductReviews(productId: string, variantIds: string[]): any[] {
    if (typeof localStorage === 'undefined') {
      return [];
    }

    try {
      const raw = localStorage.getItem(REVIEW_PRODUCT_STORAGE_KEY);
      const reviews = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(reviews)) {
        return [];
      }

      const productKey = String(productId || '').trim();
      const variantKeySet = new Set((variantIds || []).map((item) => String(item || '').trim()).filter(Boolean));

      return reviews.filter((review) => {
        const reviewProductId = String(review?.Product_id || review?.productId || '').trim();
        const reviewVariantId = String(review?.Product_variant_id || review?.productVariantId || '').trim();
        return (!!productKey && reviewProductId === productKey)
          || (!!reviewVariantId && variantKeySet.has(reviewVariantId));
      });
    } catch {
      return [];
    }
  }

  private mergeReviewItems(reviews: any[]): any[] {
    const seen = new Set<string>();
    const merged: any[] = [];

    reviews.forEach((review, index) => {
      const key = String(review?.id || review?.Review_id || review?.Order_detail_id || `review-${index}`).trim();
      if (seen.has(key)) {
        return;
      }

      seen.add(key);
      merged.push(review);
    });

    return merged;
  }

  private resolvePersistedReviewerName(value: any): string {
    const reviewerName = String(value || '').replace(/\s+/g, ' ').trim();
    const normalizedName = reviewerName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd');

    if (reviewerName && normalizedName !== 'khach hang vista' && normalizedName !== 'khach hang') {
      return reviewerName;
    }

    return this.getCurrentReviewerName();
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

  private maskReviewerName(value: string): string {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    if (!text) {
      return 'Khách hàng VISTA';
    }

    const parts = text.split(' ');
    if (parts.length === 1) {
      return `${parts[0]} ***`;
    }

    return `${parts.slice(0, 2).join(' ')} ***`;
  }

  private formatReviewDate(value: any): string {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toLocaleDateString('vi-VN');
    }

    return String(value || '').trim() || new Date().toLocaleDateString('vi-VN');
  }

  private getReviewTime(value: any): number {
    const directDate = new Date(value);
    if (!Number.isNaN(directDate.getTime())) {
      return directDate.getTime();
    }

    return this.parseReviewDateToMs(String(value || ''));
  }

  private parseReviewDateToMs(value: string): number {
    const match = String(value || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) {
      return 0;
    }

    const [, day, month, year] = match;
    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  private resolveMockReviewCount(productId: string, totalReviews: number, persistedCount: number, reviewSummary: any): number {
    const summaryMockCount = Number(reviewSummary?.mockReviewCount);
    if (Number.isFinite(summaryMockCount) && summaryMockCount > 0) {
      this.saveStoredMockReviewCount(productId, summaryMockCount);
      return summaryMockCount;
    }

    const inferredMockCount = Math.max(0, totalReviews - persistedCount);
    if (inferredMockCount > 0) {
      this.saveStoredMockReviewCount(productId, inferredMockCount);
      return inferredMockCount;
    }

    const storedMockCount = this.getStoredMockReviewCount(productId);
    if (storedMockCount > 0) {
      return persistedCount > 0
        ? Math.max(storedMockCount, this.defaultMockReviewFallback)
        : storedMockCount;
    }

    if (persistedCount > 0) {
      this.saveStoredMockReviewCount(productId, this.defaultMockReviewFallback);
      return this.defaultMockReviewFallback;
    }

    return 0;
  }

  private getStoredMockReviewCount(productId: string): number {
    if (typeof localStorage === 'undefined' || !productId) {
      return 0;
    }

    return Math.max(0, Number(localStorage.getItem(`vista_mock_review_count_${productId}`) || 0) || 0);
  }

  private saveStoredMockReviewCount(productId: string, count: number): void {
    if (typeof localStorage === 'undefined' || !productId || count <= 0) {
      return;
    }

    localStorage.setItem(`vista_mock_review_count_${productId}`, String(count));
  }

  private normalizeReviewMediaUrl(value: any, media: any): string {
    const raw = String(value || '').trim();
    if (!raw) {
      return '';
    }

    if (/^(data:|blob:|https?:\/\/|\/)/i.test(raw)) {
      return raw;
    }

    if (/^(assets\/|uploads\/|public\/|static\/)/i.test(raw)) {
      return `/${raw}`;
    }

    let type = String(media?.type || media?.mediaType || media?.mimeType || media?.mimetype || '').toLowerCase();
    if (type === 'image') {
      type = 'image/jpeg';
    }

    if (type === 'video') {
      type = 'video/mp4';
    }

    const looksLikeBase64 = raw.length > 120 && /^[A-Za-z0-9+/=\r\n]+$/.test(raw);
    if (looksLikeBase64 && (type.startsWith('image/') || type.startsWith('video/'))) {
      return `data:${type};base64,${raw.replace(/\s+/g, '')}`;
    }

    if (/\.(png|jpe?g|webp|gif|bmp|svg|mp4|webm|mov|avi|mkv)$/i.test(raw)) {
      return raw.includes('/') ? raw : `/assets/images/${raw}`;
    }

    return '';
  }
  // Thêm hàm chuẩn hoá
  getNormalizedType(product: any): string {
    const rawType = (product.Technical_specs?.['Type'] || '').trim();

    if (rawType) {
      const lowerRaw = rawType.toLowerCase();
      if (lowerRaw.includes('pin sạc') || lowerRaw.includes('sạc dự phòng') || lowerRaw.includes('power bank') || lowerRaw.includes('powerbank')) return 'Pin/Sạc';
      if (lowerRaw.includes('cổng chuyển đổi') || lowerRaw.includes('usb-c hub') || lowerRaw.includes('usb hub') || lowerRaw.includes('dock')) return 'Hub';
      if (lowerRaw.includes('tai nghe') || lowerRaw.includes('headphone') || lowerRaw.includes('earbud') || lowerRaw.includes('in-ear')) return 'Tai nghe';
      if (lowerRaw.includes('bàn phím') || lowerRaw.includes('keyboard')) return 'Bàn phím';
      if (lowerRaw.includes('tay cầm') || lowerRaw.includes('controller') || lowerRaw.includes('gamepad')) return 'Tay cầm game';
      if (lowerRaw.includes('màn hình') || lowerRaw.includes('monitor')) return 'Màn hình';
      if (lowerRaw.includes('chuột') || lowerRaw.includes('mouse')) return 'Chuột';
      if (lowerRaw.includes('micro') || lowerRaw.includes('microphone')) return 'Micro';
      if (lowerRaw.includes('loa') || lowerRaw.includes('speaker')) return 'Loa';
      if (lowerRaw.includes('dây cáp') || lowerRaw.includes('cáp') || lowerRaw.includes('cable')) return 'Cáp sạc';
      if (lowerRaw.includes('sạc') || lowerRaw.includes('charger') || lowerRaw.includes('adapter')) return 'Pin/Sạc';
      if (lowerRaw.includes('hub')) return 'Hub';
      if (lowerRaw.includes('pin')) return 'Pin/Sạc';
      return rawType;
    }

    // NHẬN DIỆN MỞ RỘNG THEO TÊN VÀ DANH MỤC
    const name = (product.Product_name || '').toLowerCase();
    const catId = product.Category_id || '';

    // Nhận diện thiết bị cốt lõi
    if (catId === 'CAT_001' || name.includes('laptop') || name.includes('macbook')) return 'Laptop';
    if (catId === 'CAT_002' || name.includes('điện thoại') || name.includes('iphone') || name.includes('smartphone') || name.includes('galaxy s')) return 'Điện thoại';
    if (catId === 'CAT_003' || name.includes('tablet') || name.includes('ipad') || name.includes('máy tính bảng')) return 'Máy tính bảng';

    // Nhận diện phụ kiện
    if (name.includes('tai nghe') || name.includes('headphone') || name.includes('earbud') || name.includes('wh-') || name.includes('wf-') || name.includes('buds') || name.includes('airpods')) return 'Tai nghe';
    if (name.includes('bàn phím') || name.includes('keyboard') || name.includes('mx keys')) return 'Bàn phím';
    if (name.includes('chuột') || name.includes('mouse') || name.includes('mx master')) return 'Chuột';
    if (name.includes('loa') || name.includes('speaker') || name.includes('srs') || name.includes('soundcore') || name.includes('jbl')) return 'Loa';
    if (name.includes('micro') || name.includes('mic')) return 'Micro';
    if (name.includes('tay cầm') || name.includes('controller') || name.includes('gamepad')) return 'Tay cầm game';
    if (name.includes('màn hình') || name.includes('monitor')) return 'Màn hình';
    if (name.includes('hub') || name.includes('dock')) return 'Hub';
    if (name.includes('cáp') || name.includes('cable')) return 'Cáp sạc';
    if (name.includes('sạc') || name.includes('adapter') || name.includes('powerbank') || name.includes('power bank')) return 'Pin/Sạc';

    return 'Khác';
  }
}
