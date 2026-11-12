import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, map, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';

export type AssistantRole = 'Manager' | 'Staff';

export type AssistantIntent =
  | 'financial_kpi'
  | 'order_operational'
  | 'return_issue'
  | 'review_moderation'
  | 'general_policy'
  | 'unsupported';

export type AssistantStatus = 'answered' | 'role_denied' | 'unsupported' | 'error';

export interface AssistantHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantChatRequest {
  message: string;
  history?: AssistantHistoryItem[];
}

export interface AssistantChatResponse {
  status: AssistantStatus;
  role: AssistantRole;
  intent: AssistantIntent;
  answer: string;
  data_available: boolean;
}

@Injectable({ providedIn: 'root' })
export class AdminAssistantService {
  private readonly apiUrl = `${environment.apiUrl}/admin/assistant/chat`;

  constructor(private http: HttpClient) {}

  /**
   * Gửi câu hỏi đến VISTA AI Management Assistant
   * @param message Nội dung câu hỏi của Admin
   * @param history Lịch sử hội thoại trong phiên (tùy chọn)
   */
  sendMessage(
    message: string,
    history?: AssistantHistoryItem[]
  ): Observable<AssistantChatResponse> {
    const trimmedMessage = message?.trim();
    if (!trimmedMessage) {
      return throwError(() => new Error('Vui lòng nhập nội dung câu hỏi.'));
    }

    const token = typeof localStorage !== 'undefined'
      ? localStorage.getItem('vista_admin_token')
      : null;

    if (!token) {
      return throwError(
        () => new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.')
      );
    }

    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    });

    const payload: AssistantChatRequest = {
      message: trimmedMessage
    };

    if (Array.isArray(history) && history.length > 0) {
      // Chỉ gửi tối đa 6 lượt hội thoại gần nhất và đảm bảo đúng định dạng role/content
      payload.history = history
        .filter(
          (item) =>
            item &&
            (item.role === 'user' || item.role === 'assistant') &&
            typeof item.content === 'string' &&
            item.content.trim().length > 0
        )
        .slice(-6)
        .map((item) => ({
          role: item.role,
          content: item.content.trim().slice(0, 1000)
        }));
    }

    return this.http
      .post<any>(this.apiUrl, payload, { headers })
      .pipe(
        map((res: any) => {
          const d = res?.data || res;
          return {
            status: d.status || (res?.success ? 'answered' : 'error'),
            role: d.context?.role || d.role || 'Staff',
            intent: d.intent || 'unsupported',
            answer: d.message || d.answer || '',
            data_available: d.context ? d.context.data_available !== false : true
          } as AssistantChatResponse;
        }),
        catchError((error: HttpErrorResponse | Error) => {
          return throwError(() => this.formatErrorMessage(error));
        })
      );
  }

  /**
   * Định dạng thông báo lỗi tiếng Việt thân thiện, không làm lộ stack trace hoặc token
   */
  private formatErrorMessage(error: HttpErrorResponse | Error): Error {
    if (!(error instanceof HttpErrorResponse)) {
      return new Error(error.message || 'Đã xảy ra lỗi không xác định.');
    }

    if (error.status === 0) {
      return new Error(
        'Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối mạng hoặc thử lại sau.'
      );
    }

    if (error.status === 400) {
      const serverMsg = error.error?.error || error.error?.message;
      return new Error(
        serverMsg || 'Nội dung câu hỏi không hợp lệ hoặc vượt quá độ dài quy định.'
      );
    }

    if (error.status === 401) {
      return new Error('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');
    }

    if (error.status === 403) {
      return new Error('Bạn không có quyền truy cập chức năng này.');
    }

    if (error.status === 429) {
      return new Error(
        'Hệ thống AI đang nhận quá nhiều yêu cầu trong thời gian ngắn. Vui lòng chờ vài giây rồi thử lại.'
      );
    }

    if (error.status >= 500) {
      return new Error(
        'Máy chủ AI đang bận hoặc gặp sự cố xử lý. Vui lòng thử lại sau giây lát.'
      );
    }

    const genericMsg = error.error?.error || error.error?.message;
    return new Error(genericMsg || 'Đã xảy ra sự cố khi giao tiếp với Trợ lý AI.');
  }
}
