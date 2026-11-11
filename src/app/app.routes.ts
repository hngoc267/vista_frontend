import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { ProductList } from './pages/product-list/product-list';
import { ProductDetail } from './pages/product-detail/product-detail';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Policy } from './pages/policy/policy';
import { ForgotPassword } from './pages/forgot-password/forgot-password';
import { Profile } from './pages/profile/profile';
import { VerifyCode } from './pages/verify-code/verify-code';
import { ResetPassword } from './pages/reset-password/reset-password';
import { AuthGuard } from './guards/auth-guard';

import { Cart } from './pages/cart/cart';
import { Wishlist } from './pages/wishlist/wishlist';
import { Voucher } from './pages/voucher/voucher';
import { Order } from './pages/order/order';
import { OrderHistory } from './pages/order-history/order-history';
import { ReturnOrder } from './pages/return-order/return-order';
import { FlashSale } from './pages/flash-sale/flash-sale';
import { Review } from './pages/review/review';
import { ComparePageComponent } from './pages/compare-page/compare-page';

import { CriteriaPage } from './pages/ai-compare/criteria-page/criteria-page';
import { ResultPage } from './pages/ai-compare/result-page/result-page';
import { HistoryPage } from './pages/ai-compare/history-page/history-page';
import { AiAssistantComponent } from './pages/ai-assistant/ai-assistant';
import { AdminLogin } from './admin/pages/admin-login/admin-login';
import { AdminLayoutComponent } from './admin/layouts/admin-layout/admin-layout';
import { AdminGuard } from './guards/admin-guard';
import { AdminForgotPassword } from './admin/pages/admin-forgot-password/admin-forgot-password';
import { AdminVerifyOtp } from './admin/pages/admin-verify-otp/admin-verify-otp';
import { AdminResetPassword } from './admin/pages/admin-reset-password/admin-reset-password';
import { AdminDashboard } from './admin/pages/admin-dashboard/admin-dashboard';
import { AdminChangePassword } from './admin/pages/admin-change-password/admin-change-password';
import { AdminOrders } from './admin/pages/admin-orders/admin-orders';
import { AdminReviews } from './admin/pages/admin-reviews/admin-reviews';
import { AdminProducts } from './admin/pages/admin-products/admin-products/admin-products';
import { AdminStaff } from './admin/pages/admin-staff/admin-staff';
import { adminManagerGuard } from './guards/admin-manager-guard';
import { AdminReturnsComponent } from './admin/pages/admin-returns/admin-returns';
import { AdminPromotionsComponent } from './admin/pages/admin-promotions/admin-promotions';
import { AdminCustomersComponent } from './admin/pages/admin-customers/admin-customers';

export const routes: Routes = [
  // =========================
  // ADMIN
  // =========================
  // ADMIN
  { path: 'admin/login', component: AdminLogin },
  {
    path: 'admin/forgot-password',
    component: AdminForgotPassword,
  },
  {
    path: 'admin/verify-otp',
    component: AdminVerifyOtp,
  },
  {
    path: 'admin/reset-password',
    component: AdminResetPassword,
  },
  {
    path: 'admin',
    component: AdminLayoutComponent,
    canActivate: [AdminGuard],
    canActivateChild: [AdminGuard],
    children: [
      {
        path: 'change-password',
        component: AdminChangePassword,
        data: { breadcrumb: 'Đổi mật khẩu' },
      },
      {
        path: 'dashboard',
        component: AdminDashboard,
        canActivate: [adminManagerGuard],
        data: { breadcrumb: 'Tổng quan' },
      },
      {
        path: 'orders',
        component: AdminOrders,
        data: { breadcrumb: 'Xử lý đơn hàng' },
      },
      {
        path: 'reviews',
        component: AdminReviews,
        data: { breadcrumb: 'Kiểm duyệt đánh giá' },
      },
      {
        path: 'staff',
        component: AdminStaff,
        canActivate: [adminManagerGuard],
        data: { breadcrumb: 'Quản lý nhân sự' },
      },
      {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full',
      },
      {
        path: 'products',
        component: AdminProducts,
        data: { breadcrumb: 'Danh mục sản phẩm' },
      },
      {
        path: 'returns',
        component: AdminReturnsComponent,
        data: { breadcrumb: 'Hậu mãi & Đổi trả' },
      },
      {
        path: 'promotions',
        component: AdminPromotionsComponent,
        data: { breadcrumb: 'Quản lý voucher' },
      },
      {
        path: 'customers',
        component: AdminCustomersComponent,
        data: { breadcrumb: 'Quản lý khách hàng' },
      },
    ],
  },

  // =========================
  // USER
  // =========================
  { path: '', component: Home },
  { path: 'products', component: ProductList },
  { path: 'products/:id', component: ProductDetail },

  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'verify-code', component: VerifyCode },
  { path: 'reset-password', component: ResetPassword },

  { path: 'profile', component: Profile, canActivate: [AuthGuard] },
  { path: 'cart', component: Cart },
  { path: 'wishlist', component: Wishlist },
  { path: 'voucher', component: Voucher },
  { path: 'order', component: Order },
  { path: 'order-history', component: OrderHistory, canActivate: [AuthGuard] },
  { path: 'return-order', component: ReturnOrder },

  { path: 'flash-sale', component: FlashSale },
  { path: 'review', component: Review, canActivate: [AuthGuard] },
  { path: 'policy', component: Policy },

  { path: 'compare', component: ComparePageComponent },
  { path: 'ai-assistant', component: AiAssistantComponent, canActivate: [AuthGuard] },
  { path: 'ai-compare', component: CriteriaPage },
  { path: 'ai-result', component: ResultPage },
  { path: 'ai-history', component: HistoryPage },

  // Đặt route wildcard cuối cùng
  { path: '**', redirectTo: '' }
];