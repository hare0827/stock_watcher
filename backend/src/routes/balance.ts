import { Router } from 'express';
import fetch from 'node-fetch';
import { getToken, getBaseUrl } from '../kis';
import { Holding } from '../types';

export const balanceRouter = Router();

function parseAccount(): { cano: string; acntPrdtCd: string } {
  const raw = process.env.KIS_ACCOUNT_NO ?? '';
  const [cano, acntPrdtCd = '01'] = raw.split('-');
  return { cano, acntPrdtCd };
}

balanceRouter.get('/', async (_req, res) => {
  try {
    const token = await getToken();
    const { cano, acntPrdtCd } = parseAccount();
    const trId = process.env.KIS_IS_PAPER === 'true' ? 'VTTC8434R' : 'TTTC8434R';
    const appKey = process.env.KIS_APP_KEY ?? '';
    const appSecret = process.env.KIS_APP_SECRET ?? '';

    const params = new URLSearchParams({
      CANO: cano,
      ACNT_PRDT_CD: acntPrdtCd,
      AFHR_FLPR_YN: 'N',
      OFL_YN: '',
      INQR_DVSN: '02',
      UNPR_DVSN: '01',
      FUND_STTL_ICLD_YN: 'N',
      FNCG_AMT_AUTO_RDPT_YN: 'N',
      PRCS_DVSN: '01',
      CTX_AREA_FK100: '',
      CTX_AREA_NK100: '',
    });

    const kisRes = await fetch(
      `${getBaseUrl()}/uapi/domestic-stock/v1/trading/inquire-balance?${params}`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          appkey: appKey,
          appsecret: appSecret,
          tr_id: trId,
          'Content-Type': 'application/json; charset=utf-8',
        },
      }
    );

    if (!kisRes.ok) throw new Error(`KIS balance error: ${kisRes.status}`);

    const data = (await kisRes.json()) as {
      rt_cd: string;
      output1: Array<{
        pdno: string;
        prdt_name: string;
        hldg_qty: string;
        pchs_avg_pric: string;
      }>;
    };

    if (data.rt_cd !== '0') throw new Error(`KIS balance error: rt_cd=${data.rt_cd} msg=${(data as any).msg1 ?? ''}`);

    const today = new Date().toISOString().slice(0, 10);

    const holdings: Holding[] = data.output1
      .filter((item) => parseInt(item.hldg_qty, 10) > 0)
      .map((item) => ({
        id: `kis_${item.pdno}.KS`,
        ticker: `${item.pdno}.KS`,
        shares: parseInt(item.hldg_qty, 10),
        pricePerShare: parseFloat(item.pchs_avg_pric),
        purchaseDate: today,
        currency: 'KRW' as const,
        type: 'buy' as const,
      }));

    res.json({ holdings });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    res.status(500).json({ error: message });
  }
});
