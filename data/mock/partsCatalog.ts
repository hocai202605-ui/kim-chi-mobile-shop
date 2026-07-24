/**
 * Seed mock LINH KIỆN — Phase A UI only (chưa bắt buộc API/DB).
 * Shape khớp Phase B `part_catalog_items` để wire sau ít sửa.
 */

export type PartCatalogCategory = "man_android" | "man_iphone" | "pin";

export type PartGradeCell = {
  cost?: number | null;
  price?: number | null;
  qty?: number | null;
  sub?: string | null;
};

export type PartCatalogItem = {
  id: string;
  storeId: "store-1" | "store-2" | "store-3";
  category: PartCatalogCategory;
  brandGroup: string;
  name: string;
  note: string;
  grades: Record<string, PartGradeCell>;
  status: "active" | "hidden";
};

let mockIdSeq = 1;
export function nextPartCatalogMockId(): string {
  mockIdSeq += 1;
  return `part-cat-mock-${mockIdSeq}`;
}

/** Seed demo (store-1) — rút gọn từ Excel Kim Chi. */
export const PART_CATALOG_MOCK_SEED: PartCatalogItem[] = [
  {
    id: "part-cat-mock-a1",
    storeId: "store-1",
    category: "man_android",
    brandGroup: "samsung",
    name: "A10 - M10",
    note: "",
    grades: { default: { cost: 155, price: 400, qty: 1 } },
    status: "active",
  },
  {
    id: "part-cat-mock-a2",
    storeId: "store-1",
    category: "man_android",
    brandGroup: "samsung",
    name: "A11 - M11",
    note: "",
    grades: { default: { cost: 180, price: 450, qty: 1 } },
    status: "active",
  },
  {
    id: "part-cat-mock-a3",
    storeId: "store-1",
    category: "man_android",
    brandGroup: "samsung",
    name: "A13",
    note: "",
    grades: { default: { cost: 180, price: 450, qty: 1 } },
    status: "active",
  },
  {
    id: "part-cat-mock-a4",
    storeId: "store-1",
    category: "man_android",
    brandGroup: "samsung",
    name: "A20s",
    note: "",
    grades: { default: { cost: 180, price: 450, qty: 2 } },
    status: "active",
  },
  {
    id: "part-cat-mock-a5",
    storeId: "store-1",
    category: "man_android",
    brandGroup: "samsung",
    name: "J7 Prime Trắng",
    note: "",
    grades: { default: { cost: 180, price: 400, qty: 1 } },
    status: "active",
  },
  {
    id: "part-cat-mock-o1",
    storeId: "store-1",
    category: "man_android",
    brandGroup: "oppo_realme",
    name: "A3S - A5 - C1 - C2",
    note: "",
    grades: { default: { cost: 145, price: 400, qty: 1 } },
    status: "active",
  },
  {
    id: "part-cat-mock-o2",
    storeId: "store-1",
    category: "man_android",
    brandGroup: "oppo_realme",
    name: "A5S - A7 - A12 - RM3",
    note: "",
    grades: { default: { cost: 160, price: 400, qty: 1 } },
    status: "active",
  },
  {
    id: "part-cat-mock-o3",
    storeId: "store-1",
    category: "man_android",
    brandGroup: "oppo_realme",
    name: "F7",
    note: "",
    grades: { default: { cost: 170, price: 450, qty: 2 } },
    status: "active",
  },
  {
    id: "part-cat-mock-o4",
    storeId: "store-1",
    category: "man_android",
    brandGroup: "oppo_realme",
    name: "Realme 6 - Realme 7",
    note: "",
    grades: { default: { cost: 205, price: 500, qty: 1 } },
    status: "active",
  },
  {
    id: "part-cat-mock-x1",
    storeId: "store-1",
    category: "man_android",
    brandGroup: "xiaomi_poco",
    name: "Redmi 9 - 9A - 9C - 10A",
    note: "",
    grades: { default: { cost: 160, price: 400, qty: 2 } },
    status: "active",
  },
  {
    id: "part-cat-mock-x2",
    storeId: "store-1",
    category: "man_android",
    brandGroup: "xiaomi_poco",
    name: "Note 7",
    note: "",
    grades: { default: { cost: 185, price: 450, qty: 1 } },
    status: "active",
  },
  {
    id: "part-cat-mock-x3",
    storeId: "store-1",
    category: "man_android",
    brandGroup: "xiaomi_poco",
    name: "Note 13 4g (Zin)",
    note: "",
    grades: { default: { cost: null, price: 1600, qty: 0 } },
    status: "active",
  },
  {
    id: "part-cat-mock-i1",
    storeId: "store-1",
    category: "man_iphone",
    brandGroup: "",
    name: "X",
    note: "",
    grades: {
      zin: { price: 1550 },
      lo: { price: 500 },
      lo_xin: { price: null },
      gx: { price: 750 },
    },
    status: "active",
  },
  {
    id: "part-cat-mock-i2",
    storeId: "store-1",
    category: "man_iphone",
    brandGroup: "",
    name: "11",
    note: "",
    grades: {
      zin: { price: 950 },
      lo: { price: 0 },
      lo_xin: { price: null },
      gx: { price: 500 },
    },
    status: "active",
  },
  {
    id: "part-cat-mock-i3",
    storeId: "store-1",
    category: "man_iphone",
    brandGroup: "",
    name: "11 Pro",
    note: "",
    grades: {
      zin: { price: 0 },
      lo: { price: 600 },
      lo_xin: { price: null },
      gx: { price: 850 },
    },
    status: "active",
  },
  {
    id: "part-cat-mock-i4",
    storeId: "store-1",
    category: "man_iphone",
    brandGroup: "",
    name: "12 - 12 Pro",
    note: "",
    grades: {
      zin: { price: null },
      lo: { price: 600 },
      lo_xin: { price: null },
      gx: { price: 1100 },
    },
    status: "active",
  },
  {
    id: "part-cat-mock-i5",
    storeId: "store-1",
    category: "man_iphone",
    brandGroup: "",
    name: "13 Pro",
    note: "",
    grades: {
      zin: { price: null },
      lo: { price: 800 },
      lo_xin: { price: null },
      gx: { price: 1600 },
    },
    status: "active",
  },
  {
    id: "part-cat-mock-i6",
    storeId: "store-1",
    category: "man_iphone",
    brandGroup: "",
    name: "14 PRO",
    note: "",
    grades: {
      zin: { price: null },
      lo: { price: 850 },
      lo_xin: { price: null },
      gx: { price: 2800 },
    },
    status: "active",
  },
  {
    id: "part-cat-mock-p1",
    storeId: "store-1",
    category: "pin",
    brandGroup: "",
    name: "11",
    note: "",
    grades: {
      re: { price: 400 },
      dlc: { price: 450 },
      used: { price: null },
      used_dlc: { price: null },
    },
    status: "active",
  },
  {
    id: "part-cat-mock-p2",
    storeId: "store-1",
    category: "pin",
    brandGroup: "",
    name: "12 - 12 Pro",
    note: "",
    grades: {
      re: { price: 400 },
      dlc: { price: 450 },
      used: { price: 500 },
      used_dlc: { price: 550 },
    },
    status: "active",
  },
  {
    id: "part-cat-mock-p3",
    storeId: "store-1",
    category: "pin",
    brandGroup: "",
    name: "13 Pro",
    note: "",
    grades: {
      re: { price: 500 },
      dlc: { price: 550 },
      used: { price: null },
      used_dlc: { price: 700 },
    },
    status: "active",
  },
  {
    id: "part-cat-mock-p4",
    storeId: "store-1",
    category: "pin",
    brandGroup: "",
    name: "14 PRO",
    note: "",
    grades: {
      re: { price: 600 },
      dlc: { price: 650 },
      used: { price: null },
      used_dlc: { price: 750 },
    },
    status: "active",
  },
  {
    id: "part-cat-mock-p5",
    storeId: "store-1",
    category: "pin",
    brandGroup: "",
    name: "15",
    note: "",
    grades: {
      re: { price: null },
      dlc: { price: null },
      used: { price: null },
      used_dlc: { price: 700 },
    },
    status: "active",
  },
];

export function emptyGradesFor(
  category: PartCatalogCategory
): Record<string, PartGradeCell> {
  if (category === "man_android") {
    return { default: { cost: null, price: null, qty: 0 } };
  }
  if (category === "man_iphone") {
    return {
      zin: { price: null },
      lo: { price: null },
      lo_xin: { price: null },
      gx: { price: null },
    };
  }
  return {
    re: { price: null },
    dlc: { price: null },
    used: { price: null },
    used_dlc: { price: null },
  };
}

export function clonePartCatalogSeed(): PartCatalogItem[] {
  return PART_CATALOG_MOCK_SEED.map((row) => ({
    ...row,
    grades: JSON.parse(JSON.stringify(row.grades)) as Record<string, PartGradeCell>,
  }));
}
