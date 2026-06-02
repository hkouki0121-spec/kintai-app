-- 会社未紐付けの既存 Auth ユーザーを初期会社に紐付ける（任意）
-- 例: kouki.0121.07@icloud.com など register 前に作ったアカウント

INSERT INTO company_members (user_id, company_id, role)
SELECT u.id, c.id, 'company_admin'
FROM auth.users u
CROSS JOIN LATERAL (
  SELECT id FROM companies ORDER BY created_at ASC LIMIT 1
) c
WHERE NOT EXISTS (
  SELECT 1 FROM company_members cm WHERE cm.user_id = u.id
);

-- 確認
SELECT u.email, cm.role, cm.company_id, c.name AS company_name
FROM auth.users u
LEFT JOIN company_members cm ON cm.user_id = u.id
LEFT JOIN companies c ON c.id = cm.company_id
ORDER BY u.created_at DESC;
