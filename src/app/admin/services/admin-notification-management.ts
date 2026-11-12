import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export type OperationalNotificationPriority = 'urgent' | 'important' | 'normal';
export type OperationalRecipientMode = 'all_staff' | 'specific_staff';
export type OperationalEntityType = 'order' | 'return' | 'review' | 'system';

export interface OperationalTargetEntity {
  entity_type: OperationalEntityType;
  entity_id?: string;
}

export interface DispatchAlertPayload {
  title: string;
  message: string;
  priority: OperationalNotificationPriority;
  recipient_mode: OperationalRecipientMode;
  recipient_ids?: string[];
  target_entity?: OperationalTargetEntity;
  link?: string;
  idempotency_key?: string;
  confirm_resend?: boolean;
}

export interface DispatchAlertResponseData {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: OperationalNotificationPriority;
  senderId?: string;
  senderName?: string;
  targetEntity?: {
    Entity_type?: string;
    Entity_id?: string;
  };
  link?: string;
  createdAt?: string;
  recipients?: Array<{
    userId: string;
    status: string;
    readAt: string | null;
    acknowledgedAt: string | null;
  }>;
}

export interface DispatchAlertResponse {
  success: boolean;
  message: string;
  isDuplicate?: boolean;
  data: DispatchAlertResponseData;
  code?: string;
  field?: string;
}

export interface SentNotificationRecipient {
  userId: string;
  status: 'sent' | 'acknowledged';
  readAt: string | null;
  acknowledgedAt: string | null;
}

export interface SentNotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: OperationalNotificationPriority;
  senderName?: string;
  audience?: string;
  createdAt: string;
  link?: string;
  targetEntity?: {
    Entity_type?: string;
    Entity_id?: string;
  };
  recipientCount?: number;
  acknowledgedCount?: number;
  recipients?: SentNotificationRecipient[];
}

export interface SentNotificationsData {
  items: SentNotificationItem[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface SentNotificationsResponse {
  success: boolean;
  data: SentNotificationsData;
  message?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminNotificationManagementService {
  private readonly apiUrl = `${environment.apiUrl}/admin/notifications`;

  constructor(private http: HttpClient) {}

  private withAuth<T>(request: (headers: HttpHeaders) => Observable<T>): Observable<T> {
    const token = localStorage.getItem('vista_admin_token');
    if (!token) {
      return throwError(() => new Error('Vui lòng đăng nhập lại để tiếp tục.'));
    }
    return request(new HttpHeaders({ Authorization: `Bearer ${token}` }));
  }

  /**
   * Phát thông báo vận hành từ Manager tới Staff
   */
  dispatchAlert(payload: DispatchAlertPayload): Observable<DispatchAlertResponse> {
    return this.withAuth((headers) =>
      this.http.post<DispatchAlertResponse>(`${this.apiUrl}/dispatch`, payload, { headers })
    );
  }

  /**
   * Lấy lịch sử thông báo Manager đã phát kèm trạng thái tiếp nhận của từng Staff (Dành cho Stage 3.2 tái sử dụng)
   */
  getSentAlerts(page = 1, limit = 20, priority?: string): Observable<SentNotificationsResponse> {
    return this.withAuth((headers) => {
      let params = new HttpParams().set('page', String(page)).set('limit', String(limit));
      if (priority) {
        params = params.set('priority', priority);
      }
      return this.http.get<SentNotificationsResponse>(`${this.apiUrl}/sent`, { headers, params });
    });
  }
}
