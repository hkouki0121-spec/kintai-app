export type CompanyRole = "super_admin" | "company_admin";

export type Company = {
  id: string;
  name: string;
  is_active: boolean;
  payroll_rounding_minutes?: 1 | 15 | 30;
  created_at: string;
};

export type CompanyMember = {
  id: string;
  user_id: string;
  company_id: string | null;
  role: CompanyRole;
  created_at: string;
};

export type LineGroup = {
  id: string;
  group_id: string;
  group_name: string | null;
  company_id: string | null;
  last_seen_at: string;
  created_at: string;
};

export type Store = {
  id: string;
  company_id: string;
  name: string;
  address: string | null;
  phone: string | null;
  manager_name: string | null;
  line_user_id: string | null;
  line_group_id: string | null;
  line_notify_enabled: boolean;
  is_active: boolean;
  qr_token_hash: string | null;
  qr_token_updated_at: string | null;
  created_at: string;
};

export type FacePose = "front" | "left" | "right";
export type FaceBrightness = "normal" | "bright" | "dark";

export type FaceDescriptorEntry = {
  pose: FacePose;
  brightness: FaceBrightness;
  descriptor: number[];
};

export type Employee = {
  id: string;
  company_id: string;
  name: string;
  employee_code: string;
  store_id: string;
  hourly_rate: number;
  job_title?: string | null;
  hired_at?: string | null;
  face_descriptor: FaceDescriptorEntry[] | number[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AttendanceRecord = {
  id: string;
  company_id: string;
  employee_id: string;
  store_id: string;
  clock_in: string;
  clock_out: string | null;
  is_qr_clock: boolean;
  created_at: string;
};

export type AttendanceCorrection = {
  id: string;
  attendance_record_id: string;
  employee_id: string | null;
  company_id: string | null;
  store_id: string | null;
  before_clock_in: string | null;
  before_clock_out: string | null;
  after_clock_in: string | null;
  after_clock_out: string | null;
  reason: string;
  corrected_by: string | null;
  created_at: string;
  corrected_by_email?: string | null;
};

export type MonthlyPayroll = {
  id: string;
  company_id: string;
  employee_id: string;
  year: number;
  month: number;
  actual_regular_hours: number;
  actual_night_hours: number;
  actual_total_hours: number;
  attendance_days: number;
  overtime_hours: number;
  regular_hours: number;
  night_hours: number;
  regular_pay: number;
  night_pay: number;
  total_pay: number;
  calculated_at: string;
};

export type BackupRun = {
  id: string;
  company_id: string;
  backup_date: string;
  status: "success" | "failed";
  files: string[] | unknown;
  error_message: string | null;
  created_at: string;
};

export type EmployeeWithStore = Employee & {
  stores: Pick<Store, "id" | "name"> | null;
};

export type EmployeeWithAttendance = AttendanceRecord & {
  employees: Pick<Employee, "id" | "name" | "employee_code" | "hourly_rate" | "store_id"> & {
    stores: Pick<Store, "id" | "name"> | null;
  };
};

export type PayrollWithEmployee = MonthlyPayroll & {
  employees: Pick<Employee, "id" | "name" | "employee_code" | "hourly_rate" | "store_id"> & {
    stores: Pick<Store, "id" | "name"> | null;
  };
};
