import { Component, OnInit, OnDestroy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import Swal from 'sweetalert2';
import { AuthService } from '../../services/auth';
import { CartService } from '../../services/cart';
import { CartStateService } from '../../services/cart-state.service';
import { GuestCartService } from '../../services/guest-cart.service';
import { WishlistService, WishlistProductCard, WishlistVariant } from '../../services/wishlist';

interface WishlistCard extends WishlistProductCard {
  addVariant: WishlistVariant | null;
  adding: boolean;
}

@Component({
  selector: 'app-wishlist',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './wishlist.html',
  styleUrl: './wishlist.scss',
})
export class Wishlist implements OnInit, OnDestroy {
  cards: WishlistCard[] = [];
  loading = true;
  loadError = false;
  isLoggedIn = false;

  private shownKey = '';
  private subscriptions = new Subscription();

  constructor(
    private wishlistService: WishlistService,
    private cartService: CartService,
    private cartState: CartStateService,
    private authService: AuthService,
    private guestCart: GuestCartService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.subscriptions.add(
      this.authService.currentUser$.subscribe((user) => {
        this.isLoggedIn = !!user;
        this.cdr.detectChanges();
      })
    );

    this.subscriptions.add(
      this.wishlistService.items$.subscribe((entries) => {
        const ids = entries.map((entry) => entry.productId);
        const key = ids.join(',');
        if (key === this.shownKey) {
          return;
        }
        this.load(ids);
      })
    );
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  retry(): void {
    this.shownKey = '';
    this.load(this.wishlistService.getEntries().map((entry) => entry.productId));
  }

  private load(ids: string[]): void {
    this.shownKey = ids.join(',');
    this.loadError = false;

    if (ids.length === 0) {
      this.cards = [];
      this.loading = false;
      this.cdr.detectChanges();
      return;
    }

    this.loading = true;
    this.cdr.detectChanges();

    this.wishlistService.lookup(ids).subscribe({
      next: (products) => {
        this.cards = products.map((product) => ({
          ...product,
          addVariant: this.pickVariant(product),
          adding: false,
        }));
        this.shownKey = this.cards.map((card) => card.Product_id).join(',');
        this.loading = false;
        this.cdr.detectChanges();

        const foundIds = new Set(products.map((product) => product.Product_id));
        ids.filter((id) => !foundIds.has(id)).forEach((id) => this.wishlistService.remove(id, true));
      },
      error: () => {
        this.cards = [];
        this.loading = false;
        this.loadError = true;
        this.cdr.detectChanges();
      },
    });
  }

  // Phiên bản còn hàng có giá thấp nhất
  private pickVariant(product: WishlistProductCard): WishlistVariant | null {
    const inStock = (product.Variants || [])
      .filter((variant) => Number(variant.Stock_quantity) > 0)
      .sort((a, b) => a.Price - b.Price);
    return inStock[0] || null;
  }

  canAddToCart(card: WishlistCard): boolean {
    return card.Status === 'on_sale' && !!card.addVariant;
  }

  statusLabel(card: WishlistCard): string {
    if (card.Status === 'discontinued') return 'Ngưng bán';
    if (card.Status === 'out_of_stock' || !card.addVariant) return 'Hết hàng';
    return '';
  }

  getFinalPrice(price: number, discount: number): number {
    if (!discount || discount <= 0) return price;
    return price - (price * discount) / 100;
  }

  formatPrice(price: number): string {
    return price ? price.toLocaleString('vi-VN') + ' ₫' : 'Liên hệ';
  }

  specLine(card: WishlistCard): string {
    const specs = card.Technical_specs || {};
    return specs.CPU || specs.Chipset || specs.Connection || specs.Type || specs.Sensor || '';
  }

  removeCard(card: WishlistCard): void {
    this.cards = this.cards.filter((item) => item.Product_id !== card.Product_id);
    this.shownKey = this.cards.map((item) => item.Product_id).join(',');
    this.wishlistService.remove(card.Product_id);
  }

  clearAll(): void {
    Swal.fire({
      icon: 'question',
      title: 'Xóa toàn bộ yêu thích?',
      text: 'Tất cả sản phẩm sẽ bị bỏ khỏi danh sách yêu thích của bạn.',
      showCancelButton: true,
      confirmButtonColor: '#2563B0',
      cancelButtonColor: '#94A3B8',
      confirmButtonText: 'Xóa tất cả',
      cancelButtonText: 'Hủy',
    }).then((result) => {
      if (!result.isConfirmed) {
        return;
      }
      this.wishlistService.clear();
      this.cards = [];
      this.shownKey = '';
      this.cdr.detectChanges();
    });
  }

  addToCart(card: WishlistCard): void {
    if (!this.canAddToCart(card) || card.adding) {
      return;
    }

    const userId = this.cartService.getCurrentUserId();
    if (!userId) {
      const result = this.guestCart.addProduct(
        {
          Product_id: card.Product_id,
          Product_name: card.Product_name,
          Images: card.Image ? [card.Image] : [],
          Discount: card.Discount,
          Status: card.Status,
        },
        card.addVariant,
        card.Variants,
        1
      );
      if (result.success) {
        this.cartState.setCount(this.guestCart.getTotalQuantity());
      }
      this.guestCart.showAddResult(result);
      return;
    }

    card.adding = true;
    this.cartService.addToCart(userId, card.addVariant!.Product_variant_id, 1).subscribe({
      next: (res) => {
        card.adding = false;
        const totalProducts =
          res.data?.cart?.Total_product ?? this.cartState.getTotalQuantity(res.data?.items || []);
        this.cartState.setCount(totalProducts);

        Swal.fire({
          toast: true,
          position: 'top-end',
          icon: 'success',
          title: 'Đã thêm vào giỏ hàng',
          showConfirmButton: false,
          timer: 1800,
          timerProgressBar: true,
        });
        this.cdr.detectChanges();
      },
      error: (err) => {
        card.adding = false;
        Swal.fire({
          icon: 'error',
          title: 'Không thể thêm vào giỏ hàng',
          text: err.error?.message || 'Vui lòng thử lại sau.',
          confirmButtonColor: '#2563B0',
        });
        this.cdr.detectChanges();
      },
    });
  }
}