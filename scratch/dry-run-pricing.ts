import { createClient } from '@supabase/supabase-js';

const rawInput = `
capcut pro	1 tuần	full	3k
capcut pro 	1 tháng	full	40k
capcut pro 	6 tháng	full	320k
netflix 	1 tháng	full	20k
netflix chủ farm	1 tháng	full	
capcut			
slot canva pro	1 tháng	full	10k
slot canva edu	1 năm	full	29k
admin canva pro bussiness 100 slot	1 tháng	full	49k
admin canva pro bussiness 100 slot	3 tháng	full	55k
adobe full app 	2 tháng	24H	65k
slot ytb	1 tháng	full	35k
slot ytb	12 tháng	full	450k
slot ytb	3 tháng	full	119k
slot ytb	6 tháng	full	219k
google AI ro 5tb nâng chính chủ	1 năm	1 tháng	75k
google AI ro 5tb nâng chính chủ	1 năm	full	399k
Slot gemini AI pro	1 năm	1 tháng	49k
Slot gemini AI pro	1 năm	3 tháng	69k
Slot gemini AI pro	1 năm	6 tháng	99k
Wink VIP+	1 tuần	full	20k
Wink VIP+	1 tháng	full	75k
MeiTu Vip+	1 tuần	full	25k
MeiTu Vip+	1 tháng	full	65k
xingtu vip 	1 tháng	full	85k
Netfflix extra	1 tháng	full	70k
KLing AI 3k3 credit	1 tháng	7 ngày	650k
Kling AI Ramdom 600-1k1 credit	1 tháng	full	210k
Perplexity AI pro 	1 tháng	full	180k
Perplexity AI pro 	10-11 tháng	full	1tr8
slot Microsoft premium	1 năm	full	150k
slot gemini pro + gg 5tb	1 năm	full	50k
API 10m token codex	1 ngày	full	40k
API 50m token codex	1 ngày	full	70k
API 100m token codex	1 ngày	full	110k
API 10m token claude	1 ngày	full	40k
API 50m token claude	1 ngày	full	99k
API 100m token claude	1 ngày	full	130k
elevans labs redeen 1M credit	1 tháng	full	389k
elevans labs redeen 300K credit	1 tháng	full	180k
Kling AI 65 cre	1 tháng	full	4k
auto desk app all 	3 năm	1 năm	120k
memrise pro lifetime	20 năm	1 tháng	300k
Slot icould 2Tb 	1 tháng	full	120k
chatGpt team bussiness 	1 tháng	full	450k
Slot icould 400GB	1 năm	full	650k
super duolingo your mail	1 năm	full	250k
notion bussiness 	6 tháng	full	450k
APi cursor pro 2k6 credit	1 tháng	full	220k
api cursor ptro 6k5 credit	1 tháng	full	309k
Spotify nâng chính chủ	1 tháng	full	40k
Spotify nâng chính chủ	3 tháng	full	100k
Spotify nâng chính chủ	6 tháng	full	200k
Spotify nâng chính chủ	1 năm	full	300k
figma pro	1 năm	full	200k
proton unlimited	1 tháng	full	49k
`;

function parseCost(str: string): number | null {
  if (!str) return null;
  const s = str.trim().toLowerCase();
  if (!s) return null;
  if (s === '1tr8' || s === '1.8tr' || s === '1.8m') return 1800000;
  if (s.endsWith('tr')) {
    const num = parseFloat(s.replace('tr', '').replace(',', '.'));
    return num * 1000000;
  }
  if (s.endsWith('k')) {
    const num = parseFloat(s.replace('k', '').replace(',', '.'));
    return num * 1000;
  }
  const n = parseInt(s, 10);
  return isNaN(n) ? null : n;
}

export function calculateRefinedPricing(cost: number) {
  let retail = 0;
  let wholesale = 0;
  let affiliateRate = 0.05; // 5% default

  if (cost <= 5000) {
    retail = 15000;
    wholesale = 12000;
    affiliateRate = 0.10; // 10%
  } else if (cost <= 15000) {
    retail = 25000;
    wholesale = 22000;
    affiliateRate = 0.08; // 8%
  } else if (cost <= 25000) {
    retail = 45000;
    wholesale = 39000;
    affiliateRate = 0.08; // 8%
  } else if (cost <= 35000) {
    retail = 59000;
    wholesale = 52000;
    affiliateRate = 0.08; // 8%
  } else if (cost <= 50000) {
    retail = 79000;
    wholesale = 69000;
    affiliateRate = 0.07; // 7%
  } else if (cost <= 75000) {
    retail = 119000;
    wholesale = 105000;
    affiliateRate = 0.06; // 6%
  } else if (cost <= 100000) {
    retail = 149000;
    wholesale = 135000;
    affiliateRate = 0.06; // 6%
  } else if (cost <= 130000) {
    retail = 189000;
    wholesale = 169000;
    affiliateRate = 0.05; // 5%
  } else if (cost <= 160000) {
    retail = 229000;
    wholesale = 209000;
    affiliateRate = 0.05; // 5%
  } else if (cost <= 200000) {
    retail = 279000;
    wholesale = 249000;
    affiliateRate = 0.05; // 5%
  } else if (cost <= 250000) {
    retail = 339000;
    wholesale = 309000;
    affiliateRate = 0.05; // 5%
  } else if (cost <= 320000) {
    retail = 429000;
    wholesale = 389000;
    affiliateRate = 0.05; // 5%
  } else if (cost <= 400000) {
    retail = 529000;
    wholesale = 479000;
    affiliateRate = 0.05; // 5%
  } else if (cost <= 500000) {
    retail = 649000;
    wholesale = 589000;
    affiliateRate = 0.05; // 5%
  } else if (cost <= 700000) {
    retail = 899000;
    wholesale = 819000;
    affiliateRate = 0.05; // 5%
  } else {
    // High-ticket (e.g. 1.800.000)
    retail = Math.round((cost * 1.25) / 10000) * 10000 - 1000; // e.g. 2.249.000
    wholesale = Math.round((cost * 1.12) / 10000) * 10000; // e.g. 2.016.000
    affiliateRate = 0.05; // 5%
  }

  const coupon = Math.min(Math.round(retail * 0.10), 25000);
  const net = retail - coupon;
  const affiliate = Math.round(net * affiliateRate);
  const profit = net - affiliate - cost;
  const margin = Math.round((profit / net) * 10000) / 100;
  const ctvDiscountPercent = Math.round(((retail - wholesale) / retail) * 100);

  return {
    retail,
    wholesale,
    ctvDiscountPercent: `${ctvDiscountPercent}%`,
    affiliateRatePercent: `${Math.round(affiliateRate * 100)}%`,
    coupon,
    net,
    affiliate,
    profit,
    margin: `${margin}%`,
    status: profit > 0 ? 'PASS' : 'FAIL',
  };
}

async function dryRunRefined() {
  console.log('--- REFINED DRY RUN (Affiliate 5-10%, CTV price close to retail) ---');

  const lines = rawInput.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const parsedItems: any[] = [];

  for (const line of lines) {
    const parts = line.split('\t').map(p => p.trim());
    const prodRaw = parts[0] || '';
    const durationRaw = parts[1] || '';
    const warrantyRaw = parts[2] || '';
    const costRaw = parts[3] || '';
    const cost = parseCost(costRaw);

    if (!prodRaw) continue;

    if (cost === null) {
      parsedItems.push({
        prodRaw,
        durationRaw,
        warrantyRaw,
        cost: null,
        status: 'NEEDS_COST_PRICE_REVIEW',
      });
      continue;
    }

    const pricing = calculateRefinedPricing(cost);
    parsedItems.push({
      prodRaw,
      durationRaw,
      warrantyRaw,
      cost,
      ...pricing,
    });
  }

  console.table(parsedItems);
}

dryRunRefined();
