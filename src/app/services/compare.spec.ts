import { TestBed } from '@angular/core/testing';

import { Compare } from './compare';

describe('Compare', () => {
  let service: Compare;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Compare);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
