import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CriteriaPage } from './criteria-page';

describe('CriteriaPage', () => {
  let component: CriteriaPage;
  let fixture: ComponentFixture<CriteriaPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CriteriaPage],
    }).compileComponents();

    fixture = TestBed.createComponent(CriteriaPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
