export type Employee = {
  id: string;
  name: string;
  employee_code: string;
  hourly_rate: number;
  face_descriptor: number[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AttendanceRecord = {
  id: string;
  employee_id: string;
  clock_in: string;
  clock_out: string | null;
  created_at: string;
};

export type MonthlyPayroll = {
  id: string;
  employee_id: string;
  year: number;
  month: number;
  actual_regular_hours: number;
  actual_night_hours: number;
  regular_hours: number;
  night_hours: number;
  regular_pay: number;
  night_pay: number;
  total_pay: number;
  calculated_at: string;
};

export type EmployeeWithAttendance = AttendanceRecord & {
  employees: Pick<Employee, "id" | "name" | "employee_code" | "hourly_rate">;
};

export type PayrollWithEmployee = MonthlyPayroll & {
  employees: Pick<Employee, "id" | "name" | "employee_code">;
};
