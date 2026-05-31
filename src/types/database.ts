export type Store = {
  id: string;
  name: string;
  address: string | null;
  phone: string | null;
  manager_name: string | null;
  line_user_id: string | null;
  line_group_id: string | null;
  line_notify_enabled: boolean;
  is_active: boolean;
  created_at: string;
};

export type Employee = {
  id: string;
  name: string;
  employee_code: string;
  store_id: string;
  hourly_rate: number;
  face_descriptor: number[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type AttendanceRecord = {
  id: string;
  employee_id: string;
  store_id: string;
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

export type EmployeeWithStore = Employee & {
  stores: Pick<Store, "id" | "name"> | null;
};

export type EmployeeWithAttendance = AttendanceRecord & {
  employees: Pick<Employee, "id" | "name" | "employee_code" | "hourly_rate" | "store_id"> & {
    stores: Pick<Store, "id" | "name"> | null;
  };
};

export type PayrollWithEmployee = MonthlyPayroll & {
  employees: Pick<Employee, "id" | "name" | "employee_code" | "store_id"> & {
    stores: Pick<Store, "id" | "name"> | null;
  };
};
