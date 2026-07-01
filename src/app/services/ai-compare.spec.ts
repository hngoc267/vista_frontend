import { TestBed } from '@angular/core/testing';

import { AiCompare } from './ai-compare';

describe('AiCompare', () => {
  let service: AiCompare;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AiCompare);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
