import { Routes } from '@angular/router';
import { Home } from './pages/home/home';
import { ProductList } from './pages/product-list/product-list';
import { ProductDetail } from './pages/product-detail/product-detail';
import { Login } from './pages/login/login';
import { Register } from './pages/register/register';
import { Policy } from './pages/policy/policy';
import { ForgotPassword } from './pages/forgot-password/forgot-password';
import { Profile } from './pages/profile/profile';
import { VerifyCode } from './pages/verify-code/verify-code'; // <-- Thêm dòng này
import { ResetPassword } from './pages/reset-password/reset-password'; // <-- Thêm dòng này
import { AuthGuard } from './guards/auth-guard';
import {Cart} from "./pages/cart/cart";

export const routes: Routes = [
  { path: 'profile', component: Profile, canActivate: [AuthGuard] },
  { path: 'cart', component: Cart },
  { path: '', component: Home },
  { path: 'products', component: ProductList },
  { path: 'products/:id', component: ProductDetail },
  { path: 'login', component: Login },
  { path: 'register', component: Register },
  { path: 'forgot-password', component: ForgotPassword },
  { path: 'verify-code', component: VerifyCode }, // <-- Thêm dòng này
  { path: 'reset-password', component: ResetPassword }, // <-- Thêm dòng này
  { path: 'profile', component: Profile },
  { path: 'policy', component: Policy },
  { path: '**', redirectTo: '' }
];