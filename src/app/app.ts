import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar';
import { FooterComponent } from './components/footer/footer';
import { CommonModule } from '@angular/common';
import { CompareWidgetComponent } from './components/compare-widget/compare-widget';
import { HostListener } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    NavbarComponent,
    FooterComponent,
    CompareWidgetComponent,
    CommonModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {

  title = 'vista-frontend';

  showSplash = true;
  isClosing = false;
  showScrollTop = false;
  constructor(private cdr: ChangeDetectorRef,private router: Router) {}

  ngOnInit() {
    setTimeout(() => {
      this.isClosing = true;
      this.cdr.detectChanges();

      setTimeout(() => {
        this.showSplash = false;
        this.cdr.detectChanges();
      }, 1000);
    }, 5000);
  }
  @HostListener('window:scroll')
  onScroll() {
    const url = this.router.url;
    const isAllowed = url === '/' || url === '' || url.startsWith('/products');
    this.showScrollTop = isAllowed && window.scrollY > 300;
  }

  scrollToTop() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }
}
