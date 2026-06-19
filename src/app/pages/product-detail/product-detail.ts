import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute, Router } from '@angular/router';
import { ProductService } from '../../services/product';
import { CartService } from '../../services/cart';
import { CartStateService } from '../../services/cart-state.service';
import Swal from 'sweetalert2';

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
  
  
  reviews: any[] = []; // <-- Đã thêm mảng chứa đánh giá

  constructor(
    private productService: ProductService,
    private cartService: CartService,
    private cartState: CartStateService,
    private route: ActivatedRoute,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      this.loadProduct(params['id']);
      window.scrollTo(0, 0);
    });
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
        this.generateMockReviews(this.product.Total_reviews, this.product.Average_rating);
        
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
    this.router.navigate(['/order']);
  }

  setTab(tab: string) {
    this.activeTab = tab;
    this.cdr.detectChanges();
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
  generateMockReviews(totalReviews: number, averageRating: number) {
    this.visibleReviewsCount = 5; // Reset về 5 khi đổi sang sản phẩm khác
    if (!totalReviews || totalReviews <= 0) {
      this.reviews = [];
      return;
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

    const sampleComments = [
      "Sản phẩm quá xịn, đóng gói cẩn thận. Giao hàng nhanh!",
      "Dùng ngon, mượt mà. Rất đáng tiền.",
      "Chất lượng tuyệt vời, đúng như mô tả.",
      "Nhân viên hỗ trợ nhiệt tình, 10 điểm không có nhưng.",
      "Tạm ổn trong tầm giá, mua lúc sale nên thấy khá hời."
    ];

    const guaranteedCommentIndex = Math.floor(Math.random() * ratings.length);

    this.reviews = ratings.map((rating, index) => {
      const hasComment = (index === guaranteedCommentIndex) || (Math.random() > 0.7); 
      const randomDay = Math.floor(Math.random() * 11) + 1; 

      const randomHo = hoList[Math.floor(Math.random() * hoList.length)];
      const randomLot = lotList[Math.floor(Math.random() * lotList.length)];
      const maskedName = `${randomHo} ${randomLot} ***`; // Kết quả: "Trần Minh ***"

      return {
        user: maskedName, // Gán tên đã che vào đây
        rating: rating,
        comment: hasComment ? sampleComments[Math.floor(Math.random() * sampleComments.length)] : "",
        date: `${randomDay < 10 ? '0'+randomDay : randomDay}/06/2026`
      };
    });
  }
}
