import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectorRef, Component, OnDestroy, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize, Subscription } from 'rxjs';

import { getAdminRole } from '../../../../guards/admin-guard';
import {
  AdminBrand,
  AdminCategory,
  AdminProductCreateRequest,
  AdminProduct,
  AdminProductQueryParams,
  AdminProductService,
  AdminProductSellingStatus,
  AdminProductStatus,
} from '../../../services/admin-product';
import { ResizableDrawerDirective } from '../../../directives/resizable-drawer.directive';
import { getAdminProductDisplayStatus } from './admin-product-status';

export interface KeyValuePair {
  key: string;
  value: string;
}

export interface ParsedImportProduct {
  rowNumber: number;
  Product_name: string;
  sku: string;
  Category_name: string;
  Brand_name: string;
  Price: number;
  Stock_quantity: number;
  Description: string;
  Technical_specs: Record<string, string>;
  isValid: boolean;
  errorMessage: string;
}

export interface ProductVariantFormState {
  Variant_name: string;
  sku: string;
  Price: number | null;
  Stock_quantity: number | null;
  attributes?: KeyValuePair[];
}

export interface ProductFormState {
  Product_name: string;
  sku: string;
  Category_id: string;
  Brand_id: string;
  Description: string;
  Price: number | null;
  Stock_quantity: number | null;
  Status: AdminProductSellingStatus;
  images: string[];
  Discount?: number | null;
  Is_Flash_Sale?: boolean;
  Is_AI?: boolean;
  specs?: KeyValuePair[];
  variants: ProductVariantFormState[];
}

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule, ResizableDrawerDirective],
  templateUrl: './admin-products.html',
  styleUrl: './admin-products.scss',
})
export class AdminProducts implements OnInit, OnDestroy {
  products: AdminProduct[] = [];
  categories: AdminCategory[] = [];
  brands: AdminBrand[] = [];

  readonly canManageProduct = getAdminRole() === 'Manager';
  readonly canCreateProduct = this.canManageProduct;
  isEditMode = false;
  editingProductId: string | null = null;
  keyword = '';
  selectedCategory = '';
  selectedStatus: '' | AdminProductStatus = '';
  flashSaleFilter: '' | 'true' | 'false' = '';

  page = 1;
  limit = 10;
  total = 0;

  isLoading = false;
  isLoadingCategories = false;
  isLoadingBrands = false;
  errorMessage = '';
  categoryError = '';
  brandError = '';

  // Form thêm / sửa sản phẩm
  isCreateOpen = false;
  isSubmitting = false;
  createError = '';
  toastMessage = '';
  toastType: 'success' | 'error' = 'success';
  createForm: ProductFormState = this.createEmptyProductForm();

  // UX Form State
  imageUrlInput = '';
  imageError = '';
  formErrors: Record<string, string> = {};
  isFormDirty = false;
  isConfirmCloseOpen = false;

  readonly commonSpecSuggestions: string[] = [
    'CPU',
    'RAM',
    'Ổ cứng',
    'Màn hình',
    'Card đồ họa',
    'Pin',
    'Trọng lượng',
    'Hệ điều hành',
    'Cổng kết nối',
  ];

  readonly commonAttributeSuggestions: string[] = [
    'Màu sắc',
    'Dung lượng',
    'Kích thước',
    'Cấu hình',
  ];

  readonly pageSizeOptions = [10, 20, 50];
  private readonly productsWithBrokenImages = new Set<string>();

  isDetailOpen = false;
  isDetailLoading = false;
  detailError = '';
  detail: AdminProduct | null = null;
  detailProductId = '';

  private detailRequest?: Subscription;
  private detailRequestId = 0;
  private productsRequest?: Subscription;
  private productsRequestId = 0;
  private searchTimer?: ReturnType<typeof setTimeout>;
  private toastTimer?: ReturnType<typeof setTimeout>;

  constructor(
    private readonly productService: AdminProductService,
    private readonly changeDetectorRef: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.loadCategories();
    this.loadBrands();
    this.loadProducts();
  }

  ngOnDestroy(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.detailRequest?.unsubscribe();
    this.productsRequestId += 1;
    this.productsRequest?.unsubscribe();
  }

  loadCategories(): void {
    this.isLoadingCategories = true;
    this.categoryError = '';

    this.productService
      .getCategories()
      .pipe(
        finalize(() => {
          this.isLoadingCategories = false;
          this.changeDetectorRef.detectChanges();
        }),
      )
      .subscribe({
        next: (response: any) => {
          const items = Array.isArray(response)
            ? response
            : Array.isArray(response?.data)
              ? response.data
              : [];
          if (items.length === 0 && response?.success === false) {
            this.categoryError =
              response?.message || 'Không thể tải danh sách danh mục.';
            this.categories = [];
            return;
          }
          this.categories = items;
        },
        error: (error: unknown) => {
          this.categoryError = this.getApiErrorMessage(
            error,
            'Không thể tải danh sách danh mục.',
          );
        },
      });
  }

  loadBrands(): void {
    this.isLoadingBrands = true;
    this.brandError = '';

    this.productService
      .getBrands()
      .pipe(
        finalize(() => {
          this.isLoadingBrands = false;
          this.changeDetectorRef.detectChanges();
        }),
      )
      .subscribe({
        next: (response: any) => {
          const items = Array.isArray(response)
            ? response
            : Array.isArray(response?.data)
              ? response.data
              : [];
          if (items.length === 0 && response?.success === false) {
            this.brandError =
              response?.message || 'Không thể tải danh sách thương hiệu.';
            this.brands = [];
            return;
          }
          this.brands = items;
        },
        error: (error: unknown) => {
          this.brandError = this.getApiErrorMessage(
            error,
            'Không thể tải danh sách thương hiệu.',
          );
        },
      });
  }

  loadProducts(): void {
    const requestId = ++this.productsRequestId;
    this.productsRequest?.unsubscribe();
    this.productsRequest = undefined;

    this.isLoading = true;
    this.errorMessage = '';

    const params: AdminProductQueryParams = {
      page: this.page,
      limit: this.limit,
    };

    const keyword = this.keyword.trim();

    if (keyword) {
      params.keyword = keyword;
    }

    if (this.selectedCategory) {
      params.categoryId = this.selectedCategory;
    }

    if (this.selectedStatus) {
      params.status = this.selectedStatus;
    }

    if (this.flashSaleFilter !== '') {
      params.isFlashSale = this.flashSaleFilter === 'true';
    }

    const request = this.productService
      .getProducts(params)
      .pipe(
        finalize(() => {
          if (requestId !== this.productsRequestId) {
            return;
          }

          this.productsRequest = undefined;
          this.isLoading = false;
          this.changeDetectorRef.detectChanges();
        }),
      )
      .subscribe({
        next: (response) => {
          if (requestId !== this.productsRequestId) {
            return;
          }

          this.products = response.data?.items ?? [];
          this.total = response.data?.total ?? 0;
          this.page = response.data?.page ?? this.page;
          this.limit = response.data?.limit ?? this.limit;
        },
        error: (error) => {
          if (requestId !== this.productsRequestId) {
            return;
          }

          this.products = [];
          this.total = 0;

          this.errorMessage =
            error?.error?.message ||
            error?.message ||
            'Không thể tải danh sách sản phẩm. Vui lòng thử lại.';
        },
      });

    if (requestId === this.productsRequestId && !request.closed) {
      this.productsRequest = request;
    }
  }

  search(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = undefined;
    }

    this.page = 1;
    this.loadProducts();
  }

  onKeywordChange(keyword: string): void {
    this.keyword = keyword;

    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }

    this.searchTimer = setTimeout(() => {
      this.searchTimer = undefined;
      this.page = 1;
      this.loadProducts();
    }, 300);
  }

  onFiltersChanged(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = undefined;
    }

    this.page = 1;
    this.loadProducts();
  }

  get hasActiveFilters(): boolean {
    return Boolean(
      this.keyword.trim() ||
        this.selectedCategory ||
        this.selectedStatus ||
        this.flashSaleFilter,
    );
  }

  resetFilters(): void {
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
      this.searchTimer = undefined;
    }

    this.keyword = '';
    this.selectedCategory = '';
    this.selectedStatus = '';
    this.flashSaleFilter = '';
    this.page = 1;

    this.loadProducts();
  }

  changePage(nextPage: number): void {
    if (
      nextPage < 1 ||
      nextPage > this.totalPages ||
      nextPage === this.page
    ) {
      return;
    }

    this.page = nextPage;
    this.loadProducts();
  }

  changePageSize(): void {
    this.page = 1;
    this.loadProducts();
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.total / this.limit));
  }

  get firstItemIndex(): number {
    return this.total === 0 ? 0 : (this.page - 1) * this.limit + 1;
  }

  get lastItemIndex(): number {
    return Math.min(this.page * this.limit, this.total);
  }

  getProductPriceRange(product: AdminProduct): string {
    const prices = (product.variants ?? [])
      .map((variant) => Number(variant.Price))
      .filter((price) => Number.isFinite(price) && price >= 0);

    if (prices.length === 0) {
      return '—';
    }

    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);

    if (minPrice === maxPrice) {
      return this.formatCurrency(minPrice);
    }

    return `${this.formatCurrency(minPrice)} – ${this.formatCurrency(maxPrice)}`;
  }

  getProductStock(product: AdminProduct): number {
    return (product.variants ?? [])
      .reduce(
        (total, variant) =>
          total + Math.max(0, Number(variant.Stock_quantity) || 0),
        0,
      );
  }

  getProductDisplayStatus(product: AdminProduct): AdminProductStatus {
    return getAdminProductDisplayStatus(product.Status, this.getProductStock(product));
  }

  getProductSku(product: AdminProduct): string {
    const firstVariant = product.variants?.[0];
    const variantSku =
      typeof (firstVariant?.Attributes as any)?.sku === 'string'
        ? (firstVariant.Attributes as any).sku.trim()
        : typeof (firstVariant as any)?.sku === 'string'
          ? (firstVariant as any).sku.trim()
          : '';

    if (variantSku) {
      return variantSku;
    }

    const specsSku =
      typeof (product.Technical_specs as any)?.sku === 'string'
        ? (product.Technical_specs as any).sku.trim()
        : '';

    if (specsSku) {
      return specsSku;
    }

    return product.Product_id || '—';
  }

  getProductStatusLabel(status: AdminProductStatus): string {
    if (status === 'discontinued') {
      return 'Ngừng bán';
    }

    return status === 'out_of_stock' ? 'Hết hàng' : 'Đang bán';
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(value);
  }

  trackByProductId(_index: number, product: AdminProduct): string {
    return product.Product_id;
  }

  getProductImageUrl(product: AdminProduct): string | null {
    const image = product.Images?.[0]?.trim();
    if (!image || this.productsWithBrokenImages.has(product.Product_id)) {
      return null;
    }

    if (/^https?:\/\//i.test(image) || image.startsWith('/') || image.startsWith('data:image/')) {
      return image;
    }

    if (/^(public\/)?assets\//i.test(image)) {
      return `/${image.replace(/^public\//i, '')}`;
    }

    if (/^(uploads|static)\//i.test(image)) {
      return `/${image}`;
    }

    return `/assets/images/${image.replace(/^\.\//, '')}`;
  }

  onProductImageError(product: AdminProduct): void {
    this.productsWithBrokenImages.add(product.Product_id);
  }

  viewProduct(product: AdminProduct): void {
    this.detailRequest?.unsubscribe();
    this.detailRequest = undefined;

    const requestId = ++this.detailRequestId;
    this.detailProductId = product.Product_id;
    this.detail = null;
    this.detailError = '';
    this.isDetailLoading = true;
    this.isDetailOpen = true;

    this.detailRequest = this.productService
      .getProductById(product.Product_id)
      .subscribe({
        next: (response) => {
          if (requestId !== this.detailRequestId || !this.isDetailOpen) {
            return;
          }

          if (
            response?.success !== true ||
            !this.isProductDetailResponse(response.data, product.Product_id)
          ) {
            this.detailError =
              response?.message || 'Dữ liệu chi tiết sản phẩm không hợp lệ.';
          } else {
            this.detail = response.data;
          }

          this.isDetailLoading = false;
          this.detailRequest = undefined;
          this.changeDetectorRef.detectChanges();
        },
        error: (error: unknown) => {
          if (requestId !== this.detailRequestId || !this.isDetailOpen) {
            return;
          }

          this.detailError = this.getProductDetailError(error);
          this.isDetailLoading = false;
          this.detailRequest = undefined;
          this.changeDetectorRef.detectChanges();
        },
      });
  }

  closeProductDetail(): void {
    this.detailRequestId += 1;
    this.detailRequest?.unsubscribe();
    this.detailRequest = undefined;
    this.isDetailOpen = false;
    this.isDetailLoading = false;
    this.detail = null;
    this.detailError = '';
    this.detailProductId = '';
  }

  getTechnicalSpecEntries(
    specs: unknown,
  ): Array<{ label: string; value: string }> {
    if (specs === undefined || specs === null || specs === '') {
      return [];
    }

    const entries: [string, unknown][] =
      typeof specs === 'object' && !Array.isArray(specs)
        ? Object.entries(specs)
        : [['Thông số kỹ thuật', specs]];

    return entries.map(([label, value]) => ({
      label,
      value: this.formatDetailValue(value),
    }));
  }

  formatDetailValue(value: unknown): string {
    if (value === undefined || value === null || value === '') {
      return '—';
    }

    if (typeof value === 'string') {
      return value;
    }

    return JSON.stringify(value) ?? String(value);
  }

  getVariantStatusLabel(status: string): string {
    if (status === 'active') {
      return 'Đang hoạt động';
    }

    if (status === 'out_of_stock') {
      return 'Hết hàng';
    }

    return status || 'Chưa có trạng thái';
  }

  private isProductDetailResponse(
    value: unknown,
    expectedProductId: string,
  ): value is AdminProduct {
    if (typeof value !== 'object' || value === null) {
      return false;
    }

    const data = value as Record<string, unknown>;
    const isOptionalRelation = (relation: unknown): boolean =>
      relation === null ||
      (typeof relation === 'object' && relation !== null && !Array.isArray(relation));

    return (
      data['Product_id'] === expectedProductId &&
      typeof data['Product_name'] === 'string' &&
      Array.isArray(data['Images']) &&
      Array.isArray(data['variants']) &&
      isOptionalRelation(data['category']) &&
      isOptionalRelation(data['brand'])
    );
  }

  private getProductDetailError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const apiMessage =
        typeof error.error?.message === 'string' ? error.error.message : '';

      if (error.status === 404) {
        return apiMessage || 'Không tìm thấy sản phẩm.';
      }

      return apiMessage || error.message || 'Không thể tải chi tiết sản phẩm.';
    }

    if (error instanceof Error && error.message) {
      return error.message;
    }

    return 'Không thể tải chi tiết sản phẩm.';
  }

  // ==========================================
  // QUẢN LÝ FORM THÊM / CHỈNH SỬA SẢN PHẨM (UX CẢI TIẾN)
  // ==========================================

  markDirty(): void {
    this.isFormDirty = true;
  }

  onFieldChange(field?: string): void {
    this.markDirty();
    if (field) delete this.formErrors[field];
    this.createError = '';
    return;
  }
  _old_onFieldChange(field: string): void {
    this.markDirty();
    delete this.formErrors[field];
    this.createError = '';
  }

  openCreateForm(): void {
    if (!this.canManageProduct || this.isSubmitting) {
      return;
    }

    this.isEditMode = false;
    this.editingProductId = null;
    this.createForm = this.createEmptyProductForm();
    this.imageUrlInput = '';
    this.imageError = '';
    this.formErrors = {};
    this.isFormDirty = false;
    this.isConfirmCloseOpen = false;

    if (this.brands.length === 0 && !this.isLoadingBrands) {
      this.loadBrands();
    }
    if (this.categories.length === 0 && !this.isLoadingCategories) {
      this.loadCategories();
    }

    this.createError = '';
    this.isCreateOpen = true;
  }

  editProduct(product: AdminProduct): void {
    if (!this.canManageProduct || this.isSubmitting) {
      return;
    }

    this.createError = '';
    this.isEditMode = true;
    this.editingProductId = product.Product_id;
    this.imageUrlInput = '';
    this.imageError = '';
    this.formErrors = {};
    this.isFormDirty = false;
    this.isConfirmCloseOpen = false;

    if (this.brands.length === 0 && !this.isLoadingBrands) {
      this.loadBrands();
    }
    if (this.categories.length === 0 && !this.isLoadingCategories) {
      this.loadCategories();
    }

    this.populateFormWithProduct(product);
    this.isCreateOpen = true;

    // Tải thêm thông tin chi tiết đầy đủ nếu list chỉ trả về một phần
    this.productService.getProductById(product.Product_id).subscribe({
      next: (res) => {
        if (this.isEditMode && this.editingProductId === product.Product_id && res?.data) {
          this.populateFormWithProduct(res.data);
          this.changeDetectorRef.detectChanges();
        }
      },
    });
  }

  requestCloseCreateForm(): void {
    if (this.isSubmitting) {
      return;
    }

    if (this.isFormDirty) {
      this.isConfirmCloseOpen = true;
    } else {
      this.closeCreateForm(true);
    }
  }

  cancelCloseConfirm(): void {
    this.isConfirmCloseOpen = false;
  }

  confirmDiscardChanges(): void {
    this.isConfirmCloseOpen = false;
    this.closeCreateForm(true);
  }

  closeCreateForm(force: boolean = false): void {
    if (this.isSubmitting) {
      return;
    }

    if (!force && this.isFormDirty) {
      this.isConfirmCloseOpen = true;
      return;
    }

    this.isConfirmCloseOpen = false;
    this.isCreateOpen = false;
    this.isEditMode = false;
    this.editingProductId = null;
    this.createError = '';
    this.imageError = '';
    this.formErrors = {};
    this.imageUrlInput = '';
    this.isFormDirty = false;
    this.createForm = this.createEmptyProductForm();
  }

  // --- Xử lý hình ảnh ---
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) {
      return;
    }

    const files = Array.from(input.files);
    this.imageError = '';

    for (const file of files) {
      if (!file.type.startsWith('image/')) {
        this.imageError = `Tệp "${file.name}" không phải định dạng ảnh hợp lệ (chấp nhận JPG, PNG, WEBP, SVG).`;
        continue;
      }

      // Giới hạn 5MB
      if (file.size > 5 * 1024 * 1024) {
        this.imageError = `Tệp "${file.name}" quá dung lượng tối đa (5MB).`;
        continue;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result && !this.createForm.images.includes(result)) {
          this.createForm.images.push(result);
          this.markDirty();
          this.changeDetectorRef.detectChanges();
        }
      };
      reader.readAsDataURL(file);
    }

    input.value = '';
  }

  addImageUrl(): void {
    const url = this.imageUrlInput.trim();
    if (!url) {
      return;
    }

    if (this.createForm.images.includes(url)) {
      this.imageError = 'Hình ảnh này đã tồn tại trong danh sách.';
      return;
    }

    this.createForm.images.push(url);
    this.imageUrlInput = '';
    this.imageError = '';
    this.markDirty();
  }

  removeImage(index: number): void {
    this.createForm.images.splice(index, 1);
    this.markDirty();
  }

  setPrimaryImage(index: number): void {
    if (index <= 0 || index >= this.createForm.images.length) {
      return;
    }

    const [image] = this.createForm.images.splice(index, 1);
    this.createForm.images.unshift(image);
    this.markDirty();
  }

  // --- Đồng bộ form đơn giản ---
  onSkuChange(): void {
    this.markDirty();
    if (this.createForm.variants.length === 1 && !this.createForm.variants[0].sku) {
      this.createForm.variants[0].sku = this.createForm.sku;
    }
  }

  onBasePriceChange(): void {
    this.markDirty();
    if (this.createForm.variants.length === 1) {
      this.createForm.variants[0].Price = this.createForm.Price;
    }
  }

  onBaseStockChange(): void {
    this.markDirty();
    if (this.createForm.variants.length === 1) {
      this.createForm.variants[0].Stock_quantity = this.createForm.Stock_quantity;
    }
  }

  onVariantPriceChange(index: number): void {
    this.markDirty();
    if (this.createForm.variants.length === 1) {
      this.createForm.Price = this.createForm.variants[0].Price;
    }
  }

  onVariantStockChange(index: number): void {
    this.markDirty();
    if (this.createForm.variants.length === 1) {
      this.createForm.Stock_quantity = this.createForm.variants[0].Stock_quantity;
    }
  }

  // --- Xử lý biến thể ---
  addVariant(): void {
    const nextIdx = this.createForm.variants.length + 1;
    const baseSku = this.createForm.sku ? `${this.createForm.sku}-${nextIdx}` : '';
    this.createForm.variants.push({
      Variant_name: '',
      sku: baseSku,
      Price: this.createForm.Price,
      Stock_quantity: this.createForm.Stock_quantity ?? 0,
    });
    this.markDirty();
  }

  removeVariant(index: number): void {
    if (this.createForm.variants.length <= 1) {
      return;
    }

    this.createForm.variants.splice(index, 1);
    this.markDirty();
  }

  addVariantAttribute(variant: ProductVariantFormState, key: string = '', value: string = ''): void {
    if (!variant.attributes) {
      variant.attributes = [];
    }
    variant.attributes.push({ key, value });
    this.markDirty();
  }

  removeVariantAttribute(variant: ProductVariantFormState, attrIndex: number): void {
    if (variant.attributes) {
      variant.attributes.splice(attrIndex, 1);
      this.markDirty();
    }
  }

  // --- Xử lý thông số kỹ thuật (Technical Specs) ---
  addSpec(key: string = '', value: string = ''): void {
    if (!this.createForm.specs) {
      this.createForm.specs = [];
    }
    this.createForm.specs.push({ key, value });
    this.markDirty();
  }

  removeSpec(index: number): void {
    if (this.createForm.specs) {
      this.createForm.specs.splice(index, 1);
      this.markDirty();
    }
  }

  applySpecSuggestion(suggestion: string): void {
    if (!this.createForm.specs) {
      this.createForm.specs = [];
    }
    const exists = this.createForm.specs.some(
      (s) => s.key.trim().toLowerCase() === suggestion.trim().toLowerCase(),
    );
    if (!exists) {
      this.createForm.specs.push({ key: suggestion, value: '' });
      this.markDirty();
    }
  }

  // --- Submit sản phẩm ---
  submitProduct(): void {
    if (!this.canManageProduct || this.isSubmitting) {
      return;
    }

    const validationError = this.validateCreateForm();
    if (validationError) {
      this.createError = validationError;
      return;
    }

    let request: AdminProductCreateRequest;
    try {
      request = this.buildCreateRequest();
    } catch (error: unknown) {
      this.createError =
        error instanceof Error ? error.message : 'Kiểm tra lại dữ liệu đã nhập.';
      return;
    }

    this.createError = '';
    this.isSubmitting = true;

    if (this.isEditMode && this.editingProductId) {
      const editId = this.editingProductId;
      this.productService
        .updateProduct(editId, request)
        .pipe(
          finalize(() => {
            this.isSubmitting = false;
            this.changeDetectorRef.detectChanges();
          }),
        )
        .subscribe({
          next: (response) => {
            if (response?.success !== true) {
              this.createError =
                response?.message || 'Không thể xác nhận kết quả cập nhật sản phẩm.';
              return;
            }

            this.isSubmitting = false;
            this.closeCreateForm(true);
            this.showToast(response.message || 'Cập nhật sản phẩm thành công.', 'success');
            if (this.isDetailOpen && this.detailProductId === editId) {
              this.viewProduct(response.data || ({ Product_id: editId } as AdminProduct));
            }
            this.loadProducts();
          },
          error: (error: unknown) => {
            this.createError = this.getApiErrorMessage(
              error,
              'Không thể cập nhật sản phẩm. Vui lòng kiểm tra dữ liệu và thử lại.',
            );
          },
        });
    } else {
      this.productService
        .createProduct(request)
        .pipe(
          finalize(() => {
            this.isSubmitting = false;
            this.changeDetectorRef.detectChanges();
          }),
        )
        .subscribe({
          next: (response) => {
            if (response?.success !== true || !response.data?.Product_id) {
              this.createError =
                response?.message || 'Không thể xác nhận kết quả tạo sản phẩm.';
              return;
            }

            this.isSubmitting = false;
            this.closeCreateForm(true);
            this.showToast(response.message || 'Tạo sản phẩm thành công.', 'success');
            this.page = 1;
            this.loadProducts();
          },
          error: (error: unknown) => {
            this.createError = this.getApiErrorMessage(
              error,
              'Không thể tạo sản phẩm. Vui lòng kiểm tra dữ liệu và thử lại.',
            );
          },
        });
    }
  }

  private createEmptyProductForm(): ProductFormState {
    return {
      Product_name: '',
      sku: '',
      Category_id: '',
      Brand_id: this.brands[0]?.Brand_id || '',
      Description: '',
      Price: null,
      Stock_quantity: 0,
      Status: 'on_sale',
      images: [],
      Discount: 0,
      Is_Flash_Sale: false,
      Is_AI: false,
      specs: [],
      variants: [this.createEmptyVariantForm()],
    };
  }

  private createEmptyVariantForm(): ProductVariantFormState {
    return {
      Variant_name: '',
      sku: '',
      Price: null,
      Stock_quantity: 0,
      attributes: [],
    };
  }

  private populateFormWithProduct(product: AdminProduct): void {
    const variants: ProductVariantFormState[] = (product.variants ?? []).map((v) => ({
      Variant_name: v.Variant_name || '',
      sku: (v.Attributes as any)?.sku || v.Product_variant_id || '',
      Price: v.Price !== undefined ? Number(v.Price) : null,
      Stock_quantity: v.Stock_quantity !== undefined ? Number(v.Stock_quantity) : 0,
      attributes: [],
    }));

    if (variants.length === 0) {
      variants.push(this.createEmptyVariantForm());
    }

    const basePrice = variants[0]?.Price ?? null;
    const baseStock = variants[0]?.Stock_quantity ?? 0;
    const sku = (product.Technical_specs as any)?.sku || product.Product_id || '';
    const images = Array.isArray(product.Images) ? [...product.Images] : [];

    const specs: KeyValuePair[] = [];
    if (
      product.Technical_specs &&
      typeof product.Technical_specs === 'object' &&
      !Array.isArray(product.Technical_specs)
    ) {
      Object.entries(product.Technical_specs).forEach(([key, val]) => {
        if (key !== 'sku' && val !== undefined && val !== null) {
          specs.push({ key, value: String(val) });
        }
      });
    }

    this.createForm = {
      Product_name: product.Product_name || '',
      sku,
      Category_id: product.Category_id || product.category?.Category_id || '',
      Brand_id: product.Brand_id || product.brand?.Brand_id || (this.brands[0]?.Brand_id || ''),
      Description: product.Description || '',
      Price: basePrice,
      Stock_quantity: baseStock,
      Status: product.Status === 'discontinued' || product.Status === 'out_of_stock'
        ? 'discontinued'
        : 'on_sale',
      images,
      Discount: product.Discount !== undefined ? Number(product.Discount) : 0,
      Is_Flash_Sale: Boolean(product.Is_Flash_Sale),
      Is_AI: Boolean(product.Is_AI),
      specs,
      variants,
    };

    this.imageUrlInput = '';
    this.imageError = '';
    this.formErrors = {};
    this.isFormDirty = false;
  }

  private validateCreateForm(): string {
    this.formErrors = {};

    if (!this.createForm.Product_name.trim()) {
      this.formErrors['Product_name'] = 'Vui lòng nhập tên sản phẩm.';
    }

    if (!this.createForm.sku.trim()) {
      this.formErrors['sku'] = 'Vui lòng nhập mã SKU.';
    }

    if (!this.createForm.Category_id) {
      this.formErrors['Category_id'] = 'Vui lòng chọn danh mục sản phẩm.';
    }

    const basePrice = this.createForm.Price;
    if (basePrice === null || !Number.isFinite(basePrice) || basePrice <= 0) {
      const anyInvalid = this.createForm.variants.some(
        (v) => v.Price === null || !Number.isFinite(v.Price) || v.Price <= 0,
      );
      if (anyInvalid) {
        this.formErrors['Price'] = 'Vui lòng nhập giá bán hợp lệ (> 0 ₫).';
      }
    }

    const baseStock = this.createForm.Stock_quantity;
    if (baseStock === null || !Number.isSafeInteger(baseStock) || baseStock < 0) {
      this.formErrors['Stock_quantity'] = 'Tồn kho phải là số nguyên ≥ 0.';
    }

    for (const [index, variant] of this.createForm.variants.entries()) {
      const vPrice = variant.Price ?? this.createForm.Price;
      if (vPrice === null || !Number.isFinite(vPrice) || vPrice <= 0) {
        this.formErrors[`variant_${index}_price`] = 'Giá bán phải lớn hơn 0 ₫.';
      }

      const vStock = variant.Stock_quantity ?? this.createForm.Stock_quantity ?? 0;
      if (!Number.isSafeInteger(vStock) || vStock < 0) {
        this.formErrors[`variant_${index}_stock`] = 'Tồn kho phải ≥ 0.';
      }
    }

    const firstErrorKey = Object.keys(this.formErrors)[0];
    if (firstErrorKey) {
      return this.formErrors[firstErrorKey];
    }

    return '';
  }

  private buildCreateRequest(): AdminProductCreateRequest {
    const brandId = this.createForm.Brand_id || this.brands[0]?.Brand_id || '';

    const variants = this.createForm.variants.map((variant, index) => {
      const price = variant.Price ?? this.createForm.Price ?? 0;
      const stockQuantity = variant.Stock_quantity ?? this.createForm.Stock_quantity ?? 0;
      const variantName =
        variant.Variant_name.trim() ||
        (this.createForm.variants.length === 1 ? 'Mặc định' : `Biến thể ${index + 1}`);

      const result: AdminProductCreateRequest['variants'][number] = {
        Variant_name: variantName,
        Price: price,
        Stock_quantity: stockQuantity,
      };

      const variantSku = variant.sku?.trim() || this.createForm.sku.trim();
      if (variantSku) {
        result.Attributes = { sku: variantSku };
      }

      return result;
    });

    const request: AdminProductCreateRequest = {
      Product_name: this.createForm.Product_name.trim(),
      Category_id: this.createForm.Category_id,
      Brand_id: brandId,
      Status: this.createForm.Status || 'on_sale',
      Discount: this.createForm.Discount || 0,
      Is_Flash_Sale: Boolean(this.createForm.Is_Flash_Sale),
      Is_AI: Boolean(this.createForm.Is_AI),
      variants,
    };

    const description = this.createForm.Description.trim();
    if (description) {
      request.Description = description;
    }

    if (this.createForm.images.length > 0) {
      request.Images = [...this.createForm.images];
    }

    const specsObj: Record<string, string> = {};
    if (this.createForm.sku.trim()) {
      specsObj['sku'] = this.createForm.sku.trim();
    }
    if (this.createForm.specs) {
      this.createForm.specs.forEach((item) => {
        const k = item.key?.trim();
        const v = item.value?.trim();
        if (k && v) {
          specsObj[k] = v;
        }
      });
    }
    if (Object.keys(specsObj).length > 0) {
      request.Technical_specs = specsObj;
    }

    return request;
  }

  private getApiErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      return typeof error.error?.message === 'string'
        ? error.error.message
        : error.message || fallback;
    }

    return error instanceof Error && error.message ? error.message : fallback;
  }

  private showToast(message: string, type: 'success' | 'error'): void {
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
    this.toastMessage = message;
    this.toastType = type;
    this.toastTimer = setTimeout(() => {
      this.toastMessage = '';
      this.changeDetectorRef.detectChanges();
    }, 3000);
  }

  // --- Bulk Import State & Methods ---
  isBulkImportOpen = false;
  isImporting = false;
  importFileName = '';
  importError = '';
  importedItems: ParsedImportProduct[] = [];
  importSummary = { total: 0, valid: 0, invalid: 0 };
  isDragging = false;

  openBulkImportModal(): void {
    if (!this.canCreateProduct || this.isSubmitting) return;
    this.isBulkImportOpen = true;
    this.importFileName = '';
    this.importError = '';
    this.importedItems = [];
    this.importSummary = { total: 0, valid: 0, invalid: 0 };
    this.changeDetectorRef.detectChanges();
  }

  closeBulkImportModal(): void {
    if (this.isImporting) return;
    this.isBulkImportOpen = false;
    this.importFileName = '';
    this.importError = '';
    this.importedItems = [];
    this.importSummary = { total: 0, valid: 0, invalid: 0 };
    this.changeDetectorRef.detectChanges();
  }

  downloadImportTemplate(): void {
    const headers = [
      'Tên sản phẩm*',
      'SKU*',
      'Danh mục*',
      'Thương hiệu*',
      'Giá bán*',
      'Tồn kho',
      'Mô tả',
      'CPU',
      'RAM',
      'Ổ cứng',
      'Màn hình',
      'Pin',
      'Hệ điều hành',
    ];

    const sampleRows = [
      [
        'MacBook Air M3 13 inch',
        'MBA-M3-8-256',
        'Laptop',
        'Apple',
        '27990000',
        '15',
        'MacBook Air trang bị chip M3 siêu mỏng nhẹ',
        'Apple M3 8-core',
        '8GB',
        '256GB SSD',
        '13.6 inch Liquid Retina',
        '18 giờ',
        'macOS Sonoma',
      ],
      [
        'Dell XPS 13 9340',
        'XPS-9340-16-512',
        'Laptop',
        'Dell',
        '39990000',
        '10',
        'Laptop doanh nhân cao cấp mỏng nhẹ siêu di động',
        'Intel Core Ultra 7 155H',
        '16GB LPDDR5x',
        '512GB NVMe SSD',
        '13.4 inch FHD+ IPS',
        '55Wh',
        'Windows 11 Home',
      ],
      [
        'Samsung Galaxy S24 Ultra',
        'SGS24U-12-256',
        'Điện thoại',
        'Samsung',
        '29990000',
        '20',
        'Smartphone cao cấp với Galaxy AI đột phá',
        'Snapdragon 8 Gen 3',
        '12GB',
        '256GB',
        '6.8 inch Dynamic AMOLED 2X',
        '5000 mAh',
        'Android 14',
      ],
    ];

    const csvContent =
      '\uFEFF' +
      [
        headers.join(','),
        ...sampleRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(',')),
      ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'VISTA_Mau_Nhap_San_Pham.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  onImportFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;
    this.processImportFile(input.files[0]);
    input.value = '';
  }

  onFileDropped(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
    if (event.dataTransfer?.files && event.dataTransfer.files.length > 0) {
      this.processImportFile(event.dataTransfer.files[0]);
    }
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent): void {
    event.preventDefault();
    this.isDragging = false;
  }

  private processImportFile(file: File): void {
    this.importError = '';
    this.importFileName = file.name;

    if (!file.name.endsWith('.csv') && !file.name.endsWith('.txt')) {
      this.importError = 'Vui lòng chọn tệp định dạng .csv (tương thích Excel UTF-8).';
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) || '';
      try {
        const parsed = this.parseCsvFile(text);
        if (parsed.length === 0) {
          this.importError = 'Tệp không chứa dữ liệu sản phẩm hợp lệ hoặc chưa đúng cấu trúc mẫu.';
          this.importedItems = [];
          this.importSummary = { total: 0, valid: 0, invalid: 0 };
          return;
        }

        this.importedItems = parsed;
        const validCount = parsed.filter((i) => i.isValid).length;
        this.importSummary = {
          total: parsed.length,
          valid: validCount,
          invalid: parsed.length - validCount,
        };
        this.changeDetectorRef.detectChanges();
      } catch (err: unknown) {
        this.importError = 'Không thể đọc nội dung tệp. Vui lòng kiểm tra lại cấu trúc file.';
      }
    };
    reader.readAsText(file, 'utf-8');
  }

  private parseCsvFile(text: string): ParsedImportProduct[] {
    let cleanText = text.replace(/^\uFEFF/, '').trim();
    if (!cleanText) return [];

    const rows: string[][] = [];
    let currentRow: string[] = [];
    let currentField = '';
    let insideQuotes = false;

    for (let i = 0; i < cleanText.length; i++) {
      const char = cleanText[i];
      const nextChar = cleanText[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          currentField += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === ',' && !insideQuotes) {
        currentRow.push(currentField.trim());
        currentField = '';
      } else if ((char === '\r' || char === '\n') && !insideQuotes) {
        if (char === '\r' && nextChar === '\n') i++;
        currentRow.push(currentField.trim());
        if (currentRow.some((f) => f !== '')) {
          rows.push(currentRow);
        }
        currentRow = [];
        currentField = '';
      } else {
        currentField += char;
      }
    }

    if (currentField || currentRow.length > 0) {
      currentRow.push(currentField.trim());
      if (currentRow.some((f) => f !== '')) {
        rows.push(currentRow);
      }
    }

    if (rows.length < 2) return [];

    const headers = rows[0].map((h) => h.toLowerCase().replace(/[*_]/g, '').trim());
    const dataRows = rows.slice(1);

    return dataRows.map((row, idx) => {
      const getVal = (...keys: string[]) => {
        for (const key of keys) {
          const foundIdx = headers.findIndex((h) => h.includes(key));
          if (foundIdx !== -1 && row[foundIdx] !== undefined) {
            return row[foundIdx].trim();
          }
        }
        return '';
      };

      const productName = getVal('tên sản phẩm', 'ten san pham', 'product', 'name');
      const sku = getVal('sku', 'mã sku', 'ma sku');
      const categoryName = getVal('danh mục', 'danh muc', 'category');
      const brandName = getVal('thương hiệu', 'thuong hieu', 'brand');
      const rawPrice = getVal('giá bán', 'gia ban', 'price', 'gia');
      const rawStock = getVal('tồn kho', 'ton kho', 'stock');
      const description = getVal('mô tả', 'mo ta', 'description');

      const cpu = getVal('cpu');
      const ram = getVal('ram');
      const storage = getVal('ổ cứng', 'o cung', 'storage', 'ssd', 'rom');
      const screen = getVal('màn hình', 'man hinh', 'screen');
      const battery = getVal('pin', 'battery');
      const os = getVal('hệ điều hành', 'he dieu hanh', 'os');

      const price = Number(rawPrice.replace(/[^0-9]/g, ''));
      const stock = Number(rawStock.replace(/[^0-9]/g, '')) || 0;

      const errors: string[] = [];
      if (!productName) errors.push('Thiếu tên sản phẩm');
      if (!price || price <= 0) errors.push('Giá bán không hợp lệ');

      const techSpecs: Record<string, string> = {};
      if (cpu) techSpecs['CPU'] = cpu;
      if (ram) techSpecs['RAM'] = ram;
      if (storage) techSpecs['Ổ cứng'] = storage;
      if (screen) techSpecs['Màn hình'] = screen;
      if (battery) techSpecs['Pin'] = battery;
      if (os) techSpecs['Hệ điều hành'] = os;

      return {
        rowNumber: idx + 2,
        Product_name: productName,
        sku: sku || `SKU_${Date.now()}_${idx + 1}`,
        Category_name: categoryName,
        Brand_name: brandName,
        Price: price || 0,
        Stock_quantity: stock,
        Description: description,
        Technical_specs: techSpecs,
        isValid: errors.length === 0,
        errorMessage: errors.join(', '),
      };
    });
  }

  submitBulkImport(): void {
    if (!this.canCreateProduct || this.isImporting) return;

    const validProducts = this.importedItems.filter((i) => i.isValid);
    if (validProducts.length === 0) {
      this.importError = 'Không có sản phẩm hợp lệ nào để nhập.';
      return;
    }

    this.isImporting = true;
    this.importError = '';

    const payload = validProducts.map((p) => ({
      Product_name: p.Product_name,
      sku: p.sku,
      Category_name: p.Category_name,
      Brand_name: p.Brand_name,
      Price: p.Price,
      Stock_quantity: p.Stock_quantity,
      Description: p.Description,
      Technical_specs: p.Technical_specs,
    }));

    this.productService
      .bulkImportProducts(payload)
      .pipe(
        finalize(() => {
          this.isImporting = false;
          this.changeDetectorRef.detectChanges();
        }),
      )
      .subscribe({
        next: (res) => {
          if (res?.success) {
            const count = res.data?.importedCount || validProducts.length;
            this.showToast(`Nhập thành công ${count} sản phẩm vào hệ thống.`, 'success');
            this.closeBulkImportModal();
            this.page = 1;
            this.loadProducts();
          } else {
            this.importError = res?.message || 'Không thể nhập sản phẩm hàng loạt.';
          }
        },
        error: (err: unknown) => {
          this.importError = this.getApiErrorMessage(
            err,
            'Không thể nhập sản phẩm hàng loạt. Vui lòng thử lại.',
          );
        },
      });
  }

  addProduct(): void {
    this.openCreateForm();
  }
}
