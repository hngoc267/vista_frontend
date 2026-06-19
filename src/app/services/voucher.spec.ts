import { TestBed } from '@angular/core/testing';

import { VoucherService } from './voucher';

describe('VoucherService', () => {
  let service: VoucherService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(VoucherService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});