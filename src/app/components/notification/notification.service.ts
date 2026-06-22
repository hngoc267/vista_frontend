import { Injectable } from '@angular/core';
import { Observable, Subject } from 'rxjs';

export type NotificationType = 'success' | 'error' | 'info';

export interface NotificationMessage {
  id: number;
  type: NotificationType;
  message: string;
}

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly notificationsSubject = new Subject<NotificationMessage>();
  readonly notifications$: Observable<NotificationMessage> = this.notificationsSubject.asObservable();

  success(message: string): void {
    this.emit('success', message);
  }

  error(message: string): void {
    this.emit('error', message);
  }

  info(message: string): void {
    this.emit('info', message);
  }

  private emit(type: NotificationType, message: string): void {
    const trimmedMessage = String(message || '').trim();
    if (!trimmedMessage) {
      return;
    }

    this.notificationsSubject.next({
      id: Date.now(),
      type,
      message: trimmedMessage,
    });
  }
}
