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
