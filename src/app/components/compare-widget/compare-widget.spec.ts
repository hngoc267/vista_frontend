import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CompareWidget } from './compare-widget';

describe('CompareWidget', () => {
  let component: CompareWidget;
  let fixture: ComponentFixture<CompareWidget>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CompareWidget],
    }).compileComponents();

    fixture = TestBed.createComponent(CompareWidget);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
