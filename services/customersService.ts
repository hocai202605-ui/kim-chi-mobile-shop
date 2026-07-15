export type CustomerDto = {
  id: string;
  name: string;
  phone: string;
  note: string;
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
