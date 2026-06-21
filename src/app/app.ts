import {
  Component,
  OnInit,
  ChangeDetectorRef
} from '@angular/core';

import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './components/navbar/navbar';
import { FooterComponent } from './components/footer/footer';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    RouterOutlet,
    NavbarComponent,
    FooterComponent,
    CommonModule
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App implements OnInit {

  title = 'vista-frontend';

  showSplash = true;
  isClosing = false;

  constructor(private cdr: ChangeDetectorRef) {}

  ngOnInit() {

    // Chờ splash hiển thị
    setTimeout(() => {

      // bắt đầu fade-out
      this.isClosing = true;
      this.cdr.detectChanges();

      // chờ animation kết thúc rồi mới ẩn
      setTimeout(() => {
        this.showSplash = false;
        this.cdr.detectChanges();
      }, 1000);

    }, 5000);
  }
}