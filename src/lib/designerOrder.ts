import { designersList, type Designer } from '../data/designers';

/**
 * Returns the designer seed list in display order.
 * Currently returns the static list as-is; in the future this could
 * fetch a server-defined ordering or apply A/B-test shuffling.
 */
export async function loadOrderedDesignerSeeds(): Promise<Designer[]> {
  return designersList;
}
