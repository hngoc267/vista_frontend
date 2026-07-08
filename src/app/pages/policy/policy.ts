import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute} from '@angular/router';

@Component({
  selector: 'app-policy',
  imports: [CommonModule],
  templateUrl: './policy.html',
  styleUrl: './policy.scss'
})
export class Policy implements OnInit {
  activeTab: string = 'shipping'; // Mặc định là tab Giao hàng

  constructor(private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParams.subscribe(params => {
      if (params['tab']) {
        this.activeTab = params['tab'];
      }
    });
  }

  setTab(tabName: string) {
    this.activeTab = tabName;
  }
}