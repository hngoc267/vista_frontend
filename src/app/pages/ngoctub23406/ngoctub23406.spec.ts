import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Ngoctub23406 } from './ngoctub23406';

describe('Ngoctub23406', () => {
  let component: Ngoctub23406;
  let fixture: ComponentFixture<Ngoctub23406>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Ngoctub23406],
    }).compileComponents();

    fixture = TestBed.createComponent(Ngoctub23406);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
