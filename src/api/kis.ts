import { Holding } from '../types';

export async function testConnection(backendUrl: string): Promise<boolean> {
  try {
    const res = await fetch(`${backendUrl}/auth/token`, { method: 'POST' });
    return res.ok;
  } catch {
    return false;
  }
}

export async function fetchBalance(backendUrl: string): Promise<Holding[]> {
  const res = await fetch(`${backendUrl}/balance`);
  if (!res.ok) throw new Error(`Balance fetch failed: ${res.status}`);
  const data = await res.json();
  return data.holdings as Holding[];
}

export async function placeOrder(
  backendUrl: string,
  ticker: string,
  shares: number,
  orderType: 'buy' | 'sell'
): Promise<string> {
  const res = await fetch(`${backendUrl}/order`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ticker, shares, orderType }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error((data as any).error ?? `Order failed: ${res.status}`);
  }
  const data = await res.json();
  return (data as any).orderId as string;
}
