/** Minimal DB row shapes for inventory (manual; not generated). */

export type DbAppRole = "owner" | "staff";
export type DbPhoneStatus = "in_stock" | "sold" | "pending" | "cancelled";
export type DbAccessoryStatus = "in_stock" | "out_of_stock" | "cancelled";
export type DbSaleStatus = "completed" | "cancelled";
export type DbSaleItemType = "phone" | "accessory";
export type DbPaymentMethod = "cash" | "transfer" | "card" | "other";

export type DbStore = {
  id: string;
  code: string;
  name: string;
  is_active: boolean;
};

export type DbProfile = {
  id: string;
  email: string;
  full_name: string;
  role: DbAppRole;
  store_id: string;
  is_active: boolean;
};

export type DbPhone = {
  id: string;
  store_id: string;
  brand: string;
  model_name: string;
  imei: string;
  color: string;
  storage: string;
  made_in: string;
  network_version: string;
  battery_condition: string;
  battery_capacity: string;
  condition: string;
  note: string;
  import_date: string | null;
  sale_date: string | null;
  cost: number;
  expected_price: number;
  status: DbPhoneStatus;
  created_at?: string;
  updated_at?: string;
};

export type DbAccessory = {
  id: string;
  store_id: string;
  code: string;
  name: string;
  quantity: number;
  cost: number;
  price: number;
  status: DbAccessoryStatus;
  created_at?: string;
  updated_at?: string;
};

export type DbLookupItem = {
  id: string;
  category_id: string;
  code: string;
  label: string;
  sort_order: number;
  is_active: boolean;
  is_system: boolean;
  created_by: string | null;
};

export type DbPhoneInsert = {
  store_id: string;
  brand: string;
  model_name: string;
  imei: string;
  color?: string;
  storage?: string;
  made_in?: string;
  network_version?: string;
  battery_condition?: string;
  battery_capacity?: string;
  condition?: string;
  note?: string;
  import_date?: string | null;
  sale_date?: string | null;
  cost: number;
  expected_price: number;
  status?: DbPhoneStatus;
  created_by?: string | null;
  updated_by?: string | null;
};

export type DbAccessoryInsert = {
  store_id: string;
  code: string;
  name: string;
  quantity: number;
  cost: number;
  price: number;
  status?: DbAccessoryStatus;
  created_by?: string | null;
  updated_by?: string | null;
};
