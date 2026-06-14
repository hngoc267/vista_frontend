import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CartApiSummary {
  Cart_id: string;
  User_id: string;
  Total_product: number;
  Total_price: number;
}

export interface CartApiItem {
  cartItemId: string;
  cartId: string;
  productVariantId: string;
  productId: string | null;
  productName: string;
  variantName: string;
  specs: string;
  image: string;
  unitPrice: number;
  quantity: number;
  stockQuantity: number;
  lineTotal: number;
}

export interface CartApiResponse {
  success: boolean;
  data: {
    cart: CartApiSummary;
    items: CartApiItem[];
  };
}

@Injectable({
  providedIn: 'root',
})
export class CartService {
  private readonly apiUrl = `${environment.apiUrl}/cart`;

  constructor(private http: HttpClient) {}

  getCurrentUserId(): string | null {
    if (typeof localStorage === 'undefined') {
      return null;
    }

    const rawUser = localStorage.getItem('user');
    if (!rawUser) {
      return null;
    }

    try {
      const user = JSON.parse(rawUser);
      return user?.User_id || user?.userId || user?.id || null;
    } catch {
      return null;
    }
  }

  getCart(userId: string): Observable<CartApiResponse> {
    return this.http.get<CartApiResponse>(`${this.apiUrl}/${encodeURIComponent(userId)}`);
  }

  addToCart(userId: string, productVariantId: string, quantity = 1): Observable<CartApiResponse> {
    return this.http.post<CartApiResponse>(`${this.apiUrl}/items`, {
      userId,
      productVariantId,
      quantity,
    });
  }

  updateCartItem(cartItemId: string, quantity: number): Observable<CartApiResponse> {
    return this.http.patch<CartApiResponse>(`${this.apiUrl}/items/${encodeURIComponent(cartItemId)}`, {
      quantity,
    });
  }

  removeCartItem(cartItemId: string): Observable<CartApiResponse> {
    return this.http.delete<CartApiResponse>(`${this.apiUrl}/items/${encodeURIComponent(cartItemId)}`);
  }

  removeSelectedItems(userId: string, cartItemIds: string[]): Observable<CartApiResponse> {
    return this.http.delete<CartApiResponse>(`${this.apiUrl}/${encodeURIComponent(userId)}/items`, {
      body: {
        userId,
        cartItemIds,
      },
    });
  }
}
