import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, retry, timer } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = 'http://localhost:5000/api';

  constructor(private http: HttpClient) {}

  getAllProducts(filters?: any): Observable<any> {
    let params = new HttpParams();
    if (filters) {
      Object.keys(filters).forEach(key => {
        if (filters[key]) params = params.set(key, filters[key]);
      });
    }
    return this.http.get(`${this.apiUrl}/products`, { params }).pipe(
      retry({ count: 3, delay: 1000 })
    );
  }

  getFeaturedProducts(): Observable<any> {
    return this.http.get(`${this.apiUrl}/products/featured`).pipe(
      retry({ count: 3, delay: 1000 })
    );
  }

  getProductById(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/products/${id}`).pipe(
      retry({ count: 3, delay: 1000 })
    );
  }

  getRelatedProducts(id: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/products/${id}/related`).pipe(
      retry({ count: 3, delay: 1000 })
    );
  }

  getAllCategories(): Observable<any> {
    return this.http.get(`${this.apiUrl}/products/categories`).pipe(
      retry({ count: 3, delay: 1000 })
    );
  }

  getProductsByCategory(categoryId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/products/category/${categoryId}`).pipe(
      retry({ count: 3, delay: 1000 })
    );
  }

  getFlashSaleProducts() {
    return this.http.get<any>(`${this.apiUrl}/products/flash-sale`).pipe(
      retry({ count: 3, delay: 1000 })
    );
  }

  getAISuggestedProducts() {
    return this.http.get<any>(`${this.apiUrl}/products/ai-suggest`).pipe(
      retry({ count: 3, delay: 1000 })
    );
  }
}