/** 社員コード重複時のエラーメッセージ */
export const DUPLICATE_EMPLOYEE_CODE_MESSAGE =
  "この社員コードはすでに使用されています。別の社員コードを入力してください。";

/** 社員コード未入力時のエラーメッセージ */
export const EMPTY_EMPLOYEE_CODE_MESSAGE = "社員コードを入力してください。";

/** 従業員一覧の select 列（DBに存在するカラムのみ） */
export const EMPLOYEE_SELECT_COLUMNS =
  "id, company_id, name, employee_code, store_id, hourly_rate, face_descriptor, is_active, created_at, updated_at";
