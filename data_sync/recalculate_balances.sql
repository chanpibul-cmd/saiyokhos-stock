INSERT OR REPLACE INTO item_balances (
  item_code, total_in_qty, total_in_val, total_out_qty, total_out_val,
  balance_qty, avg_unit_price, balance_val, stock_status,
  last_buy_date, last_pay_date, last_movement_date, updated_at
)
SELECT 
  i.item_code,
  ROUND(COALESCE(b.in_qty, 0), 2),
  ROUND(COALESCE(b.in_val, 0), 2),
  ROUND(COALESCE(p.out_qty, 0), 2),
  ROUND(COALESCE(p.out_val, 0), 2),
  ROUND(COALESCE(b.in_qty, 0) - COALESCE(p.out_qty, 0), 2),
  CASE WHEN COALESCE(b.in_qty, 0) > 0 THEN ROUND(COALESCE(b.in_val, 0) / COALESCE(b.in_qty, 0), 2) ELSE 0 END,
  CASE 
    WHEN ROUND(COALESCE(b.in_qty, 0) - COALESCE(p.out_qty, 0), 2) <= 0 THEN 0
    ELSE ROUND(ROUND(COALESCE(b.in_qty, 0) - COALESCE(p.out_qty, 0), 2) * (CASE WHEN COALESCE(b.in_qty, 0) > 0 THEN (COALESCE(b.in_val, 0) / COALESCE(b.in_qty, 0)) ELSE 0 END), 2)
  END,
  CASE 
    WHEN ROUND(COALESCE(b.in_qty, 0) - COALESCE(p.out_qty, 0), 2) <= 0 THEN 'OUT_OF_STOCK'
    WHEN ROUND(COALESCE(b.in_qty, 0) - COALESCE(p.out_qty, 0), 2) <= i.min_stock THEN 'LOW_STOCK'
    ELSE 'NORMAL'
  END,
  b.last_buy,
  p.last_pay,
  CASE 
    WHEN b.last_buy IS NOT NULL AND p.last_pay IS NOT NULL THEN (CASE WHEN b.last_buy > p.last_pay THEN b.last_buy ELSE p.last_pay END)
    WHEN b.last_buy IS NOT NULL THEN b.last_buy
    ELSE p.last_pay
  END,
  CURRENT_TIMESTAMP
FROM items i
LEFT JOIN (
  SELECT item_code, SUM(quantity) as in_qty, SUM(total_price) as in_val, MAX(doc_date) as last_buy
  FROM buys GROUP BY item_code
) b ON i.item_code = b.item_code
LEFT JOIN (
  SELECT item_code, SUM(quantity) as out_qty, SUM(total_price) as out_val, MAX(doc_date) as last_pay
  FROM pays GROUP BY item_code
) p ON i.item_code = p.item_code;
