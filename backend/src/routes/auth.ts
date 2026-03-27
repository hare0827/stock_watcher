import { Router } from 'express';
import { getToken } from '../kis';

export const authRouter = Router();

authRouter.post('/token', async (_req, res) => {
  try {
    await getToken();
    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ error: message });
  }
});
