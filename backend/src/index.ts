import 'dotenv/config';
import express from 'express';
import { authRouter } from './routes/auth';

export const app = express();
app.use(express.json());
app.use('/auth', authRouter);

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

if (require.main === module) {
  const port = process.env.PORT ?? 3000;
  app.listen(port, () => console.log(`Server running on port ${port}`));
}
