import { TestBed } from '@angular/core/testing';

import { Voucher } from './voucher';

describe('Voucher', () => {
  let service: Voucher;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Voucher);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
