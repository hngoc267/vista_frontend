import { TestBed } from '@angular/core/testing';

import { FlashSale } from './flash-sale';

describe('FlashSale', () => {
  let service: FlashSale;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(FlashSale);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
