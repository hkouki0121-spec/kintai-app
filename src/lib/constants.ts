/** 22時以降の時給倍率 */
export const NIGHT_RATE_MULTIPLIER = 1.25;

/** 顔認証の一致しきい値（ユークリッド距離、小さいほど一致） */
export const FACE_MATCH_THRESHOLD = 0.55;

/** 日本タイムゾーン */
export const TIMEZONE = "Asia/Tokyo";

/** 給与明細の会社名 */
export const COMPANY_NAME = "炭火焼肉 笑門来福";

/** 給与計算対象とする勤務区間の最短時間（分） */
export const MIN_WORK_MINUTES = 15;

/** 1日の法定労働時間（残業計算用） */
export const DAILY_STATUTORY_HOURS = 8;

export const DAILY_STATUTORY_MINUTES = DAILY_STATUTORY_HOURS * 60;
