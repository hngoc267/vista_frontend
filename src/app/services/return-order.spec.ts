import { TestBed } from '@angular/core/testing';

import { ReturnOrder } from './return-order';

describe('ReturnOrder', () => {
  let service: ReturnOrder;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ReturnOrder);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
