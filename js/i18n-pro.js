// UI text for the planning features added after v1: 6 GHz, channel widths, heatmap views,
// attenuation zones, area requirements / capacity, floors, AP table, BOM, PDF report, imports.
// Thai and English; the other languages fall back to English (see t() in i18n.js).
const I18N_PRO = {
  th: {
    tx6: "กำลังส่ง 6G", gain6: "เกนเสา 6G", noRadio: "ไม่มีย่านนี้",
    gainShort: "เกน", chShort: "ช่อง", widthShort: "กว้าง",
    bandGridNote: "Tx 0 = ไม่มีวิทยุย่านนั้น • ช่องกว้างขึ้นได้ความเร็วสูงขึ้นแต่ชนกันง่ายขึ้นและพื้นสัญญาณรบกวนสูงขึ้น",
    dfsOpt: "ใช้ช่อง DFS (5 GHz ช่อง 52–144) ตอนจัดช่องอัตโนมัติ",
  },
  en: {
    tx6: "Tx power 6G", gain6: "Antenna gain 6G", noRadio: "no radio",
    gainShort: "Gain", chShort: "Ch", widthShort: "Width",
    bandGridNote: "Tx 0 = no radio on that band • Wider channels are faster but overlap more easily and raise the noise floor",
    dfsOpt: "Use DFS channels (5 GHz ch 52–144) for auto channels",
  },
};
for (const [code, extra] of Object.entries(I18N_PRO)) Object.assign(I18N[code], extra);
