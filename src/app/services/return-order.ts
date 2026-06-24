import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface ReturnOrderItemPayload {
  Product_variant_id: string;
  Quantity: number;
}

export interface CreateReturnOrderPayload {
  Order_id: string;
  Reason_type: string;
  Description: string;
  Evidence_images: string[];
  Refund_amount: number;
  Return_name: string;
  Return_phone: string;
  Return_email: string;
  Return_address: string;
  items: ReturnOrderItemPayload[];
}

export interface ReturnOrderResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

@Injectable({
  providedIn: 'root',
})
export class ReturnOrder {
  private readonly apiUrl = environment.apiUrl + '/return-orders';

  constructor(private http: HttpClient) {}

  createReturnOrder(payload: CreateReturnOrderPayload): Observable<ReturnOrderResponse> {
    return this.http.post<ReturnOrderResponse>(this.apiUrl, payload);
  }

  getReturnOrderByOrderId(orderId: string): Observable<ReturnOrderResponse> {
    return this.http.get<ReturnOrderResponse>(this.apiUrl + '/' + encodeURIComponent(orderId));
  }
}
