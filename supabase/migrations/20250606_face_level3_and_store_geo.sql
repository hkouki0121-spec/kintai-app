-- 店舗座標（GPS打刻範囲チェック用）
ALTER TABLE stores
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- face_descriptor は { pose, brightness, descriptor } の配列（最大10件）として利用
