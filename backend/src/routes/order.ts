import { Router } from 'express';
import fetch from 'node-fetch';
import { getToken, getBaseUrl } from '../kis';

export const orderRouter = Router();

function parseAccount() {
  const raw = process.env.KIS_ACCOUNT_NO ?? '';
  const [cano, acntPrdtCd] = raw.split('-');
  return { cano, acntPrdtCd };
}

function toPdno(ticker: string): string {
  return ticker.replace('.KS', '');
}

orderRouter.post('/', async (req, res) => {
  const { ticker, shares, orderType } = req.body as {
    ticker: string;
    shares: number;
    orderType: 'buy' | 'sell';
  };

  try {
    const token = await getToken();
    const { cano, acntPrdtCd } = parseAccount();
    const isPaper = process.env.KIS_IS_PAPER === 'true';
    const trId = orderType === 'buy'
      ? (isPaper ? 'VTTC0802U' : 'TTTC0802U')
      : (isPaper ? 'VTTC0801U' : 'TTTC0801U');

    const kisRes = await fetch(
      `${getBaseUrl()}/uapi/domestic-stock/v1/trading/order-cash`,
      {
        method: 'POST',
        headers: {
          authorization: `Bearer ${token}`,
          appkey: process.env.KIS_APP_KEY ?? '',
          appsecret: process.env.KIS_APP_SECRET ?? '',
          tr_id: trId,
          'Content-Type': 'application/json; charset=utf-8',
        },
        body: JSON.stringify({
          CANO: cano,
          ACNT_PRDT_CD: acntPrdtCd,
          PDNO: toPdno(ticker),
          ORD_DVSN: '01',
          ORD_QTY: String(shares),
          ORD_UNPR: '0',
        }),
      }
    );

    if (!kisRes.ok) throw new Error(`KIS order error: ${kisRes.status}`);

    const data = (await kisRes.json()) as {
      rt_cd: string;
      msg1?: string;
      output?: { ORNO: string; KRX_FWDG_ORD_ORGNO: string };
    };

    if (data.rt_cd !== '0') throw new Error(data.msg1 ?? 'KIS order failed');

    res.json({ orderId: data.output?.ORNO ?? '', status: 'accepted' });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ error: message });
  }
});

orderRouter.get('/:orderId', (req, res) => {
  res.json({ orderId: req.params.orderId, status: 'accepted' });
});
