# Beamwise

Wi-Fi planning in the browser 

**Try it / install it:** https://natthaphatbank.github.io/beamwise/

Predictive Wi-Fi design in the browser: import a floor plan, draw walls, place access points and see a live coverage heatmap. A simple, affordable alternative to tools like Ekahau for installers, IT shops and dorm owners in Thailand.


## Run

No install or server needed. Open `index.html` in Chrome, Edge or Firefox.

### Install as an app

When the site is served over HTTPS (for example GitHub Pages), it is an installable Progressive Web App:

- **Windows / Mac / ChromeOS / Android** (Chrome or Edge): click **Install app** in the top bar, or the install icon in the address bar.
- **iPhone / iPad** (Safari): tap Share, then **Add to Home Screen**.

The installed app opens in its own window and works offline; it updates itself when a new version is published.

### Phones and tablets

On iPhone, iPad and Android the top-bar actions move into a **Menu** button (also when a phone is held sideways), hints describe taps and pinches instead of mouse and keys, and fields are sized so iOS does not zoom in when you type. Drag with one finger to pan and pinch to zoom; walls and boundaries end with the button at the bottom of the plan. With **Check signal**, drag a pin to read the signal live as you move it, and tap the × on its tag to remove it.

## How to use

**Quick start with a building template** (Templates in the top bar, or in the welcome window): pick dormitory / apartment, condominium, hotel, townhouse / shophouse, detached house, café / restaurant, minimart / shop, office, school building, warehouse or banquet / seminar hall, enter a few sizes (rooms per side, room size, corridor, floors, devices, staff, shelf or rack rows …) and Beamwise draws the walls with common Thai materials and doors, adds attenuation zones (counters, shelving, racks, desks, crowds), boundary areas with device counts and their own requirements (meeting rooms, classrooms), creates every floor, and can place APs on every floor (for coverage, then more APs where they are overloaded by the devices) and plan channels. Everything stays editable. The AI card's **Add APs for the device count** runs the same capacity step on any project; it stops when another AP would not lower the load (then the area is limited by interference: use narrower channels or DFS).

1. **Import floor plan** (นำเข้าแบบแปลน): a PNG, JPG or PDF file. You can also drag it onto the canvas. For a PDF with several pages you pick the page; it is rendered to an image in the browser with [pdf.js](https://mozilla.github.io/pdf.js/) (Apache 2.0, bundled in `js/vendor/pdfjs`, so it works offline).
2. **Set scale (S)**: click both ends of something with a known length, then type its real length in metres. One line is enough: a plan has the same scale across and down, and the longest distance you know gives the best accuracy. To check it, draw a second line in the other direction: the panel shows what the current scale measures and the difference from the real length (over 2% means the plan image is probably stretched, or a point was misplaced). A scale bar in the bottom-right corner of the plan (and in the exported image) shows the scale in use, or warns while it is only an estimate.
3. **Draw walls (W)**: pick a material, then click to draw connected walls. Double-click, Esc or right-click ends a chain. Hold Shift to lock angles; ends snap to existing walls.
4. **Place APs (A)**: click to add. Select an AP to set its name, Tx power and antenna gain. To edit several at once, Shift+click APs, Shift+drag a box around them, or press Ctrl+A; a field shows "Mixed" when the selected APs differ, and editing it sets them all. **Apply to all APs** copies one AP's model, power and gain to every AP (channels stay as they are). Dragging any selected AP moves the whole group.
**Edit many walls at once**: drag a box on empty space (or Shift+click walls) to select several walls, then pick a material to change them all, drag one to move them together, or press Delete. A single wall's panel also has **Select all walls of this material**, so changing every brick wall to AAC is two clicks.

5. **Coverage boundary (B)** (ขอบเขตสัญญาณ): click points around the area that needs Wi-Fi, then click the first point, double-click or press Enter to close it. The heatmap is clipped to the boundary, and coverage %, area and AI auto-placement count only the inside. You can draw several. Select one to drag its points or move it; Delete removes it.
6. Pick a language from the language menu: ไทย, English, 中文, 日本語, 한국어, Tiếng Việt, ລາວ, မြန်မာ. First-time visitors get their browser language automatically.
7. **Check signal (P)** (เช็คสัญญาณ): click any spot to drop a pin showing the estimated signal there in dBm, coloured like the heatmap. The panel shows both bands, whether it meets the requirement, and each AP's signal and distance at that spot. Click several spots to compare. To remove a pin, click × on the selected pin's tag, right-click the pin, or press Delete; **Clear all** removes every pin. Pins are saved in the project file and can be undone (Ctrl+Z). With any tool, the status bar also shows the estimated dBm under the mouse.
8. **3D view** (มุมมอง 3D, key **3**): the walls you drew stand up at their real height, coloured by material, with the floor plan and heatmap on the floor and each AP at its mounting height. Drag to rotate, right-drag or Shift+drag to pan, wheel or pinch to zoom. Change the wall height, make walls see-through, or **Save 3D image** (.png) for a proposal. Changing the band or settings in the side panel updates it live. Uses [three.js](https://threejs.org/) (MIT, bundled in `js/vendor/three`, loaded only when opened); it needs the website or a local web server, not a double-clicked `index.html`.
9. Switch between **2.4 / 5 / 6 GHz**, choose the environment, then **Save** the project (.json), **Export image** (.png) or create a **PDF report** for your customer.
10. **Heatmap view**: signal strength, secondary signal (2nd AP, for roaming), SNR, SINR (with interference from APs on overlapping channels), channel interference (co-channel APs above −82 dBm), data rate, serving AP, number of APs heard, and AP load (capacity). The summary shows the share of the area that meets each view's target; a signal check pin shows all of them at that spot.
11. **Attenuation zone (Z)**: draw an area with shelving, warehouse racks, desks, a crowd or trees. Signal loses the zone's dB per metre (per band, presets editable) for the distance it travels inside, up to 40 dB per zone.
12. **Areas with their own requirement and capacity**: select a boundary to give it a name, its own minimum signal and a busy-hour demand (devices and use per device: web, HD video, video calls, 4K, VoIP, IoT or custom Mbps). Coverage %, weak areas and AI placement use each area's requirement. The **AP load** view and the capacity summary show each AP's airtime: demand ÷ (PHY rate × 0.6 MAC efficiency); over 100% or over 50 devices per radio counts as overloaded.
13. **Floors**: the floor panel at the top left of the plan switches floors, adds an empty floor or duplicates this one (plan, walls, zones, boundaries), and opens floor settings (name, floor-to-floor height, slab type, plan offset for alignment, order, delete). Signal from APs on other floors reaches this floor through the slabs, the floor below shows as faint walls, APs above / below as dashed ▲▼ markers, and the 3D view shows the other floors as outlines.
14. **AP table** and **Quote / BOM** (in the Summary card): every AP on every floor with editable name, power, channel and width per band, and a quote with AP models counted on all floors, PoE ports, cable, installation, custom lines, unit prices and VAT. Both export as CSV; prices are saved in the project file.
15. **Export / report** (top bar) opens one menu for every output: full **PDF report**, a **short PDF summary**, an **Excel summary (.xlsx)** with sheets for the summary, 3D pictures, coverage per floor and band, APs, areas, capacity, weak areas, walls, measurements and the quote, **all heatmap and 3D images (ZIP)**, the coverage image (PNG), the design data (CSV) and the project file. Everything is generated in the browser.
    The PDF report, the summary, the Excel file and the ZIP include a 3D picture of each floor (other floors shown as outlines). **PDF report**: choose bands, heatmap views and sections; the report (cover, coverage per floor and band, assumptions, areas, capacity, heatmaps with legends, AP table, walls, calibration, quote) is built in the browser and printed with **Save as PDF**. Nothing is uploaded.
16. **CAD plans (DXF)**: Import floor plan also takes .dxf. Lines, polylines, arcs, circles and blocks are drawn as the plan, the file's units set the scale, and the layers you pick (wall layers are pre-selected by name) become walls, with double-line walls merged into one centre line. DWG: save as DXF first. For image plans, the Wall tool has **Detect walls from the plan**, which turns thick dark horizontal / vertical strokes into walls (thin lines and text are ignored).

| Shortcut | Action |
|---|---|
| V / H / S / W / B / Z / A / M / P | Select, Pan, Scale, Wall, Boundary, Attenuation zone, AP, Survey point, Check signal |
| 3 | 3D view on/off (Esc goes back to 2D) |
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

Each AP has a row per band with Tx power, antenna gain, channel and channel width (2.4 GHz: 20/40, 5 and 6 GHz: 20/40/80/160 MHz). Wi-Fi 6E and 7 models get a 6 GHz radio about 1 dB below their 5 GHz one, except the dual-band Wi-Fi 7 models (U7 Lite, U7 In-Wall, EAP723, RT-BE88U, Xiaomi BE7000, AirEngine 5773-21).

The **Thai NBTC** option caps EIRP at 20 dBm on 2.4 GHz, 23 dBm on 5 GHz ch 36–64, 30 dBm on ch 100+ and 24 dBm (250 mW, indoor) on 6 GHz (5925–6425 MHz, channels 1–93).

## Measured antenna patterns

By default each AP uses a generic pattern for its mounting (ceiling, wall / desk, directional). With a pattern file from the vendor, an AP model can use its measured pattern instead: select an AP, click **Antenna patterns** and load a file per band. Supported: Planet **.msi / .pln** (HORIZONTAL 360 / VERTICAL 360 blocks), **.ant** (360 azimuth then 360 elevation gains) and **CSV** (angle, horizontal dB, vertical dB). The vertical-angle convention can be set when loading (0° = horizon or straight down; angles increasing downwards or upwards). The 3D gain is the sum of the two cuts; the peak gain stays the AP's antenna gain, and the AP's **Pointing** field rotates the pattern. Patterns are saved in the project file and apply to every AP of that model.

Ubiquiti UniFi and TP-Link Omada publish patterns only as images in datasheets, so ask the vendor or distributor for files (Cisco, Aruba, Ruckus and others often provide .msi).

## Required signal

**Auto** picks the minimum acceptable RSSI from the building type: −67 dBm for offices and open halls (voice and video calls), −70 dBm for homes and dorms, −72 dBm for warehouses. You can also pick a profile yourself. Coverage % and the AI use this value, and the heatmap floor follows it (requirement − 15 dB).

## AI assistant

- **Auto-place APs** (runs in the browser, free and offline): a greedy coverage search over candidate positions inside the building, then a local refinement pass. It stops at the target coverage or the AP limit, then assigns non-overlapping channels (2.4 GHz: 1/6/11; 5 GHz: 36/44/149/157).
- **Auto-assign channels**: re-plans channels on every band and every floor to reduce interference, using each radio's width and weighting neighbours by spectral overlap. 5 GHz prefers channels 149+ (higher NBTC limit); DFS channels (52–144) are used only when enabled under Advanced.

## Calibration with site measurements

Predictions use typical values, so check them against real measurements:

1. On site, measure RSSI with a phone app (WiFiman, NetSpot, …) at several points spread over the area, near and far from the APs (5+ points recommended).
2. Pick **Survey point (M)**, click each place you measured and enter the value in dBm and its band, or **Import measurements (CSV)** with columns x, y (metres from the plan's top-left corner), dBm and band (a template can be downloaded from the Calibration card).
3. The **Calibration** card shows the error per band (predicted − measured): mean, RMS and max. An RMS under about 4–6 dB is a good match.
4. **Fit model to measurements** searches the path-loss exponent n (1.5–4.5, with 3+ points) and a per-band offset that minimise the squared error, with a penalty that keeps n near the environment preset unless the measurements clearly disagree (so a few noisy readings can't produce an implausible model).

   **How accurate is it?** In simulated surveys on the sample dorm (readings with ±4 dB phone noise), calibration cut the heatmap's RMS error from about 6–7 dB to about 1.5–2 dB with 8 points per band, and to about 2 dB with 3 points per band. When the preset was already right, calibration cost about 1 dB (8 points) to 2 dB (3 points) from fitting noise. Real buildings add errors the model can't fix (furniture, people, wrong wall materials), so expect roughly 3–5 dB after calibration on site. The heatmap, coverage %, auto-placement, channels and CSV all use the fitted model. **Remove calibration** goes back to the environment preset.

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
- **Wall losses** per crossing at normal incidence (2.4 / 5 GHz, dB): drywall 3/4, glass 3/5, low-E glass 25/32, wood 4/6, AAC block 6/9, plastered brick 7/9, concrete 12/18, heavy concrete 20/28, metal 20/26. Drywall, glass, plastered brick and concrete were checked against ITU-R P.2040-3 material properties for typical Thai wall build-ups (brick: 6.0/7.1 dB computed for a 7 cm brick wall with 1.5 cm plaster on both sides, 7.4/8.7 dB for a double wall). A wall crossed at an angle costs more: × 1/√cos(incidence), at most × 2
- **Diffraction** at each turn: 0.12 dB/° at 2.4 GHz, 0.15 dB/° at 5 GHz (about 11–14 dB for a right-angle turn), at most 25 dB per turn. Paths may turn several times (Dijkstra over corner nodes). Turn this off under *Signal bends along corridors / corners* to get the plain multi-wall model
- **Client device**: laptop 0, tablet −3, phone −5 (default), IoT −8 dB
- **6 GHz** wall losses are a little above 5 GHz (e.g. brick 10, concrete 20 dB)
- **Attenuation zones**: dB per metre inside the zone, at most 40 dB per zone
- **Other floors**: an AP on another floor is placed by the floors' heights and plan offsets; the first slab costs its full loss (concrete 15/18/20 dB at 2.4/5/6 GHz, heavy 20/26/28, concrete on metal deck 25/32/34, timber 6/9/10) and each further slab 40% of its loss (ITU-R P.1238 style); ceiling APs lose 5 dB more towards the floor above
- **Noise floor**: −174 dBm/Hz + 10·log10(width) + 7 dB noise figure (−94 dBm at 20 MHz). **SINR** counts every other radio whose channel overlaps the serving one, with the share of its power inside that channel, as if all were transmitting
- **Data rate**: MCS chosen from SINR (5 dB for MCS 0 … 37 dB for MCS 11, 43 dB for MCS 13), 802.11n/ac/ax/be rate tables, the channel width and the lower of the AP's and the device's standard and spatial streams
- **Fade margin** (default 3 dB): real readings swing a few dB with multipath, people and device orientation, so an area counts as covered only when it beats the requirement by this margin

These are typical published values. Predictions are estimates, so check real installations with a site survey: **Fit model to measurements** tunes `n` and a per-band offset on top of everything above.

**Thai regulatory note (NBTC / กสทช.):** 2.4 GHz is limited to 100 mW EIRP (20 dBm). For 5 GHz, check the limit for each sub-band. The AP panel shows EIRP so you can check it.

## Files

```
index.html      layout
css/style.css   UI (dark / light theme)
js/i18n.js      UI text in 8 languages (add a language: one entry in LANGS + one block in I18N)
js/sample.js    sample 14-room dorm project
js/catalog.js   AP models, NBTC caps, requirement profiles
js/radio.js     bands, channels and widths, spectrum overlap, noise floor, PHY rates
js/antenna.js   measured antenna patterns (.msi / .ant / .csv import, lookup, preview)
js/model.js     materials, attenuation zones, floors / slabs, propagation model, heatmap colours
js/views.js     heatmap views (SNR, SINR, data rate …), area requirements, capacity
js/floors.js    multiple floors: switching, settings, alignment, channels across floors
js/tables.js    AP table, quote / BOM
js/report-pdf.js PDF report (print to PDF)
js/export.js    export menu, Excel summary, heatmap images ZIP
js/xlsx.js      small ZIP / XLSX writer (no library)
js/cad.js       DXF import, wall detection from plan images
js/templates.js building templates (dorm, condo, hotel, house, shop, office, school, warehouse, hall …)
js/i18n-pro.js  UI text for the features above (Thai, English)
js/optimizer.js AP auto-placement, channel assignment, weak-area detection
js/survey.js    site-survey points, error stats, model calibration
js/report.js    design data export (CSV)
js/pdfplan.js   PDF floor plans (pdf.js, vendored in js/vendor/pdfjs)
js/view3d.js    3D view (three.js, vendored in js/vendor/three)
js/app.js       canvas, tools, editing, save / export
```

## Not included

- Live walk-through surveys: browsers cannot read Wi-Fi signal levels, so measurements come from a phone app and are entered or imported as CSV.
- Spectrum analysis, packet capture and cloud collaboration (Beamwise keeps everything on the device).
- DWG files (save as DXF first).
- The new texts are in Thai and English; the other languages show English for them.
