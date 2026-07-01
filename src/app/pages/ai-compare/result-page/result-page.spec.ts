import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ResultPage } from './result-page';

describe('ResultPage', () => {
  let component: ResultPage;
  let fixture: ComponentFixture<ResultPage>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ResultPage],
    }).compileComponents();

    fixture = TestBed.createComponent(ResultPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
