import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReturnOrder } from './return-order';

describe('ReturnOrder', () => {
  let component: ReturnOrder;
  let fixture: ComponentFixture<ReturnOrder>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReturnOrder],
    }).compileComponents();

    fixture = TestBed.createComponent(ReturnOrder);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
