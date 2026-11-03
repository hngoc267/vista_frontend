import { describe, expect, it } from 'vitest';
import { getAdminProductDisplayStatus } from './admin-product-status';

describe('getAdminProductDisplayStatus', () => {
  it.each([
    ['on_sale', 5, 'on_sale'],
    ['discontinued', 5, 'discontinued'],
    ['discontinued', 0, 'discontinued'],
    ['on_sale', 0, 'out_of_stock'],
    ['out_of_stock', 3, 'on_sale'],
    ['discontinued', 3, 'discontinued'],
  ] as const)('maps status %s with total stock %i to %s', (status, totalStock, expected) => {
    expect(getAdminProductDisplayStatus(status, totalStock)).toBe(expected);
  });
});
