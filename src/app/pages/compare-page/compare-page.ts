import { Component, OnInit, ChangeDetectorRef, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms'; 
import { Router, RouterModule } from '@angular/router';
import { CompareService, CompareItem } from '../../services/compare';
import { ProductService } from '../../services/product';
import { NotificationService } from '../../components/notification/notification.service';
import { CartService } from '../../services/cart';
import { CartStateService } from '../../services/cart-state.service';
import { AiCompareService } from '../../services/ai-compare';
import Swal from 'sweetalert2';

interface Product {
  Product_id: string;
  Product_name: string;
  Category_id: string;
  Brand_id: string;
  Description: string;
  Images: string[];
  Average_rating: number;
  Total_reviews: number;
  Technical_specs: Record<string, string>;
  Status: string;
  Discount: number;
  Is_Flash_Sale: boolean;
  Is_AI: boolean;
  min_price?: number;
  selectedVariantId?: string;
  variants?: any[];
  category?: any;
  brand?: any;
}

@Component({
  selector: 'app-compare-page',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule], 
  templateUrl: './compare-page.html',
  styleUrls: ['./compare-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ComparePageComponent implements OnInit {
  
  items: CompareItem[] = [];
  products: Product[] = [];
  displayProducts: (Product | null)[] = [];
  loading = true;
  error = '';
  showAddModal = false;
  availableProducts: Product[] = [];
  loadingAvailable = false;
  searchKeyword: string = '';
  filteredProducts: Product[] = [];

  currentCategoryId = '';
  currentCategoryName = '';
  currentProductType = '';

  private cachedAvailableProducts: Product[] = [];
  private cachedCategoryId = '';
  private isCacheLoaded = false;

  private excludeKeys = [
    'Usage_Type', 'User_Segment', 'Performance_Level', 
    'Portability', 'Gaming_Support', 'AI_Tag'
  ];

  specGroups: { name: string; keys: string[] }[] = [];
  private specValueCache = new Map<string, string>();
  totalSpecKeys = 0;

  mouseX = 50;
  mouseY = 50;

  constructor(
    private compareService: CompareService,
    private productService: ProductService,
    private notificationService: NotificationService,
    private cartService: CartService,
    private cartState: CartStateService,
    public router: Router,
    private aiCompareService: AiCompareService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.items = this.compareService.getCurrentItems();
    if (this.items.length < 2) {
      this.notificationService.error('Vui lòng chọn ít nhất 2 sản phẩm để so sánh.');
      this.router.navigate(['/']);
      return;
    }
    this.loadCompareData();
  }

  loadCompareData(): void {
    this.loading = true;
    this.cdr.markForCheck();
    const variantIds = this.items.map(item => item.variantId).join(',');

    this.isCacheLoaded = false;
    this.cachedAvailableProducts = [];
    
    this.productService.getCompareProducts(variantIds).subscribe({
      next: (res) => {
        this.products = (res.data || []).map((product: Product) => {
          const matchedItem = this.items.find(item => item.productId === product.Product_id);
          return { ...product, selectedVariantId: matchedItem?.variantId };
        });
        if (this.products.length > 0) {
          this.currentCategoryId = this.products[0]?.Category_id || '';
          this.currentCategoryName = this.products[0]?.category?.Category_name || '';
          this.currentProductType = this.getNormalizedType(this.products[0]);
        }
        this.specValueCache.clear();
        this.buildDisplayProducts();
        this.buildSpecGroups();
        this.totalSpecKeys = this.specGroups.reduce((acc, g) => acc + g.keys.length, 0);
        this.loading = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges(); 
      },
      error: (err) => {
        this.error = 'Không thể tải dữ liệu so sánh. Vui lòng thử lại.';
        this.loading = false;
        this.cdr.markForCheck();
        this.cdr.detectChanges(); 
      }
    });
  }

  private buildDisplayProducts(): void {
    this.displayProducts = [];
    for (let i = 0; i < 3; i++) {
      if (i < this.products.length) {
        this.displayProducts.push(this.products[i]);
      } else {
        this.displayProducts.push(null);
      }
    }
  }

  /**
   * Thêm sản phẩm vào danh sách so sánh hiện tại mà không gọi API
   * @param product - sản phẩm cần thêm
   * @param variantId - ID của biến thể được chọn
   */
  private addProductLocally(product: Product, variantId: string): void {

    const newProduct = {
      ...product,
      selectedVariantId: variantId,
    };

      
    if (this.isCacheLoaded) {
      this.cachedAvailableProducts = this.cachedAvailableProducts.filter(
        p => p.Product_id !== product.Product_id
      );
      this.availableProducts = [...this.cachedAvailableProducts];
      this.filteredProducts = [...this.availableProducts];
    }


    this.products = [...this.products, newProduct];


    this.buildDisplayProducts();


    this.specValueCache.clear();


    this.buildSpecGroups();


    this.totalSpecKeys = this.specGroups.reduce((acc, g) => acc + g.keys.length, 0);


    if (!this.currentCategoryId && this.products.length > 0) {
      this.currentCategoryId = this.products[0]?.Category_id || '';
      this.currentCategoryName = this.products[0]?.category?.Category_name || '';
      this.currentProductType = this.getNormalizedType(this.products[0]);
    }

    this.items = this.compareService.getCurrentItems();

    this.cdr.markForCheck();
    this.cdr.detectChanges();
  }

  private buildSpecGroups(): void {
    if (!this.products || this.products.length === 0) {
      this.specGroups = [];
      return;
    }

    const allKeys = new Set<string>();
    this.products.forEach(product => {
      const specs = product?.Technical_specs || {};
      Object.keys(specs).forEach(key => {
        if (!this.excludeKeys.includes(key)) {
          allKeys.add(key);
        }
      });
    });

    const groupMap: { [key: string]: string[] } = {
      'Thông tin chung': ['Product_name', 'Brand', 'Category', 'Price'],
      'Bộ xử lý & Đồ họa': ['CPU', 'GPU', 'VGA', 'Chipset'],
      'Bộ nhớ': ['RAM', 'ROM', 'Storage'],
      'Màn hình': ['Screen_Size', 'Display_Size', 'Resolution', 'Refresh_Rate', 'Screen_Type'],
      'Pin & Sạc': ['Battery', 'Power'],
      'Kết nối': ['Connectivity', 'Interface'],
      'Đặc điểm khác': ['Weight', 'Camera', 'OS', 'Type', 'Driver', 'Frequency', 'ANC']
    };

    const grouped: { [name: string]: string[] } = {};
    
    allKeys.forEach(key => {
      let assigned = false;
      for (const [groupName, groupKeys] of Object.entries(groupMap)) {
        if (groupKeys.includes(key)) {
          if (!grouped[groupName]) grouped[groupName] = [];
          grouped[groupName].push(key);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        if (!grouped['Thông số khác']) grouped['Thông số khác'] = [];
        grouped['Thông số khác'].push(key);
      }
    });

    const orderedGroups = Object.keys(groupMap);
    const finalGroups: { name: string; keys: string[] }[] = [];

    orderedGroups.forEach(groupName => {
      if (grouped[groupName] && grouped[groupName].length > 0) {
        const sortedKeys = grouped[groupName].sort((a, b) => {
          return groupMap[groupName].indexOf(a) - groupMap[groupName].indexOf(b);
        });
        finalGroups.push({ name: groupName, keys: sortedKeys });
      }
    });

    if (grouped['Thông số khác'] && grouped['Thông số khác'].length > 0) {
      finalGroups.push({ name: 'Thông số khác', keys: grouped['Thông số khác'] });
    }

    this.specGroups = finalGroups;
  }


  isRowDifferent(key: string): boolean {
    const values = this.displayProducts
      .filter(p => p !== null)
      .map(p => this.getSpecValue(p, key).trim().toLowerCase());
    if (values.length < 2) return false;
    // Loại bỏ các giá trị '—' sau khi đã normalize
    const meaningful = values.filter(v => v !== '—');
    if (meaningful.length < 2) return false;
    const first = meaningful[0];
    return meaningful.some(v => v !== first);
  }

  removeItem(variantId?: string): void {
    if (!variantId) return;
    

    const removedProduct = this.products.find(p => p.selectedVariantId === variantId);
    
    this.compareService.removeItem(variantId);
    const updatedItems = this.compareService.getCurrentItems();
    if (updatedItems.length < 2) {
      this.notificationService.info('Cần ít nhất 2 sản phẩm để so sánh.');
      this.router.navigate(['/']);
      return;
    }
    this.items = updatedItems;
    this.loadCompareData();
    this.isCacheLoaded = false;
  }

  clearAll(): void {
    this.compareService.clearAll();

    this.isCacheLoaded = false;
    this.cachedAvailableProducts = [];
    this.cachedCategoryId = '';
    this.router.navigate(['/']);
  }

  goHome(): void {
    this.router.navigate(['/']);
  }

  filterAvailableProducts(): void {
    if (!this.searchKeyword.trim()) {
      this.filteredProducts = [...this.availableProducts];
      return;
    }
    const keyword = this.searchKeyword.toLowerCase().trim();
    this.filteredProducts = this.availableProducts.filter((p: Product) => 
      p.Product_name.toLowerCase().includes(keyword)
    );
  }

  clearSearch(): void {
    this.searchKeyword = '';
    this.filteredProducts = [...this.availableProducts];
  }

  openAddModal(): void {
    if (this.products.length >= 3) {
      this.notificationService.info('Bạn đã có đủ 3 sản phẩm để so sánh.');
      return;
    }
    this.showAddModal = true;
    this.availableProducts = [];
    this.filteredProducts = [];
    this.searchKeyword = '';
    
    const currentProductIds = this.products.map(p => p.Product_id);
    const cachedProductIds = this.cachedAvailableProducts.map(p => p.Product_id);
    
    if (!this.isCacheLoaded || this.cachedCategoryId !== this.currentCategoryId) {
      this.isCacheLoaded = false;
    }
    
    this.loadAvailableProducts();
  }

  closeAddModal(): void {
    this.showAddModal = false;
    this.availableProducts = [];
    this.filteredProducts = [];
    this.searchKeyword = '';
  }

  loadAvailableProducts(): void {

    if (this.isCacheLoaded && this.cachedCategoryId === this.currentCategoryId) {
      this.availableProducts = [...this.cachedAvailableProducts];
      this.filteredProducts = [...this.availableProducts];
      this.loadingAvailable = false;
      this.cdr.markForCheck(); 
      return;
    }

    if (!this.currentCategoryId) {
      this.availableProducts = [];
      this.filteredProducts = [];
      this.loadingAvailable = false;
      this.cdr.markForCheck();
      return;
    }

    this.loadingAvailable = true;
    this.cdr.markForCheck(); 

    this.productService.getAllProducts({
      category: this.currentCategoryId,
      limit: 20,
      page: 1
    }).subscribe({
      next: (res) => {
        const allProducts = res.data || [];
        const existingIds = this.products.map((p: Product) => p.Product_id);
        
        this.availableProducts = allProducts.filter((p: Product) => {
          if (existingIds.includes(p.Product_id)) return false;
          if (this.currentProductType) {
            const productType = this.getNormalizedType(p);
            return productType === this.currentProductType;
          }
          return true;
        });


        this.cachedCategoryId = this.currentCategoryId;
        this.cachedAvailableProducts = [...this.availableProducts]; 
        this.isCacheLoaded = true;

        this.filteredProducts = [...this.availableProducts];
        this.loadingAvailable = false;
        

        this.cdr.markForCheck(); 
      },
      error: (err) => {
        console.error('Lỗi load danh sách sản phẩm:', err);
        this.loadingAvailable = false;
        this.availableProducts = [];
        this.filteredProducts = [];
        this.cdr.markForCheck(); 
      }
    });
  }

  addProductFromModal(product: Product): void {
    console.log('addProductFromModal called', product);
    
    let variant = product.variants?.[0];
    if (!variant && product.min_price) {
      console.log('Product has no variants, using min_price as fallback');
      variant = {
        Product_variant_id: product.Product_id + '_FALLBACK',
        Price: product.min_price,
        Stock_quantity: 999
      };
    }

    if (!variant) {
      this.notificationService.error('Sản phẩm này chưa có phiên bản.');
      return;
    }

    const productType = this.getNormalizedType(product);

    const compareItem: CompareItem = {
      productId: product.Product_id,
      variantId: variant.Product_variant_id,
      productName: product.Product_name,
      thumbnail: product.Images?.[0] || '',
      price: this.getFinalPrice(Number(variant.Price), Number(product.Discount)),
      categoryId: product.Category_id,
      categoryName: product.category?.Category_name || this.currentCategoryName,
      brandName: product.brand?.Brand_name || '',
      productType: productType 
    };

    const result = this.compareService.addItem(compareItem);
    if (result.success) {
      this.notificationService.success('Đã thêm sản phẩm vào danh sách so sánh.');
      this.closeAddModal();
      this.items = this.compareService.getCurrentItems();
      this.addProductLocally(product, variant.Product_variant_id);
    } else if (result.needConfirm) {
      const currentItems = this.compareService.getCurrentItems();
      const currentLabel = (currentItems[0]?.productType && currentItems[0]?.productType !== 'Khác')
        ? currentItems[0].productType
        : currentItems[0]?.productName || currentItems[0]?.categoryName || '';
      const newLabel = (compareItem.productType && compareItem.productType !== 'Khác')
        ? compareItem.productType
        : compareItem.productName || compareItem.categoryName || '';

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
          this.closeAddModal();
          this.products = [];
          this.specValueCache.clear();
          this.addProductLocally(product, variant.Product_variant_id);
        }
      });
    } else {
      this.notificationService.error(result.message || 'Không thể thêm sản phẩm.');
    }
  }

  goToProductDetail(productId: string): void {
    this.router.navigate(['/products', productId]);
  }

  analyzeWithAI(): void {
    if (this.products.length < 2) {
      alert('Cần ít nhất 2 sản phẩm để phân tích với AI.');
      return;
    }
    this.aiCompareService.setProducts(this.products);
    this.router.navigate(['/ai-compare']);
  }

  getFinalPrice(price: number | undefined, discount: number | undefined): number {
    const p = Number(price) || 0;
    const d = Number(discount) || 0;
    if (d === 0) return p;
    return p - (p * d / 100);
  }

  getSpecValue(product: Product | null, key: string): string {
    if (!product) return '—';
    try {
      const cacheKey = `${product.Product_id}_${key}`;
      if (this.specValueCache.has(cacheKey)) {
        return this.specValueCache.get(cacheKey)!;
      }

      const specs = product.Technical_specs || {};
      let result = '—';
      
      if (key === 'Product_name') result = product.Product_name || '—';
      else if (key === 'Brand') result = product.brand?.Brand_name || '—';
      else if (key === 'Category') result = product.category?.Category_name || '—';
      else if (key === 'Price') {
        const variant = product.variants?.[0] || null;
        if (variant) {
          const price = Number(variant.Price) || 0;
          const discount = Number(product.Discount) || 0;
          const finalPrice = this.getFinalPrice(price, discount);
          result = this.formatPrice(finalPrice);
        } else if (product.min_price) {
          result = this.formatPrice(product.min_price);
        } else {
          result = '—';
        }
      } else {
        const value = specs[key];
        result = (value !== undefined && value !== null) ? String(value) : '—';
      }

      this.specValueCache.set(cacheKey, result);
      return result;
    } catch (e) {
      console.error('Error in getSpecValue:', key, e);
      return '—';
    }
  }

  getProductImage(product: Product | null): string {
    if (!product) return '/assets/images/placeholder.jpg';
    const img = product.Images?.[0];
    return img ? '/assets/images/' + img : '/assets/images/placeholder.jpg';
  }

  formatPrice(price: number): string {
    if (!price) return '—';
    return price.toLocaleString('vi-VN') + ' ₫';
  }


  onMouseMove(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 100;
    const y = ((event.clientY - rect.top) / rect.height) * 100;
    this.mouseX = x;
    this.mouseY = y;
    target.style.setProperty('--mouse-x', x + '%');
    target.style.setProperty('--mouse-y', y + '%');
  }

  onMouseLeave(event: MouseEvent): void {
    const target = event.currentTarget as HTMLElement;
    if (!target) return;
    target.style.setProperty('--mouse-x', '0%');
    target.style.setProperty('--mouse-y', '0%');
  }

  getDisplayKey(key: string): string {
    const map: Record<string, string> = {
      'CPU': 'Vi xử lý (CPU)',
      'Chipset': 'Chipset',
      'RAM': 'Bộ nhớ RAM',
      'ROM': 'Bộ nhớ trong (ROM)',
      'Storage': 'Ổ cứng (SSD)',
      'Screen_Size': 'Kích thước màn hình',
      'Display_Size': 'Kích thước hiển thị',
      'Resolution': 'Độ phân giải',
      'Refresh_Rate': 'Tần số quét',
      'Screen_Type': 'Công nghệ màn hình',
      'Battery': 'Dung lượng pin',
      'Weight': 'Trọng lượng',
      'Camera': 'Camera',
      'OS': 'Hệ điều hành',
      'Type': 'Loại thiết bị',
      'Driver': 'Driver / Củ loa',
      'Frequency': 'Dải tần',
      'ANC': 'Chống ồn',
      'Power': 'Công suất',
      'Connectivity': 'Kết nối',
      'Interface': 'Giao tiếp',
      'Product_name': 'Tên sản phẩm',
      'Brand': 'Thương hiệu',
      'Category': 'Danh mục',
      'Price': 'Giá bán',
      'GPU': 'Card đồ họa (GPU)',
      'VGA': 'Card đồ họa (VGA)'
    };
    return map[key] || key;
  }

  addToCart(product: Product): void {
    if (!product) return;

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

    const variantId = product.selectedVariantId || product.variants?.[0]?.Product_variant_id;

    if (!variantId) {
      Swal.fire({
        icon: 'warning',
        title: 'Chưa có phiên bản',
        text: 'Sản phẩm chưa có phiên bản cụ thể.',
        confirmButtonColor: '#2563B0'
      });
      return;
    }

    this.cartService.addToCart(userId, variantId, 1).subscribe({
      next: (res: any) => {
        const totalProducts = res.data?.cart?.Total_product ?? this.cartState.getTotalQuantity(res.data?.items || []);
        this.cartState.setCount(totalProducts);
        
        Swal.fire({
          icon: 'success',
          title: 'Đã thêm vào giỏ hàng',
          text: 'Sản phẩm đã được cập nhật vào giỏ hàng của bạn.',
          confirmButtonColor: '#2563B0'
        });
      },
      error: (err: any) => {
        Swal.fire({
          icon: 'error',
          title: 'Không thể thêm vào giỏ hàng',
          text: err.error?.message || 'Vui lòng thử lại sau.',
          confirmButtonColor: '#2563B0'
        });
      }
    });
  }
  
  buyNow(product: Product): void {
    if (!product) return;

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

    const variantId = product.selectedVariantId || product.variants?.[0]?.Product_variant_id;

    if (!variantId) {
      Swal.fire({
        icon: 'warning',
        title: 'Chưa có phiên bản',
        text: 'Sản phẩm chưa có phiên bản cụ thể.',
        confirmButtonColor: '#2563B0'
      });
      return;
    }

    const variant = product.variants?.find((v: any) => v.Product_variant_id === variantId) || product.variants?.[0];

    const checkoutItem = {
      cartItemId: '',
      productVariantId: variantId,
      productId: product.Product_id || null,
      name: product.Product_name || 'Sản phẩm VISTA',
      variantName: variant?.Variant_name || '',
      specs: variant?.Variant_name || '',
      image: product.Images?.[0] || '',
      price: this.getFinalPrice(Number(variant?.Price || product.min_price) || 0, Number(product.Discount) || 0),
      originalPrice: Number(variant?.Price || product.min_price) || 0,
      discountPercent: Number(product.Discount) || 0,
      quantity: 1,
      stock: Number(variant?.Stock_quantity) || 0,
      categoryId: product.Category_id || '',
      categoryName: product.category?.Category_name || '',
      checkoutSource: 'buy_now',
      variantOptions: [] 
    };

    sessionStorage.setItem('vista_checkout_items', JSON.stringify([checkoutItem]));
    sessionStorage.setItem('vista_checkout_source', JSON.stringify({
      type: 'buy_now',
      categoryId: checkoutItem.categoryId,
      categoryName: checkoutItem.categoryName
    }));

    this.router.navigate(['/order']);
  }

  trackByProductId(index: number, product: Product | null): string {
    return product?.Product_id || index.toString();
  }

  trackByKey(index: number, key: string): string {
    return key;
  }
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


    const name = (product.Product_name || '').toLowerCase();
    const catId = product.Category_id || '';


    if (catId === 'CAT_001' || name.includes('laptop') || name.includes('macbook')) return 'Laptop';
    if (catId === 'CAT_002' || name.includes('điện thoại') || name.includes('iphone') || name.includes('smartphone') || name.includes('galaxy s')) return 'Điện thoại';
    if (catId === 'CAT_003' || name.includes('tablet') || name.includes('ipad') || name.includes('máy tính bảng')) return 'Máy tính bảng';


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