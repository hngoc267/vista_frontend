import { TestBed } from '@angular/core/testing';

import { AiHistory } from './ai-history';

describe('AiHistory', () => {
  let service: AiHistory;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AiHistory);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
