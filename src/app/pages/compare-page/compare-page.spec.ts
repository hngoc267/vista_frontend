import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ComparePage } from './compare-page';

describe('ComparePage', () => {
  let component: ComparePage;
  let fixture: ComponentFixture<ComparePage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ComparePage],
    }).compileComponents();

    fixture = TestBed.createComponent(ComparePage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
