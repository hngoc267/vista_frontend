import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CreateReviewPayload {
  Order_detail_id: string;
  Rating: number;
  Comment: string;
  Images: string[];
}

export interface ReviewResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
}

@Injectable({
  providedIn: 'root',
})
export class ReviewService {
  private readonly apiUrl = environment.apiUrl + '/reviews';

  constructor(private http: HttpClient) {}

  createReview(payload: CreateReviewPayload): Observable<ReviewResponse> {
    return this.http.post<ReviewResponse>(this.apiUrl, payload);
  }

  getReviewByOrderDetailId(orderDetailId: string): Observable<ReviewResponse> {
    return this.http.get<ReviewResponse>(
      this.apiUrl + '/order-detail/' + encodeURIComponent(orderDetailId)
    );
  }
}
