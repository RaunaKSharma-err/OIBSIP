// Drop-in eSewa client for the React/Vite frontend. Adapt `API_URL`/token handling to your existing API layer.
const API_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:5000/api";

export type PaymentOutcome =
  | "paid"
  | "pending"
  | "failed"
  | "not_found"
  | "verification_required";

export interface EsewaForm {
  paymentUrl: string;
  method: "POST";
  fields: Record<string, string>;
  orderId: string;
  orderNumber: string;
  transactionUuid: string;
  amount: number; // paisa
}
export interface PaymentResult {
  paymentStatus: PaymentOutcome;
  gatewayStatus: string | null;
  order: {
    id: string;
    orderNumber: string;
    total: number;
    paymentStatus: string;
    orderStatus: string;
  } | null;
}

async function call<T>(
  path: string,
  token: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const body = await res.json().catch(() => null);
  if (!body?.success) {
    const err = new Error(body?.error?.message ?? "Request failed") as Error & {
      code?: string;
      status?: number;
    };
    err.code = body?.error?.code;
    err.status = res.status;
    throw err;
  }
  return body.data as T; // note: 202 responses are successes carrying an unresolved paymentStatus
}

export const initiateEsewaPayment = (token: string, orderId: string) =>
  call<EsewaForm>("/payments/esewa/initiate", token, {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });
export const verifyEsewaRedirect = (token: string, data: string) =>
  call<PaymentResult>("/payments/esewa/verify", token, {
    method: "POST",
    body: JSON.stringify({ data }),
  });
export const getEsewaStatus = (token: string, orderId: string) =>
  call<PaymentResult>(
    `/payments/esewa/status?orderId=${encodeURIComponent(orderId)}`,
    token,
  );

/** Leaves the SPA: POSTs the backend-signed fields to eSewa (a real form POST, as eSewa's docs require). */
export function submitEsewaForm({
  paymentUrl,
  fields,
}: Pick<EsewaForm, "paymentUrl" | "fields">) {
  const form = document.createElement("form");
  form.method = "POST";
  form.action = paymentUrl;
  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }
  document.body.appendChild(form);
  form.submit();
}

export const formatNpr = (paisa: number) =>
  `Rs. ${(paisa / 100).toLocaleString("en-NP", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
