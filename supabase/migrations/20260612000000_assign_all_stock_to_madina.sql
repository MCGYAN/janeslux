-- ============================================================================
-- ONE-OFF DATA FIX: assign ALL current product stock to the Madina branch.
-- Adenta starts empty; stock it later from Admin -> Inventory (with the
-- Adenta branch selected) or Admin -> Branches.
--
-- Safe to re-run. The sync trigger keeps products.quantity = SUM(branch
-- quantities), so global totals are unchanged by this move.
-- ============================================================================

WITH totals AS (
  SELECT product_id, SUM(quantity) AS total
  FROM public.branch_inventory
  GROUP BY product_id
)
UPDATE public.branch_inventory bi
SET quantity   = CASE WHEN b.slug = 'madina' THEN t.total ELSE 0 END,
    updated_at = now()
FROM public.branches b, totals t
WHERE bi.branch_id  = b.id
  AND bi.product_id = t.product_id
  AND b.slug IN ('adenta', 'madina');

-- Verification (run separately if you want to check the result):
-- SELECT p.name, b.name AS branch, bi.quantity
-- FROM public.branch_inventory bi
-- JOIN public.products p ON p.id = bi.product_id
-- JOIN public.branches b ON b.id = bi.branch_id
-- ORDER BY p.name, b.sort_order;
