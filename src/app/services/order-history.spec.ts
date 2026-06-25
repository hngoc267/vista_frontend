import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { OrderHistory } from './order-history';

describe('OrderHistory', () => {
  let service: OrderHistory;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
    });
    service = TestBed.inject(OrderHistory);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});

