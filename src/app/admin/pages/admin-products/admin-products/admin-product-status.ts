import type { AdminProductStatus } from '../../../services/admin-product';

export function getAdminProductDisplayStatus(
  status: AdminProductStatus,
  totalStock: number,
): AdminProductStatus {
  if (status === 'discontinued') {
    return 'discontinued';
  }

  return totalStock > 0 ? 'on_sale' : 'out_of_stock';
}
