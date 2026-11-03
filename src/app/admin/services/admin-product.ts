import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export type AdminProductStatus = 'on_sale' | 'discontinued' | 'out_of_stock';
export type AdminProductSellingStatus = 'on_sale' | 'discontinued';
export type AdminProductVariantStatus = 'active' | 'out_of_stock';

export interface AdminCategory {
  _id?: string;
  __v?: number;
  Category_id: string;
  Category_name: string;
  Description?: string;
}

export interface AdminBrand {
  _id?: string;
  __v?: number;
  Brand_id: string;
  Brand_name: string;
  Description?: string;
  Origin_country?: string;
}

export interface AdminProductVariant {
  _id?: string;
  __v?: number;
  Product_variant_id: string;
  Product_id: string;
  Variant_name: string;
  Attributes?: unknown;
  Price: number;
  Stock_quantity: number;
  Status: AdminProductVariantStatus;
}

export interface AdminProduct {
  _id?: string;
  __v?: number;
  Product_id: string;
  Category_id: string;
  Brand_id: string;
  Product_name: string;
  Description?: string;
  Images: string[];
  Average_rating?: number;
  Total_reviews?: number;
  Technical_specs?: unknown;
  Status: AdminProductStatus;
  Discount?: number;
  Is_Flash_Sale?: boolean;
  Is_AI?: boolean;
  variants: AdminProductVariant[];
  category: AdminCategory | null;
  brand: AdminBrand | null;
}

export interface AdminProductQueryParams {
  page?: number;
  limit?: number;
  keyword?: string;
  categoryId?: string;
  brandId?: string;
  status?: AdminProductStatus;
  isFlashSale?: boolean;
  isAI?: boolean;
  minPrice?: number;
  maxPrice?: number;
}

export interface AdminProductListData {
  items: AdminProduct[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminProductListResponse {
  success: boolean;
  message?: string;
  data: AdminProductListData;
}

export interface AdminProductDetailResponse {
  success: boolean;
  message?: string;
  data: AdminProduct;
}

export interface AdminProductVariantCreateRequest {
  Variant_name: string;
  Attributes?: unknown;
  Price: number;
  Stock_quantity: number;
}

export interface AdminProductCreateRequest {
  Status?: AdminProductSellingStatus;
  Product_name: string;
  Category_id: string;
  Brand_id: string;
  Description?: string;
  Images?: string[];
  Technical_specs?: unknown;
  Discount?: number;
  Is_Flash_Sale?: boolean;
  Is_AI?: boolean;
  variants: AdminProductVariantCreateRequest[];
}

export interface AdminProductCreateResponse {
  success: boolean;
  message?: string;
  data: AdminProduct;
}

export interface AdminCatalogListResponse<T> {
  success: boolean;
  message?: string;
  data: T[];
}

@Injectable({ providedIn: 'root' })
export class AdminProductService {
  private readonly apiUrl = `${environment.apiUrl}/admin/products`;
  private readonly catalogApiUrl = `${environment.apiUrl}/products`;

  constructor(private readonly http: HttpClient) {}

  getProducts(params: AdminProductQueryParams = {}): Observable<AdminProductListResponse> {
    let httpParams = new HttpParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        httpParams = httpParams.set(key, String(value));
      }
    });

    return this.withAuth((headers) =>
      this.http.get<AdminProductListResponse>(this.apiUrl, {
        headers,
        params: httpParams,
      }),
    );
  }

  getProductById(id: string): Observable<AdminProductDetailResponse> {
    return this.withAuth((headers) =>
      this.http.get<AdminProductDetailResponse>(
        `${this.apiUrl}/${encodeURIComponent(id)}`,
        { headers },
      ),
    );
  }

  createProduct(request: AdminProductCreateRequest): Observable<AdminProductCreateResponse> {
    return this.withAuth((headers) =>
      this.http.post<AdminProductCreateResponse>(this.apiUrl, request, { headers }),
    );
  }

  updateProduct(
    id: string,
    request: AdminProductCreateRequest,
  ): Observable<AdminProductCreateResponse> {
    return this.withAuth((headers) =>
      this.http.put<AdminProductCreateResponse>(
        `${this.apiUrl}/${encodeURIComponent(id)}`,
        request,
        { headers },
      ),
    );
  }

  bulkImportProducts(products: any[]): Observable<{
    success: boolean;
    message?: string;
    data?: { importedCount: number; skippedCount: number; errors: any[] };
  }> {
    return this.withAuth((headers) =>
      this.http.post<{
        success: boolean;
        message?: string;
        data?: { importedCount: number; skippedCount: number; errors: any[] };
      }>(`${this.apiUrl}/bulk-import`, { products }, { headers }),
    );
  }

  getCategories(): Observable<AdminCatalogListResponse<AdminCategory>> {
    return this.http.get<AdminCatalogListResponse<AdminCategory>>(
      `${this.catalogApiUrl}/categories`,
    );
  }

  getBrands(): Observable<AdminCatalogListResponse<AdminBrand>> {
    return this.http.get<AdminCatalogListResponse<AdminBrand>>(
      `${this.catalogApiUrl}/brands`,
    );
  }

  private withAuth<T>(request: (headers: HttpHeaders) => Observable<T>): Observable<T> {
    const token = localStorage.getItem('vista_admin_token');
    if (!token) {
      return throwError(() => new Error('Vui lòng đăng nhập lại để tiếp tục.'));
    }

    return request(new HttpHeaders({ Authorization: `Bearer ${token}` }));
  }
}
