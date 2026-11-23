# Beamwise

**See your Wi-Fi before you install it.** · ออกแบบ Wi-Fi แม่นยำ ก่อนติดตั้งจริง

**Try it / install it:** https://natthaphatbank.github.io/beamwise/

Predictive Wi-Fi design in the browser: import a floor plan, draw walls, place access points and see a live coverage heatmap. A simple, affordable alternative to tools like Ekahau for installers, IT shops and dorm owners in Thailand.

เครื่องมือออกแบบ Wi-Fi บนเว็บ — นำเข้าแบบแปลน วาดผนัง วาง AP แล้วดู Heatmap สัญญาณได้ทันที

## Run

No install or server needed. Open `index.html` in Chrome, Edge or Firefox.

### Install as an app

When the site is served over HTTPS (for example GitHub Pages), it is an installable Progressive Web App:

- **Windows / Mac / ChromeOS / Android** (Chrome or Edge): click **Install app** in the top bar, or the install icon in the address bar.
- **iPhone / iPad** (Safari): tap Share, then **Add to Home Screen**.

The installed app opens in its own window and works offline; it updates itself when a new version is published.

## How to use

1. **Import floor plan** (นำเข้าแบบแปลน): a PNG, JPG or PDF file. You can also drag it onto the canvas. For a PDF with several pages you pick the page; it is rendered to an image in the browser with [pdf.js](https://mozilla.github.io/pdf.js/) (Apache 2.0, bundled in `js/vendor/pdfjs`, so it works offline).
2. **Set scale (S)**: click both ends of something with a known length, then type its real length in metres.
3. **Draw walls (W)**: pick a material, then click to draw connected walls. Double-click, Esc or right-click ends a chain. Hold Shift to lock angles; ends snap to existing walls.
4. **Place APs (A)**: click to add. Select an AP to set its name, Tx power and antenna gain. To edit several at once, Shift+click APs, Shift+drag a box around them, or press Ctrl+A; a field shows "Mixed" when the selected APs differ, and editing it sets them all. **Apply to all APs** copies one AP's model, power and gain to every AP (channels stay as they are). Dragging any selected AP moves the whole group.
**Edit many walls at once**: drag a box on empty space (or Shift+click walls) to select several walls, then pick a material to change them all, drag one to move them together, or press Delete. A single wall's panel also has **Select all walls of this material**, so changing every brick wall to AAC is two clicks.

5. **Coverage boundary (B)** (ขอบเขตสัญญาณ): click points around the area that needs Wi-Fi, then click the first point, double-click or press Enter to close it. The heatmap is clipped to the boundary, and coverage %, area and AI auto-placement count only the inside. You can draw several. Select one to drag its points or move it; Delete removes it.
6. Pick a language from the language menu: ไทย, English, 中文, 日本語, 한국어, Tiếng Việt, ລາວ, မြန်မာ. First-time visitors get their browser language automatically.
7. Switch between **2.4 / 5 GHz**, choose the environment, then **Save** the project (.json) or **Export image** (.png) for your customer.

| Shortcut | Action |
|---|---|
| V / H / S / W / B / A / M | Select, Pan, Scale, Wall, Boundary, AP, Survey point |
| O | Straight lines on/off (walls and boundaries go only horizontal / vertical; on by default) |
| Hold Shift while drawing | Flip straight lines for that point (any angle while on, straight while off) |
| Delete | Remove selected item(s) |
| Ctrl+A | Select all APs |
| Drag on empty space | Box-select APs and walls: drag right = fully inside the box, drag left = anything the box touches |
| Shift+click / Shift+drag | Add to / remove from the selection, or add a box to it |
| Ctrl+Z / Ctrl+Y | Undo / Redo |
| Ctrl+S | Save project |
| Space + drag, right or middle mouse drag | Pan |
| Mouse wheel | Zoom |

Every start (opening the app or refreshing the page) is a blank project. Use **Save** to keep your work as a `.json` file and **Open project** to continue later. Before New, Import floor plan, Open project or the sample replaces unsaved work, the app asks **Save first / Don't save / Cancel**; refreshing or closing the tab with unsaved work shows the browser's standard "Leave site?" warning.

## AP models

`js/catalog.js` lists 260+ models from 35 brands: Ubiquiti UniFi, TP-Link (Omada, Archer, Deco), Mercusys, Ruijie / Reyee, Aruba Instant On, HPE Aruba, Cisco (Meraki, Catalyst, Business), Ruckus, Huawei, H3C, Fortinet, Juniper Mist, Extreme, Cambium, Sophos, Zyxel, Netgear, D-Link, EnGenius, MikroTik, Grandstream, Cudy, Tenda, IP-COM, ASUS, Xiaomi, Linksys, Google, eero, the fiber routers ISPs install in Thailand, plus generic types (ceiling, wall-plate, outdoor, mesh, Wi-Fi 4–7). Type in the search box above the model list to filter by brand, model or standard.

Values are typical maximum conducted Tx power and antenna gain per band, approximated from public datasheets, so check them against the datasheet of the exact model and region before quoting. A model with Tx 0 on a band has no radio there.

**Add your own model**: a model that isn't listed can be added from the model picker (**+ Add your own model**) with values from its datasheet. These models are kept in the browser, saved inside project files, and added to the list when someone opens such a file. A catalogue model can also be added with one line in `js/catalog.js`.

The **Thai NBTC** option caps EIRP at 20 dBm on 2.4 GHz, 23 dBm on 5 GHz ch 36–64 and 30 dBm on ch 100+.

## Required signal

**Auto** picks the minimum acceptable RSSI from the building type: −67 dBm for offices and open halls (voice and video calls), −70 dBm for homes and dorms, −72 dBm for warehouses. You can also pick a profile yourself. Coverage % and the AI use this value, and the heatmap floor follows it (requirement − 15 dB).

## AI assistant

- **Auto-place APs** (runs in the browser, free and offline): a greedy coverage search over candidate positions inside the building, then a local refinement pass. It stops at the target coverage or the AP limit, then assigns non-overlapping channels (2.4 GHz: 1/6/11; 5 GHz: 36/44/149/157).
- **Auto-assign channels**: re-plans channels for the current APs to reduce co-channel interference.

## Calibration with site measurements

Predictions use typical values, so check them against real measurements:

1. On site, measure RSSI with a phone app (WiFiman, NetSpot, …) at several points spread over the area, near and far from the APs (5+ points recommended).
2. Pick **Survey point (M)**, click each place you measured and enter the value in dBm and its band.
3. The **Calibration** card shows the error per band (predicted − measured): mean, RMS and max. An RMS under about 4–6 dB is a good match.
4. **Fit model to measurements** searches the path-loss exponent n (1.5–4.5, with 3+ points) and a per-band offset that minimise the squared error. The heatmap, coverage %, auto-placement, channels and CSV all use the fitted model. **Remove calibration** goes back to the environment preset.

A very large offset (over 10 dB) usually means a wrong scale, AP position, AP power or band rather than unusual walls.

## Design data export

**Export data (CSV)** downloads one CSV file (UTF-8, opens in Excel or Google Sheets) for whoever reviews the design:

- project settings: environment, requirement, NBTC cap, design area, boundary
- coverage on 2.4 and 5 GHz: % meeting the requirement, % dead zone, average and minimum signal
- every AP: position (m), model, Tx power, antenna gain, EIRP and channels
- walls by material: count, total length and loss
- weak areas on each band: position, size and worst signal
- signal distribution in 5 dB bins for both bands, ready to chart

Headings are in Thai when the UI is Thai, otherwise English. **Export image** gives the heatmap picture.

## RF model

Best-server RSSI per grid cell. For every AP the model takes the strongest of the direct path and **dominant paths** that bend around wall ends, door jambs and outside corners (signal that runs down a corridor and turns into a room):

```
RSSI = EIRP + pattern(direction) + client offset − FSPL(1 m) − 10·n·log10(d3D)
       − Σ wall loss × incidence factor − Σ diffraction loss per turn
```

- `FSPL(1 m) = 20·log10(f MHz) − 27.55`, about 40 dB at 2.4 GHz and 47 dB at 5 GHz
- `n` = path-loss exponent from the environment setting (2.0 open hall → 3.0 dense), or the value fitted from a site survey
- **3D distance**: `d3D` includes the AP's mounting height above the client device (default 2.7 m ceiling, 1.0 m device), so the area under an AP is no longer predicted unrealistically hot
- **Antenna pattern** by mounting: *ceiling* (down-tilted, about 3 dB weaker towards the horizon), *desk / wall omni* (null straight below), *directional* (aimed by azimuth with a set beamwidth, `−12·(φ/beamwidth)²` dB, max 20 dB)
- **Wall losses** per crossing at normal incidence (2.4 / 5 GHz, dB): drywall 3/4, glass 3/5, low-E glass 25/32, wood 4/6, AAC block 6/9, plastered brick 8/12, concrete 12/18, heavy concrete 20/28, metal 20/26. A wall crossed at an angle costs more: × 1/√cos(incidence), at most × 2
- **Diffraction** at each turn: 0.12 dB/° at 2.4 GHz, 0.15 dB/° at 5 GHz (about 11–14 dB for a right-angle turn), at most 25 dB per turn. Paths may turn several times (Dijkstra over corner nodes). Turn this off under *Signal bends along corridors / corners* to get the plain multi-wall model
- **Client device**: laptop 0, tablet −3, phone −5 (default), IoT −8 dB
- **Fade margin** (default 3 dB): real readings swing a few dB with multipath, people and device orientation, so an area counts as covered only when it beats the requirement by this margin

These are typical published values. Predictions are estimates, so check real installations with a site survey: **Fit model to measurements** tunes `n` and a per-band offset on top of everything above.

**Thai regulatory note (NBTC / กสทช.):** 2.4 GHz is limited to 100 mW EIRP (20 dBm). For 5 GHz, check the limit for each sub-band. The AP panel shows EIRP so you can check it.

## Files

```
index.html      layout
css/style.css   UI (dark / light theme)
js/i18n.js      UI text in 8 languages (add a language: one entry in LANGS + one block in I18N)
js/sample.js    sample 14-room dorm project
js/catalog.js   AP models, NBTC caps, requirement profiles, channel plans
js/model.js     materials, propagation model, heatmap colours
js/optimizer.js AP auto-placement, channel assignment, weak-area detection
js/survey.js    site-survey points, error stats, model calibration
js/report.js    design data export (CSV)
js/pdfplan.js   PDF floor plans (pdf.js, vendored in js/vendor/pdfjs)
js/app.js       canvas, tools, editing, save / export
```

## Roadmap

- Co-channel interference heatmap view
- AP cost / BOM estimate for quotes
- PDF report
- Multiple floors
- PDF floor-plan import
