-- 供花の入金を請求先単位（FLOWER_TARGET）から供花1件ごと（FLOWER）へ移す。
-- 最新の入金記録が「入金済み」の請求先について、中の供花すべてに入金済みの記録を作る。
-- 入金日・登録者は元の記録から引き継ぎ、金額は供花ごとの税込額（金額 + 10% 四捨五入。lib/flowerTotals.ts と同じ計算）。
-- 元の請求先単位の記録は履歴として残す（以後はどこからも参照しない）。
-- 種別 FLOWER の追加（前のマイグレーション）と同じトランザクションでは新しい値を使えないため、別ファイルにしている。

WITH latest_target_payment AS (
    SELECT DISTINCT ON (flower_billing_target_id)
        flower_billing_target_id, status, paid_at, created_by_id
    FROM payments
    WHERE target_type = 'FLOWER_TARGET' AND flower_billing_target_id IS NOT NULL
    ORDER BY flower_billing_target_id, created_at DESC, id DESC
)
INSERT INTO payments (customer_id, target_type, status, paid_at, amount, memo, created_by_id, flower_id, created_at, updated_at)
SELECT
    f.customer_id,
    'FLOWER',
    'PAID',
    l.paid_at,
    f.amount + ROUND(f.amount * 0.1)::int,
    '請求先単位の入金から移行',
    l.created_by_id,
    f.id,
    NOW(),
    NOW()
FROM latest_target_payment l
JOIN flower_billing_target_items i ON i.flower_billing_target_id = l.flower_billing_target_id
JOIN flowers f ON f.id = i.flower_id
WHERE l.status = 'PAID'
  -- 再実行しても二重にならないよう、すでに供花単位の記録がある供花は除く
  AND NOT EXISTS (SELECT 1 FROM payments p WHERE p.target_type = 'FLOWER' AND p.flower_id = f.id);
