import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { ProductService } from '../../services/product';

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
  defaultImage = 'https://placehold.co/600x400/2563b0/ffffff?text=VISTA+Product';
  
  reviews: any[] = []; // <-- Đã thêm mảng chứa đánh giá

  constructor(
    private productService: ProductService,
    private route: ActivatedRoute,
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
    this.quantity = Math.max(1, this.quantity + delta);
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