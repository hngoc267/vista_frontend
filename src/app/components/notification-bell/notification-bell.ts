import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  HostListener,
  Input,
  OnChanges,
  OnDestroy,
  OnInit,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  AppNotification,
  NotificationCenterService,
  NotificationPriority,
  NotificationStatus,
} from '../../services/notification-center.service';

const TOAST_DURATION_MS = 5000;

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule],
  providers: [NotificationCenterService],
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
})
export class NotificationBellComponent implements OnInit, OnChanges, OnDestroy {
  /** JWT của người đang đăng nhập (Admin hoặc khách hàng) */
  @Input() token: string | null = null;
  /** light: nền header sáng (Admin), dark: nền navbar tối (trang khách) */
  @Input() variant: 'light' | 'dark' = 'light';

  private readonly center = inject(NotificationCenterService);
  private readonly router = inject(Router);
  private readonly host = inject(ElementRef<HTMLElement>);
  private readonly cdr = inject(ChangeDetectorRef);
  private readonly subscriptions = new Subscription();
  private toastTimer?: ReturnType<typeof setTimeout>;

  items: AppNotification[] = [];
  unreadCount = 0;
  isOpen = false;
  toast: AppNotification | null = null;

  ngOnInit(): void {
    this.subscriptions.add(
      this.center.items$.subscribe((items) => {
        this.items = items;
        this.cdr.markForCheck();
      }),
    );
    this.subscriptions.add(
      this.center.unreadCount$.subscribe((count) => {
        this.unreadCount = count;
        this.cdr.markForCheck();
      }),
    );
    this.subscriptions.add(this.center.incoming$.subscribe((notification) => this.showToast(notification)));
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['token']) {
      this.center.connect(this.token);
    }
  }

  ngOnDestroy(): void {
    clearTimeout(this.toastTimer);
    this.subscriptions.unsubscribe();
  }

  get badgeText(): string {
    return this.unreadCount > 99 ? '99+' : String(this.unreadCount);
  }

  toggle(): void {
    this.isOpen = !this.isOpen;
    if (this.isOpen) {
      this.center.load();
    }
  }

  open(notification: AppNotification): void {
    this.center.markAsRead(notification);
    this.isOpen = false;
    this.hideToast();
    if (notification.link) {
      this.router.navigateByUrl(notification.link);
    }
  }

  acknowledge(event: Event, notification: AppNotification): void {
    event.stopPropagation();
    this.center.acknowledge(notification);
  }

  markAllAsRead(): void {
    this.center.markAllAsRead();
  }

  hideToast(): void {
    clearTimeout(this.toastTimer);
    this.toast = null;
    this.cdr.markForCheck();
  }

  getPriorityLabel(priority?: NotificationPriority): string {
    switch (priority) {
      case 'urgent':
        return 'Khẩn cấp';
      case 'important':
        return 'Quan trọng';
      case 'normal':
        return 'Bình thường';
      default:
        return '';
    }
  }

  getStatusLabel(status?: NotificationStatus): string {
    switch (status) {
      case 'acknowledged':
        return 'Đã tiếp nhận';
      case 'sent':
        return 'Chưa tiếp nhận';
      default:
        return '';
    }
  }

  timeAgo(value: string): string {
    const time = new Date(value).getTime();
    if (Number.isNaN(time)) return '';

    const seconds = Math.max(0, Math.floor((Date.now() - time) / 1000));
    if (seconds < 60) return 'Vừa xong';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} phút trước`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} giờ trước`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days} ngày trước`;
    return new Date(value).toLocaleDateString('vi-VN');
  }

  trackById(_: number, item: AppNotification): string {
    return item.id;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (this.isOpen && !this.host.nativeElement.contains(event.target as Node)) {
      this.isOpen = false;
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.isOpen = false;
  }

  private showToast(notification: AppNotification): void {
    clearTimeout(this.toastTimer);
    this.toast = notification;
    this.cdr.markForCheck();
    this.toastTimer = setTimeout(() => this.hideToast(), TOAST_DURATION_MS);
  }
}
