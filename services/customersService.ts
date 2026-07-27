export type CustomerDto = {
  id: string;
  name: string;
  phone: string;
  address: string;
  note: string;
};

export type DuplicatePhoneGroupDto = {
  phoneDigits: string;
  phoneDisplay: string;
  customers: CustomerDto[];
};

async function parseJson<T>(res: Response): Promise<T> {
  const body = await res.json();
  if (!res.ok) throw new Error(body?.error || `HTTP ${res.status}`);
  return body.data as T;
}

export async function listCustomers(): Promise<CustomerDto[]> {
  const res = await fetch("/api/customers", { cache: "no-store" });
  return parseJson<CustomerDto[]>(res);
}

export async function saveCustomer(input: {
  id?: string;
  name: string;
  phone?: string;
  address?: string;
  note?: string;
  actorUsername?: string;
}): Promise<CustomerDto> {
  const res = await fetch("/api/customers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<CustomerDto>(res);
}

export async function deactivateCustomer(
  id: string,
  actorUsername?: string
): Promise<{ id: string }> {
  const res = await fetch("/api/customers", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, actorUsername }),
  });
  return parseJson<{ id: string }>(res);
}

export async function listDuplicatePhoneGroups(): Promise<DuplicatePhoneGroupDto[]> {
  const res = await fetch("/api/customers/duplicates", { cache: "no-store" });
  return parseJson<DuplicatePhoneGroupDto[]>(res);
}

export async function mergeCustomers(input: {
  keepId: string;
  mergeIds: string[];
  actorUsername?: string;
}): Promise<CustomerDto> {
  const res = await fetch("/api/customers/merge", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return parseJson<CustomerDto>(res);
}
