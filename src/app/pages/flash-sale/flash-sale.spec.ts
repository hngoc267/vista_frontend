import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlashSale } from './flash-sale';

describe('FlashSale', () => {
  let component: FlashSale;
  let fixture: ComponentFixture<FlashSale>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlashSale]
    }).compileComponents();

    fixture = TestBed.createComponent(FlashSale);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});