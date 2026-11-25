// Radio helpers shared by the model, the optimizer and the UI: bands (2.4 / 5 / 6 GHz),
// channels and channel widths, spectrum overlap, noise floor and PHY data rates.
//
// An AP stores per band: tx<k>, gain<k>, ch<k> (primary 20 MHz channel) and w<k> (width, MHz),
// with k = "24" | "5" | "6".

const BAND_LIST = ["2.4", "5", "6"];
const BK = { "2.4": "24", "5": "5", "6": "6" };
const apTx = (ap, b) => +ap["tx" + BK[b]] || 0;
const apGain = (ap, b) => +ap["gain" + BK[b]] || 0;
const apCh = (ap, b) => ap["ch" + BK[b]] ?? null;

// Channel widths a radio can use per band, and the default for a new AP.
const WIDTHS = { "2.4": [20, 40], "5": [20, 40, 80, 160], "6": [20, 40, 80, 160] };
const DEFAULT_WIDTH = { "2.4": 20, "5": 40, "6": 80 };
function apWidth(ap, b) {
  const w = +ap["w" + BK[b]];
  return WIDTHS[b].includes(w) ? w : DEFAULT_WIDTH[b];
}

// 20 MHz channels allowed in Thailand. 6 GHz: 5925–6425 MHz (U-NII-5, channels 1–93), indoor.
const CH_ALL = {
  "2.4": [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13],
  "5": [36, 40, 44, 48, 52, 56, 60, 64, 100, 104, 108, 112, 116, 120, 124, 128, 132, 136, 140, 144, 149, 153, 157, 161, 165],
  "6": Array.from({ length: 24 }, (_, i) => 1 + 4 * i),
};
const isDfs = ch => ch >= 52 && ch <= 144;          // 5 GHz channels that need radar detection (DFS)

// Centre frequency (MHz) of a 20 MHz channel.
function chFreq(b, ch) {
  if (b === "2.4") return 2407 + 5 * ch;
  if (b === "5") return 5000 + 5 * ch;
  return 5950 + 5 * ch;
}

// 5 GHz bonding blocks (first channel of each block) per width.
const BLOCKS5 = {
  40: [36, 44, 52, 60, 100, 108, 116, 124, 132, 140, 149, 157],
  80: [36, 52, 100, 116, 132, 149],
  160: [36, 100],
};

// Frequency span [lo, hi] (MHz) used by a radio on primary channel `ch` with width `w`.
// A width that does not fit at that channel falls back to the widest one that does.
function chSpan(b, ch, w) {
  if (ch == null) return null;
  if (b === "2.4") {
    if (w >= 40) {
      const sec = ch <= 9 ? ch + 4 : ch - 4;     // HT40+ below channel 10, HT40- above
      const lo = Math.min(chFreq(b, ch), chFreq(b, sec)) - 10;
      return [lo, lo + 40];
    }
    const f = chFreq(b, ch);
    return [f - 10, f + 10];
  }
  if (b === "5") {
    for (const width of [160, 80, 40]) {
      if (w < width) continue;
      const start = BLOCKS5[width].find(s => ch >= s && ch < s + width / 5);
      if (start != null) { const lo = chFreq(b, start) - 10; return [lo, lo + width]; }
    }
    const f = chFreq(b, ch);
    return [f - 10, f + 10];
  }
  // 6 GHz: blocks are aligned from channel 1; keep inside 5925–6425 MHz
  for (const width of [160, 80, 40, 20]) {
    if (w < width) continue;
    const n = width / 20, idx = Math.floor((ch - 1) / 4 / n) * n;
    const lo = chFreq(b, 1 + idx * 4) - 10;
    if (lo + width <= 6425) return [lo, lo + width];
  }
  const f = chFreq(b, ch);
  return [f - 10, f + 10];
}
const spanWidth = s => s ? s[1] - s[0] : 20;

// Share of an interferer's power that lands inside the victim's channel (0..1).
function overlapFrac(victim, interferer) {
  if (!victim || !interferer) return 0;
  const o = Math.min(victim[1], interferer[1]) - Math.max(victim[0], interferer[0]);
  return o > 0 ? o / (interferer[1] - interferer[0]) : 0;
}

// Non-overlapping channel plan for the optimizer (primary channel of each block). On 5 GHz the
// upper band (149+) comes first: Thailand allows 30 dBm EIRP there against 23 dBm on 36–64.
const upperFirst = list => [...list.filter(c => c >= 149), ...list.filter(c => c < 52), ...list.filter(c => c >= 52 && c < 149)];
function channelPlan(b, w, dfs) {
  if (b === "2.4") return [1, 6, 11];
  if (b === "5") return upperFirst(channelPlan5(w, dfs));
  return channelPlan6(w);
}
function channelPlan5(w, dfs) {
  if (w <= 20) return CH_ALL["5"].filter(c => dfs || !isDfs(c));
  const width = BLOCKS5[w] ? w : 40;
  const blockDfs = s => isDfs(s) || isDfs(s + width / 5 - 4);   // any DFS channel inside the block
  const blocks = BLOCKS5[width].filter(s => dfs || !blockDfs(s));
  // 160 MHz always needs DFS channels; without DFS fall back to 80 MHz blocks
  return blocks.length ? blocks : BLOCKS5[80].filter(s => dfs || !isDfs(s));
}
function channelPlan6(w) {
  const step = w / 5;
  const out = [];
  for (let c = 1; c <= 93; c += step) if (chFreq("6", c) - 10 + w <= 6425) out.push(c);
  return out;
}

// Thermal noise floor (dBm) for a channel width, with a 7 dB receiver noise figure.
const noiseFloor = w => -174 + 10 * Math.log10(w * 1e6) + 7;

// ---------- PHY rates ----------
// Minimum SNR / SINR (dB) for each MCS (typical receiver sensitivity steps).
const MCS_SNR = [5, 8, 11, 14, 17, 20, 22, 25, 29, 31, 34, 37, 40, 43];
// Per spatial stream, 20 MHz (Mbps). HE / EHT: 0.8 µs GI. VHT / HT: 800 ns GI.
const RATE_HE20 = [8.6, 17.2, 25.8, 34.4, 51.6, 68.8, 77.4, 86.0, 103.2, 114.7, 129.0, 143.4, 154.9, 172.1];
const RATE_VHT = {
  20: [6.5, 13, 19.5, 26, 39, 52, 58.5, 65, 78],
  40: [13.5, 27, 40.5, 54, 81, 108, 121.5, 135, 162, 180],
  80: [29.3, 58.5, 87.8, 117, 175.5, 234, 263.3, 292.5, 351, 390],
  160: [58.5, 117, 175.5, 234, 351, 468, 526.5, 585, 702, 780],
};
const HE_WIDTH_K = { 20: 1, 40: 2, 80: 4.1875, 160: 8.375, 320: 16.75 };
const STD_RANK = { "Wi-Fi 4": 4, "Wi-Fi 5": 5, "Wi-Fi 6": 6, "Wi-Fi 6E": 6.5, "Wi-Fi 7": 7 };

// Does a Wi-Fi standard have a radio on this band?
const stdHasBand = (rank, b) => b !== "6" || rank >= 6.5;

/**
 * PHY rate (Mbps) at a given SINR for the link AP <-> client.
 * apStd / clientStd: "Wi-Fi 4".."Wi-Fi 7"; ss: spatial streams; w: channel width (MHz).
 * Returns { mbps, mcs } (mcs = -1: no link).
 */
function phyRate(sinr, b, w, apStd, clientStd, ss) {
  let rank = Math.min(STD_RANK[apStd] ?? 6, STD_RANK[clientStd] ?? 6);
  if (b === "6") rank = Math.max(rank, 6.5);          // the 6 GHz view assumes a 6E / 7 client
  if (b === "5" && rank === 6.5) rank = 6;
  if (b === "2.4" && rank === 5) rank = 4;            // Wi-Fi 5 is 5 GHz only; 2.4 GHz falls back to Wi-Fi 4
  const width = Math.min(w, rank >= 7 ? 320 : rank >= 5 ? 160 : 40, b === "2.4" ? 40 : 320);
  let mcs = -1;
  const maxMcs = rank >= 7 ? 13 : rank >= 6 ? 11 : rank >= 5 ? 9 : 7;
  for (let i = 0; i <= maxMcs; i++) if (sinr >= MCS_SNR[i]) mcs = i;
  if (mcs < 0) return { mbps: 0, mcs: -1 };
  let per;
  if (rank >= 6) per = RATE_HE20[mcs] * (HE_WIDTH_K[width] || 1);
  else {
    const tbl = RATE_VHT[Math.min(width, rank >= 5 ? 160 : 40)] || RATE_VHT[20];
    per = tbl[Math.min(mcs, tbl.length - 1)];
  }
  return { mbps: per * Math.max(1, ss), mcs };
}

// Wi-Fi standard of an AP (catalogue model, else Wi-Fi 6).
function apStd(ap) {
  const m = typeof AP_BY_ID !== "undefined" ? AP_BY_ID[ap.model] : null;
  return m?.std || ap.std || "Wi-Fi 6";
}
