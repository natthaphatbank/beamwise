# WiFi Planner TH

Predictive Wi-Fi design in the browser: load a floor plan, draw walls, place access points and see a live coverage heatmap. A simple, affordable alternative to tools like Ekahau for installers, IT shops and dorm owners in Thailand.

เครื่องมือออกแบบ Wi-Fi บนเว็บ — โหลดแบบแปลน วาดผนัง วาง AP แล้วดู Heatmap สัญญาณได้ทันที

## Run

No install or server needed. Open `index.html` in Chrome, Edge or Firefox.

## How to use

1. **Load floor plan** (โหลดแบบแปลน): a PNG or JPG image. You can also drag it onto the canvas.
2. **Set scale (S)**: click both ends of something with a known length, then type its real length in metres.
3. **Draw walls (W)**: pick a material, then click to draw connected walls. Double-click, Esc or right-click ends a chain. Hold Shift to lock angles; ends snap to existing walls.
4. **Place APs (A)**: click to add. Select an AP to set its name, Tx power and antenna gain.
5. **Coverage boundary (B)** (ขอบเขตสัญญาณ): click points around the area that needs Wi-Fi, then click the first point, double-click or press Enter to close it. The heatmap is clipped to the boundary, and coverage %, area and AI auto-placement count only the inside. You can draw several. Select one to drag its points or move it; Delete removes it.
6. Pick a language from the 🌐 menu: ไทย, English, 中文, 日本語, 한국어, Tiếng Việt, ລາວ, မြန်မာ. First-time visitors get their browser language automatically.
7. Switch between **2.4 / 5 GHz**, choose the environment, then **Save** the project (.json) or **Export image** (.png) for your customer.

| Shortcut | Action |
|---|---|
| V / H / S / W / B / A | Select, Pan, Scale, Wall, Boundary, AP |
| Delete | Remove selected item |
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Ctrl+S | Save project |
| Space + drag, or middle mouse | Pan |
| Mouse wheel | Zoom |

The project autosaves in the browser.

## AP models

`js/catalog.js` lists 32 models from Ubiquiti UniFi, TP-Link Omada / Deco, Ruijie Reyee, Aruba Instant On, Cisco Meraki, Ruckus, Huawei, MikroTik, Grandstream, plus generic and ISP routers. Values are typical datasheet maximums, so verify them. Add a model with one line. The **Thai NBTC** option caps EIRP at 20 dBm on 2.4 GHz, 23 dBm on 5 GHz ch 36–64 and 30 dBm on ch 100+.

## Required signal

**Auto** picks the minimum acceptable RSSI from the building type: −67 dBm for offices and open halls (voice and video calls), −70 dBm for homes and dorms, −72 dBm for warehouses. You can also pick a profile yourself. Coverage % and the AI use this value, and the heatmap floor follows it (requirement − 15 dB).

## AI assistant

- **Auto-place APs** (runs in the browser, free and offline): a greedy coverage search over candidate positions inside the building, then a local refinement pass. It stops at the target coverage or the AP limit, then assigns non-overlapping channels (2.4 GHz: 1/6/11; 5 GHz: 36/44/149/157).
- **Auto-assign channels**: re-plans channels for the current APs to reduce co-channel interference.
- **AI analysis (Claude)**: sends a rendered image of the plan and a JSON summary (APs, walls, coverage, weak areas) to Claude (`claude-opus-5-5`) and streams a design review in the selected UI language. It uses the official Anthropic SDK from jsDelivr, in the browser, with the user's own API key (stored only in their browser if they tick "remember"). Server-side refusal fallback (`fallbacks: "default"`) is enabled.

## RF model

Best-server RSSI per grid cell, using a multi-wall log-distance model:

```
RSSI = TxPower + AntennaGain − FSPL(1 m) − 10·n·log10(d) − Σ wall losses
```

- `FSPL(1 m) = 20·log10(f MHz) − 27.55`, about 40 dB at 2.4 GHz and 47 dB at 5 GHz
- `n` = path-loss exponent from the environment setting (2.0 open hall → 3.0 dense)
- Wall losses per crossing (2.4 / 5 GHz, dB): drywall 3/4, glass 3/5, wood 4/6, AAC block 6/9, plastered brick 8/12, concrete 12/18, metal 20/26

These are typical published values. Predictions are estimates, so check real installations with a site survey and tune the materials or environment to match.

**Thai regulatory note (NBTC / กสทช.):** 2.4 GHz is limited to 100 mW EIRP (20 dBm). For 5 GHz, check the limit for each sub-band. The AP panel shows EIRP so you can check it.

## Files

```
index.html      layout
css/style.css   dark UI
js/i18n.js      UI text in 8 languages (add a language: one entry in LANGS + one block in I18N)
js/sample.js    sample 14-room dorm project
js/catalog.js   AP models, NBTC caps, requirement profiles, channel plans
js/model.js     materials, propagation model, heatmap colours
js/optimizer.js AP auto-placement, channel assignment, weak-area detection
js/ai.js        Claude design review (BYOK, browser)
js/app.js       canvas, tools, editing, save / export
```

## Roadmap

- Co-channel interference heatmap view
- AP cost / BOM estimate for quotes
- PDF report
- Multiple floors
- PDF floor-plan import
