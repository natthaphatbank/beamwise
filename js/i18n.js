// UI text. To add a language: add it to LANGS and add a block to I18N.
// Missing keys fall back to English, so partial translations are safe.
const LANGS = [
  { code: "th", name: "ไทย",        locale: "th-TH" },
  { code: "en", name: "English",    locale: "en-GB" },
  { code: "zh", name: "中文",        locale: "zh-CN" },
  { code: "ja", name: "日本語",      locale: "ja-JP" },
  { code: "ko", name: "한국어",      locale: "ko-KR" },
  { code: "vi", name: "Tiếng Việt", locale: "vi-VN" },
  { code: "lo", name: "ລາວ",        locale: "lo-LA" },
  { code: "my", name: "မြန်မာ",      locale: "my-MM" },
];

const I18N = {
  th: {
    keysTitle: "คีย์ลัดและวิธีใช้", keysMore: "วิธีใช้ทั้งหมด",
    k_wall: "วาดผนัง • ดับเบิลคลิก / Esc เพื่อจบ • Shift ล็อกมุม", k_ap: "วาง Access Point", k_scale: "ตั้งสเกล (คลิก 2 จุดที่รู้ระยะ)",
    k_area: "ขอบเขต / จุดวัดสัญญาณ", k_select: "เลือก / ย้าย", k_box: "คลุมเลือก (ลากขวา = ทั้งเส้นในกรอบ, ลากซ้าย = แค่แตะ)",
    k_shift: "เพิ่ม / ลดสิ่งที่เลือก", k_pan: "เลื่อนมุมมอง • ล้อเมาส์ซูม", k_del: "ลบที่เลือก", k_undo: "ย้อนกลับ / ทำซ้ำ", k_save: "บันทึกโปรเจกต์",
    k_drag: "ลากพื้นที่ว่าง", k_rdrag: "คลิกขวาลาก หรือ Space+ลาก", k_click: "Shift+คลิก",
    wallsSelected: "เลือกผนัง {n} เส้น", itemsSelected: "เลือก AP {a} ตัว + ผนัง {w} เส้น",
    wallsSameMat: "ผนังที่เลือกเป็นวัสดุเดียวกัน", wallsMixedMat: "ผนังที่เลือกมีหลายวัสดุ กดวัสดุด้านล่างเพื่อเปลี่ยนทั้งหมด",
    materialAll: "เปลี่ยนวัสดุทั้งหมดเป็น", totalLength: "ความยาวรวม", selectSameMat: "เลือกผนัง{m}ทั้งหมด ({n} เส้น)",
    wallSelTip: "คลุมเลือก: ลากพื้นที่ว่าง (ลากไปขวา = เฉพาะที่อยู่ในกรอบทั้งเส้น, ลากไปซ้าย = แค่แตะกรอบ) • Shift+คลิกเพื่อเพิ่ม/ลด • Delete เพื่อลบ",
    deleteN: "ลบ {n} รายการ", wallsChanged: "เปลี่ยนผนัง {n} เส้นเป็น{m}แล้ว",
    mixedSelHelp: "เลือกทั้ง AP และผนัง • เลือกเฉพาะอย่างใดอย่างหนึ่งเพื่อแก้ไข หรือลบทั้งหมด", onlyWalls: "เลือกเฉพาะผนัง ({n})", onlyAps: "เลือกเฉพาะ AP ({n})",
    mat_lowe: "กระจก Low-E / เคลือบโลหะ", mat_concreteHeavy: "คอนกรีตหนา / ผนังรับแรง",
    mount: "การติดตั้ง", mount_ceiling: "ติดเพดาน", mount_omni: "ตั้งโต๊ะ / ติดผนัง (รอบทิศ)", mount_directional: "เสาทิศทาง",
    apHeight: "ความสูงติดตั้ง", azimuth: "หันไปทาง", beamwidth: "ความกว้างลำคลื่น",
    clientDevice: "อุปกรณ์ผู้ใช้", client_laptop: "โน้ตบุ๊ก", client_tablet: "แท็บเล็ต", client_phone: "มือถือ", client_iot: "อุปกรณ์ IoT",
    clientHeight: "ความสูงอุปกรณ์", margin: "เผื่อสัญญาณแกว่ง", marginShort: "เผื่อ", pathsOpt: "สัญญาณเลี้ยวตามทางเดิน / มุมผนัง",
    new: "ใหม่", loadPlan: "นำเข้าแบบแปลน", open: "เปิดโปรเจกต์", save: "บันทึก", exportPng: "ส่งออกภาพ",
    toolSelect: "เลือก / ย้าย (V)", toolPan: "เลื่อนมุมมอง (H)", toolScale: "กำหนดสเกล (S)",
    toolWall: "วาดผนัง (W)", toolAp: "วาง Access Point (A)",
    undo: "ย้อนกลับ (Ctrl+Z)", redo: "ทำซ้ำ (Ctrl+Y)", fit: "พอดีหน้าจอ",
    properties: "คุณสมบัติ", display: "การแสดงผล", legend: "ความแรงสัญญาณ", summary: "สรุปผล",
    band: "ย่านความถี่", environment: "สภาพแวดล้อม", opacity: "ความทึบ Heatmap", minSignal: "สัญญาณต่ำสุด",
    envOpen: "โล่ง / ห้องโถง", envOffice: "สำนักงาน", envHome: "บ้าน / หอพัก", envDense: "หนาแน่น / โกดัง",
    nothingSelected: "ยังไม่ได้เลือกอะไร<br>• คลิก AP หรือผนังเพื่อแก้ไข<br>• กด <b>A</b> เพื่อวาง AP, <b>W</b> เพื่อวาดผนัง",
    apName: "ชื่อ", tx24: "กำลังส่ง 2.4G", tx5: "กำลังส่ง 5G", gain: "เกนเสาอากาศ",
    material: "วัสดุผนัง", length: "ความยาว", deleteItem: "ลบ (Delete)",
    wallMaterialForNew: "วัสดุสำหรับผนังใหม่",
    scaleLen: "ความยาวจริงของเส้น", applyScale: "ตั้งสเกล", scaleHelp: "คลิก 2 จุดบนแบบแปลนที่รู้ระยะจริง เช่น ความยาวผนังหรือประตู",
    apCount: "จำนวน AP", wallCount: "จำนวนผนัง", area: "พื้นที่", covGood: "สัญญาณดี (≥ -67)", covOk: "ใช้งานได้ (≥ -75)", covNone: "จุดอับสัญญาณ",
    hintSelect: "ลาก AP เพื่อย้าย • คลิกผนังเพื่อเปลี่ยนวัสดุ • ลากพื้นที่ว่างเพื่อคลุมเลือก • คลิกขวาหรือ Space+ลากเพื่อเลื่อน • ล้อเมาส์เพื่อซูม",
    hintPan: "ลากเพื่อเลื่อนมุมมอง • ล้อเมาส์เพื่อซูม",
    hintScale: "คลิกจุดเริ่มต้นและจุดสิ้นสุดของระยะที่รู้ความยาว",
    hintWall: "คลิกเพื่อวาดผนังต่อเนื่อง • ดับเบิลคลิก / Esc / คลิกขวา เพื่อจบ • กด Shift เพื่อล็อกมุม",
    hintAp: "คลิกบนแบบแปลนเพื่อวาง Access Point",
    sGood: "ดีมาก — วิดีโอคอล / VoIP", sGood2: "ดี — ใช้งานทั่วไป", sOk: "พอใช้ — เว็บ / แชท", sWeak: "อ่อน — ไม่เสถียร", sBad: "แย่มาก",
    saved: "บันทึกแล้ว", loaded: "เปิดโปรเจกต์แล้ว", exported: "ส่งออกภาพแล้ว", planLoaded: "นำเข้าแบบแปลนแล้ว — ต่อไปให้ตั้งสเกล (S)",
    scaleSet: "ตั้งสเกลแล้ว", badFile: "ไฟล์ไม่ถูกต้อง", autosaveFull: "แบบแปลนใหญ่เกินกว่าจะบันทึกอัตโนมัติ — กด บันทึก เพื่อเก็บไฟล์",
    blankPlan: "พื้นที่เปล่า 30×20 ม. — นำเข้าแบบแปลนเพื่อเริ่มงานจริง",
    exportTitle: "แผนที่สัญญาณ Wi-Fi", noScale: "ยังไม่ได้ตั้งสเกล",
    help: "วิธีใช้", finishWall: "จบการวาดผนัง", cancel: "ยกเลิก", confirm: "ยืนยัน", language: "ภาษา",
    disclaimer: "ผลลัพธ์เป็นการคาดการณ์จากค่ามาตรฐานของวัสดุ ควรตรวจวัดหน้างานจริงก่อนติดตั้ง",
    welcomeTitle: "ยินดีต้อนรับสู่ Beamwise",
    welcomeIntro: "ออกแบบตำแหน่ง Access Point บนแบบแปลน และดูความแรงสัญญาณ Wi-Fi ได้ทันที — ฟรี ไม่ต้องติดตั้ง ข้อมูลอยู่ในเครื่องของคุณเท่านั้น",
    welcomeSteps: "<li><b>นำเข้าแบบแปลน</b> — รูป PNG/JPG/PDF หรือถ่ายรูปแบบแปลนด้วยมือถือ</li><li><b>ตั้งสเกล (S)</b> — คลิก 2 จุดที่รู้ระยะจริง</li><li><b>วาดผนัง (W)</b> — เลือกวัสดุ เช่น อิฐมวลเบา คอนกรีต กระจก</li><li><b>วาง AP (A)</b> — ลากย้ายได้ Heatmap อัปเดตทันที</li><li><b>ส่งออกภาพ</b> — แนบใบเสนอราคาให้ลูกค้า</li>",
    tryDemo: "ลองตัวอย่าง: หอพัก 14 ห้อง", startOwn: "เริ่มด้วยแบบแปลนของฉัน", startBlank: "เริ่มจากพื้นที่เปล่า",
    newTitle: "เริ่มโปรเจกต์ใหม่?", newBody: "ผนังและ AP ทั้งหมดในโปรเจกต์นี้จะถูกล้าง (กด บันทึก ก่อนถ้าต้องการเก็บไว้)",
    planTitle: "เปลี่ยนแบบแปลน?", planBody: "การนำเข้าแบบแปลนใหม่จะล้างผนังและ AP ที่มีอยู่ (กด บันทึก ก่อนถ้าต้องการเก็บไว้)",
    sampleLoaded: "โหลดตัวอย่างหอพักแล้ว — ลองลาก AP หรือสลับ 2.4/5 GHz",
    mat_drywall: "ยิปซัม", mat_glass: "กระจก", mat_wood: "ไม้ / ประตู", mat_aac: "อิฐมวลเบา",
    mat_brick: "อิฐมอญฉาบปูน", mat_concrete: "คอนกรีต", mat_metal: "โลหะ / ลิฟต์",
  },

  en: {
    keysTitle: "Shortcuts & how to", keysMore: "Full guide",
    k_wall: "Draw walls • double-click / Esc to finish • Shift locks the angle", k_ap: "Place an access point", k_scale: "Set the scale (click 2 points with a known distance)",
    k_area: "Coverage boundary / survey point", k_select: "Select / move", k_box: "Box select (drag right = fully inside, drag left = touching)",
    k_shift: "Add to / remove from the selection", k_pan: "Pan • scroll to zoom", k_del: "Delete selection", k_undo: "Undo / redo", k_save: "Save project",
    k_drag: "Drag empty space", k_rdrag: "Right-drag or Space+drag", k_click: "Shift+click",
    wallsSelected: "{n} walls selected", itemsSelected: "{a} APs + {w} walls selected",
    wallsSameMat: "The selected walls share one material", wallsMixedMat: "The selected walls have different materials; pick one below to change them all",
    materialAll: "Change all to", totalLength: "Total length", selectSameMat: "Select all {m} walls ({n})",
    wallSelTip: "Box select: drag on empty space (drag right = fully inside, drag left = touching) • Shift+click to add/remove • Delete to remove",
    deleteN: "Delete {n} items", wallsChanged: "Changed {n} walls to {m}",
    mixedSelHelp: "APs and walls are selected • keep only one kind to edit it, or delete everything", onlyWalls: "Keep only walls ({n})", onlyAps: "Keep only APs ({n})",
    mat_lowe: "Low-E / coated glass", mat_concreteHeavy: "Heavy concrete / shear wall",
    mount: "Mounting", mount_ceiling: "Ceiling", mount_omni: "Desk / wall (omni)", mount_directional: "Directional antenna",
    apHeight: "Mount height", azimuth: "Pointing", beamwidth: "Beamwidth",
    clientDevice: "Client device", client_laptop: "Laptop", client_tablet: "Tablet", client_phone: "Phone", client_iot: "IoT device",
    clientHeight: "Device height", margin: "Fade margin", marginShort: "margin", pathsOpt: "Signal bends along corridors / corners",
    new: "New", loadPlan: "Import floor plan", open: "Open project", save: "Save", exportPng: "Export image",
    toolSelect: "Select / move (V)", toolPan: "Pan view (H)", toolScale: "Set scale (S)",
    toolWall: "Draw walls (W)", toolAp: "Place access point (A)",
    undo: "Undo (Ctrl+Z)", redo: "Redo (Ctrl+Y)", fit: "Fit to screen",
    properties: "Properties", display: "Display", legend: "Signal strength", summary: "Summary",
    band: "Band", environment: "Environment", opacity: "Heatmap opacity", minSignal: "Min signal",
    envOpen: "Open hall", envOffice: "Office", envHome: "Home / dorm", envDense: "Dense / warehouse",
    nothingSelected: "Nothing selected<br>• Click an AP or wall to edit it<br>• Press <b>A</b> to place an AP, <b>W</b> to draw walls",
    apName: "Name", tx24: "Tx power 2.4G", tx5: "Tx power 5G", gain: "Antenna gain",
    material: "Wall material", length: "Length", deleteItem: "Delete",
    wallMaterialForNew: "Material for new walls",
    scaleLen: "Real length of line", applyScale: "Set scale", scaleHelp: "Click 2 points on the plan with a known real distance, e.g. a wall or door width",
    apCount: "Access points", wallCount: "Walls", area: "Area", covGood: "Good (≥ -67)", covOk: "Usable (≥ -75)", covNone: "Dead zones",
    hintSelect: "Drag APs to move • Click a wall to change material • Drag empty space to box-select • Right-drag or Space+drag to pan • Scroll to zoom",
    hintPan: "Drag to pan • Scroll to zoom",
    hintScale: "Click the start and end of a distance you know",
    hintWall: "Click to draw connected walls • Double-click / Esc / right-click to finish • Hold Shift to lock angle",
    hintAp: "Click on the plan to place an access point",
    sGood: "Excellent — video calls / VoIP", sGood2: "Good — general use", sOk: "Fair — web / chat", sWeak: "Weak — unstable", sBad: "Very poor",
    saved: "Saved", loaded: "Project opened", exported: "Image exported", planLoaded: "Floor plan imported — next, set the scale (S)",
    scaleSet: "Scale set", badFile: "Invalid file", autosaveFull: "Floor plan too large to autosave — use Save to keep a file",
    blankPlan: "Blank 30×20 m area — import a floor plan for real work",
    exportTitle: "Wi-Fi coverage map", noScale: "Scale not set",
    help: "Help", finishWall: "Finish wall", cancel: "Cancel", confirm: "Confirm", language: "Language",
    disclaimer: "Results are predictions based on typical material values. Verify on site before installing.",
    welcomeTitle: "Welcome to Beamwise",
    welcomeIntro: "Plan access point placement on a floor plan and see Wi-Fi signal strength instantly. Free, no install, and your data stays on your device.",
    welcomeSteps: "<li><b>Import a floor plan</b>: a PNG/JPG/PDF, or a phone photo of the plan</li><li><b>Set scale (S)</b>: click 2 points with a known distance</li><li><b>Draw walls (W)</b>: pick materials like AAC block, concrete, glass</li><li><b>Place APs (A)</b>: drag them around; the heatmap updates live</li><li><b>Export image</b>: attach it to your customer quote</li>",
    tryDemo: "Try sample: 14-room dorm", startOwn: "Start with my floor plan", startBlank: "Start with a blank area",
    newTitle: "Start a new project?", newBody: "All walls and APs in this project will be cleared (use Save first to keep them).",
    planTitle: "Replace floor plan?", planBody: "Importing a new floor plan clears the existing walls and APs (use Save first to keep them).",
    sampleLoaded: "Sample dorm loaded. Try dragging an AP or switching 2.4/5 GHz",
    mat_drywall: "Drywall", mat_glass: "Glass", mat_wood: "Wood / door", mat_aac: "AAC block",
    mat_brick: "Brick (plastered)", mat_concrete: "Concrete", mat_metal: "Metal / elevator",
  },

  zh: {
    new: "新建", loadPlan: "导入平面图", open: "打开项目", save: "保存", exportPng: "导出图片",
    toolSelect: "选择 / 移动 (V)", toolPan: "平移视图 (H)", toolScale: "设置比例 (S)",
    toolWall: "绘制墙体 (W)", toolAp: "放置接入点 (A)",
    undo: "撤销 (Ctrl+Z)", redo: "重做 (Ctrl+Y)", fit: "适应屏幕",
    properties: "属性", display: "显示", legend: "信号强度", summary: "汇总",
    band: "频段", environment: "环境", opacity: "热图透明度", minSignal: "最低信号",
    envOpen: "开阔大厅", envOffice: "办公室", envHome: "住宅 / 宿舍", envDense: "密集 / 仓库",
    nothingSelected: "未选择任何对象<br>• 点击 AP 或墙体进行编辑<br>• 按 <b>A</b> 放置 AP，按 <b>W</b> 绘制墙体",
    apName: "名称", tx24: "发射功率 2.4G", tx5: "发射功率 5G", gain: "天线增益",
    material: "墙体材料", length: "长度", deleteItem: "删除",
    wallMaterialForNew: "新墙体材料",
    scaleLen: "线段实际长度", applyScale: "设置比例", scaleHelp: "在平面图上点击已知实际距离的两点，例如墙长或门宽",
    apCount: "接入点", wallCount: "墙体", area: "面积", covGood: "良好 (≥ -67)", covOk: "可用 (≥ -75)", covNone: "信号盲区",
    hintSelect: "拖动 AP 移动 • 点击墙体更换材料 • 拖动空白处框选 • 右键拖动或空格+拖动平移 • 滚轮缩放",
    hintPan: "拖动平移 • 滚轮缩放",
    hintScale: "点击已知距离的起点和终点",
    hintWall: "点击连续绘制墙体 • 双击 / Esc / 右键结束 • 按住 Shift 锁定角度",
    hintAp: "在平面图上点击以放置接入点",
    sGood: "极佳 — 视频通话 / VoIP", sGood2: "良好 — 日常使用", sOk: "一般 — 网页 / 聊天", sWeak: "较弱 — 不稳定", sBad: "极差",
    saved: "已保存", loaded: "项目已打开", exported: "图片已导出", planLoaded: "平面图已导入 — 下一步请设置比例 (S)",
    scaleSet: "比例已设置", badFile: "文件无效", autosaveFull: "平面图过大，无法自动保存 — 请点击保存存储文件",
    blankPlan: "空白区域 30×20 米 — 导入平面图开始实际工作",
    exportTitle: "Wi-Fi 覆盖图", noScale: "尚未设置比例",
    help: "帮助", finishWall: "完成墙体", cancel: "取消", confirm: "确认", language: "语言",
    disclaimer: "结果基于常见材料参数的预测，安装前请进行现场测量验证。",
    welcomeTitle: "欢迎使用 Beamwise",
    welcomeIntro: "在平面图上规划接入点位置，即时查看 Wi-Fi 信号强度。免费、无需安装，数据仅保存在您的设备上。",
    welcomeSteps: "<li><b>导入平面图</b>：PNG/JPG/PDF 图片，或用手机拍摄的平面图</li><li><b>设置比例 (S)</b>：点击已知距离的两点</li><li><b>绘制墙体 (W)</b>：选择加气砖、混凝土、玻璃等材料</li><li><b>放置 AP (A)</b>：可拖动，热图实时更新</li><li><b>导出图片</b>：附在给客户的报价单中</li>",
    tryDemo: "试用示例：14 间房宿舍", startOwn: "使用我的平面图", startBlank: "从空白区域开始",
    newTitle: "新建项目？", newBody: "此项目中的所有墙体和 AP 将被清除（如需保留，请先保存）。",
    planTitle: "更换平面图？", planBody: "导入新平面图将清除现有墙体和 AP（如需保留，请先保存）。",
    sampleLoaded: "已载入宿舍示例 — 试试拖动 AP 或切换 2.4/5 GHz",
    mat_drywall: "石膏板", mat_glass: "玻璃", mat_wood: "木材 / 门", mat_aac: "加气砖",
    mat_brick: "抹灰砖墙", mat_concrete: "混凝土", mat_metal: "金属 / 电梯",
  },

  ja: {
    new: "新規", loadPlan: "図面をインポート", open: "プロジェクトを開く", save: "保存", exportPng: "画像を書き出す",
    toolSelect: "選択 / 移動 (V)", toolPan: "表示を移動 (H)", toolScale: "縮尺を設定 (S)",
    toolWall: "壁を描く (W)", toolAp: "アクセスポイントを配置 (A)",
    undo: "元に戻す (Ctrl+Z)", redo: "やり直す (Ctrl+Y)", fit: "画面に合わせる",
    properties: "プロパティ", display: "表示", legend: "電波強度", summary: "概要",
    band: "周波数帯", environment: "環境", opacity: "ヒートマップの不透明度", minSignal: "最小信号",
    envOpen: "広いホール", envOffice: "オフィス", envHome: "住宅 / 寮", envDense: "密集 / 倉庫",
    nothingSelected: "何も選択されていません<br>• AP や壁をクリックして編集<br>• <b>A</b> で AP を配置、<b>W</b> で壁を描画",
    apName: "名前", tx24: "送信出力 2.4G", tx5: "送信出力 5G", gain: "アンテナ利得",
    material: "壁の材質", length: "長さ", deleteItem: "削除",
    wallMaterialForNew: "新しい壁の材質",
    scaleLen: "線の実際の長さ", applyScale: "縮尺を設定", scaleHelp: "実際の距離が分かる 2 点を図面上でクリック（壁の長さやドア幅など）",
    apCount: "アクセスポイント", wallCount: "壁", area: "面積", covGood: "良好 (≥ -67)", covOk: "使用可 (≥ -75)", covNone: "圏外エリア",
    hintSelect: "AP をドラッグで移動 • 壁をクリックで材質変更 • 空白をドラッグで範囲選択 • 右ドラッグか Space+ドラッグで移動 • ホイールでズーム",
    hintPan: "ドラッグで移動 • ホイールでズーム",
    hintScale: "距離が分かる区間の始点と終点をクリック",
    hintWall: "クリックで壁を連続描画 • ダブルクリック / Esc / 右クリックで終了 • Shift で角度固定",
    hintAp: "図面をクリックしてアクセスポイントを配置",
    sGood: "非常に良い — ビデオ通話 / VoIP", sGood2: "良い — 一般的な利用", sOk: "普通 — Web / チャット", sWeak: "弱い — 不安定", sBad: "非常に悪い",
    saved: "保存しました", loaded: "プロジェクトを開きました", exported: "画像を書き出しました", planLoaded: "図面をインポートしました — 次に縮尺を設定してください (S)",
    scaleSet: "縮尺を設定しました", badFile: "無効なファイルです", autosaveFull: "図面が大きすぎて自動保存できません — 保存でファイルに残してください",
    blankPlan: "空白エリア 30×20 m — 実際の作業には図面をインポートしてください",
    exportTitle: "Wi-Fi カバレッジマップ", noScale: "縮尺が未設定です",
    help: "使い方", finishWall: "壁の描画を終了", cancel: "キャンセル", confirm: "確認", language: "言語",
    disclaimer: "結果は一般的な材質の値に基づく予測です。設置前に現地で測定してください。",
    welcomeTitle: "Beamwise へようこそ",
    welcomeIntro: "図面上でアクセスポイントの配置を計画し、Wi-Fi の電波強度をすぐに確認できます。無料・インストール不要で、データはお使いの端末内にのみ保存されます。",
    welcomeSteps: "<li><b>図面をインポート</b>：PNG/JPG/PDF 画像、またはスマホで撮影した図面</li><li><b>縮尺を設定 (S)</b>：距離が分かる 2 点をクリック</li><li><b>壁を描く (W)</b>：ALC ブロック、コンクリート、ガラスなどを選択</li><li><b>AP を配置 (A)</b>：ドラッグで移動、ヒートマップが即時更新</li><li><b>画像を書き出す</b>：お客様への見積書に添付</li>",
    tryDemo: "サンプル：14 室の寮", startOwn: "自分の図面で始める", startBlank: "空白エリアから始める",
    newTitle: "新しいプロジェクトを始めますか？", newBody: "このプロジェクトの壁と AP はすべて消去されます（残す場合は先に保存してください）。",
    planTitle: "図面を置き換えますか？", planBody: "新しい図面をインポートすると既存の壁と AP は消去されます（残す場合は先に保存してください）。",
    sampleLoaded: "寮のサンプルを読み込みました — AP をドラッグしたり 2.4/5 GHz を切り替えてみてください",
    mat_drywall: "石膏ボード", mat_glass: "ガラス", mat_wood: "木材 / ドア", mat_aac: "ALC ブロック",
    mat_brick: "レンガ（モルタル仕上げ）", mat_concrete: "コンクリート", mat_metal: "金属 / エレベーター",
  },

  ko: {
    new: "새로 만들기", loadPlan: "평면도 가져오기", open: "프로젝트 열기", save: "저장", exportPng: "이미지 내보내기",
    toolSelect: "선택 / 이동 (V)", toolPan: "화면 이동 (H)", toolScale: "축척 설정 (S)",
    toolWall: "벽 그리기 (W)", toolAp: "AP 배치 (A)",
    undo: "실행 취소 (Ctrl+Z)", redo: "다시 실행 (Ctrl+Y)", fit: "화면에 맞추기",
    properties: "속성", display: "표시", legend: "신호 세기", summary: "요약",
    band: "주파수 대역", environment: "환경", opacity: "히트맵 불투명도", minSignal: "최소 신호",
    envOpen: "개방형 홀", envOffice: "사무실", envHome: "주택 / 기숙사", envDense: "밀집 / 창고",
    nothingSelected: "선택된 항목 없음<br>• AP나 벽을 클릭해 편집<br>• <b>A</b>로 AP 배치, <b>W</b>로 벽 그리기",
    apName: "이름", tx24: "송신 출력 2.4G", tx5: "송신 출력 5G", gain: "안테나 이득",
    material: "벽 재질", length: "길이", deleteItem: "삭제",
    wallMaterialForNew: "새 벽 재질",
    scaleLen: "선의 실제 길이", applyScale: "축척 설정", scaleHelp: "실제 거리를 아는 두 점을 평면도에서 클릭하세요 (예: 벽 길이, 문 폭)",
    apCount: "AP 수", wallCount: "벽 수", area: "면적", covGood: "양호 (≥ -67)", covOk: "사용 가능 (≥ -75)", covNone: "음영 지역",
    hintSelect: "AP 드래그로 이동 • 벽 클릭으로 재질 변경 • 빈 곳 드래그로 영역 선택 • 오른쪽 드래그 또는 Space+드래그로 화면 이동 • 휠로 확대/축소",
    hintPan: "드래그로 이동 • 휠로 확대/축소",
    hintScale: "길이를 아는 구간의 시작점과 끝점을 클릭",
    hintWall: "클릭해 벽을 연속으로 그리기 • 더블클릭 / Esc / 우클릭으로 종료 • Shift로 각도 고정",
    hintAp: "평면도를 클릭해 AP 배치",
    sGood: "매우 좋음 — 영상 통화 / VoIP", sGood2: "좋음 — 일반 사용", sOk: "보통 — 웹 / 채팅", sWeak: "약함 — 불안정", sBad: "매우 나쁨",
    saved: "저장됨", loaded: "프로젝트를 열었습니다", exported: "이미지를 내보냈습니다", planLoaded: "평면도를 가져왔습니다 — 다음으로 축척을 설정하세요 (S)",
    scaleSet: "축척이 설정되었습니다", badFile: "잘못된 파일입니다", autosaveFull: "평면도가 커서 자동 저장할 수 없습니다 — 저장 버튼으로 파일을 보관하세요",
    blankPlan: "빈 영역 30×20 m — 실제 작업은 평면도를 가져오세요",
    exportTitle: "Wi-Fi 커버리지 맵", noScale: "축척이 설정되지 않음",
    help: "도움말", finishWall: "벽 그리기 완료", cancel: "취소", confirm: "확인", language: "언어",
    disclaimer: "결과는 일반적인 재질 값에 기반한 예측입니다. 설치 전 현장에서 측정해 확인하세요.",
    welcomeTitle: "Beamwise에 오신 것을 환영합니다",
    welcomeIntro: "평면도에서 AP 위치를 계획하고 Wi-Fi 신호 세기를 바로 확인하세요. 무료이며 설치가 필요 없고, 데이터는 사용자 기기에만 저장됩니다.",
    welcomeSteps: "<li><b>평면도 가져오기</b>: PNG/JPG/PDF 또는 휴대폰으로 찍은 평면도</li><li><b>축척 설정 (S)</b>: 거리를 아는 두 점 클릭</li><li><b>벽 그리기 (W)</b>: 경량 블록, 콘크리트, 유리 등 재질 선택</li><li><b>AP 배치 (A)</b>: 드래그로 이동, 히트맵 실시간 갱신</li><li><b>이미지 내보내기</b>: 고객 견적서에 첨부</li>",
    tryDemo: "예제 보기: 14실 기숙사", startOwn: "내 평면도로 시작", startBlank: "빈 영역으로 시작",
    newTitle: "새 프로젝트를 시작할까요?", newBody: "이 프로젝트의 모든 벽과 AP가 지워집니다 (보관하려면 먼저 저장하세요).",
    planTitle: "평면도를 바꿀까요?", planBody: "새 평면도를 가져오면 기존 벽과 AP가 지워집니다 (보관하려면 먼저 저장하세요).",
    sampleLoaded: "기숙사 예제를 불러왔습니다 — AP를 드래그하거나 2.4/5 GHz를 바꿔 보세요",
    mat_drywall: "석고보드", mat_glass: "유리", mat_wood: "목재 / 문", mat_aac: "경량 기포 블록",
    mat_brick: "벽돌 (미장)", mat_concrete: "콘크리트", mat_metal: "금속 / 엘리베이터",
  },

  vi: {
    new: "Mới", loadPlan: "Nhập bản vẽ mặt bằng", open: "Mở dự án", save: "Lưu", exportPng: "Xuất ảnh",
    toolSelect: "Chọn / di chuyển (V)", toolPan: "Kéo khung nhìn (H)", toolScale: "Đặt tỷ lệ (S)",
    toolWall: "Vẽ tường (W)", toolAp: "Đặt điểm truy cập (A)",
    undo: "Hoàn tác (Ctrl+Z)", redo: "Làm lại (Ctrl+Y)", fit: "Vừa màn hình",
    properties: "Thuộc tính", display: "Hiển thị", legend: "Cường độ tín hiệu", summary: "Tổng quan",
    band: "Băng tần", environment: "Môi trường", opacity: "Độ đậm heatmap", minSignal: "Tín hiệu tối thiểu",
    envOpen: "Sảnh rộng", envOffice: "Văn phòng", envHome: "Nhà ở / ký túc xá", envDense: "Dày đặc / nhà kho",
    nothingSelected: "Chưa chọn gì<br>• Nhấp vào AP hoặc tường để chỉnh sửa<br>• Nhấn <b>A</b> để đặt AP, <b>W</b> để vẽ tường",
    apName: "Tên", tx24: "Công suất phát 2.4G", tx5: "Công suất phát 5G", gain: "Độ lợi ăng-ten",
    material: "Vật liệu tường", length: "Chiều dài", deleteItem: "Xóa",
    wallMaterialForNew: "Vật liệu cho tường mới",
    scaleLen: "Chiều dài thực của đoạn", applyScale: "Đặt tỷ lệ", scaleHelp: "Nhấp 2 điểm trên bản vẽ có khoảng cách thực đã biết, ví dụ chiều dài tường hoặc bề rộng cửa",
    apCount: "Số AP", wallCount: "Số tường", area: "Diện tích", covGood: "Tốt (≥ -67)", covOk: "Dùng được (≥ -75)", covNone: "Vùng chết",
    hintSelect: "Kéo AP để di chuyển • Nhấp tường để đổi vật liệu • Kéo vùng trống để chọn theo khung • Kéo chuột phải hoặc Space+kéo để di chuyển • Cuộn chuột để phóng to",
    hintPan: "Kéo để di chuyển • Cuộn chuột để phóng to",
    hintScale: "Nhấp điểm đầu và điểm cuối của một khoảng cách đã biết",
    hintWall: "Nhấp để vẽ tường liên tục • Nhấp đúp / Esc / chuột phải để kết thúc • Giữ Shift để khóa góc",
    hintAp: "Nhấp lên bản vẽ để đặt điểm truy cập",
    sGood: "Rất tốt — gọi video / VoIP", sGood2: "Tốt — sử dụng chung", sOk: "Khá — web / chat", sWeak: "Yếu — không ổn định", sBad: "Rất kém",
    saved: "Đã lưu", loaded: "Đã mở dự án", exported: "Đã xuất ảnh", planLoaded: "Đã nhập bản vẽ — tiếp theo hãy đặt tỷ lệ (S)",
    scaleSet: "Đã đặt tỷ lệ", badFile: "Tệp không hợp lệ", autosaveFull: "Bản vẽ quá lớn để tự động lưu — hãy nhấn Lưu để giữ tệp",
    blankPlan: "Vùng trống 30×20 m — nhập bản vẽ để làm việc thực tế",
    exportTitle: "Bản đồ phủ sóng Wi-Fi", noScale: "Chưa đặt tỷ lệ",
    help: "Hướng dẫn", finishWall: "Kết thúc vẽ tường", cancel: "Hủy", confirm: "Xác nhận", language: "Ngôn ngữ",
    disclaimer: "Kết quả là dự đoán dựa trên thông số vật liệu thông dụng. Hãy đo kiểm tại hiện trường trước khi lắp đặt.",
    welcomeTitle: "Chào mừng đến với Beamwise",
    welcomeIntro: "Lập kế hoạch vị trí điểm truy cập trên bản vẽ mặt bằng và xem cường độ Wi-Fi ngay lập tức. Miễn phí, không cần cài đặt, dữ liệu chỉ lưu trên thiết bị của bạn.",
    welcomeSteps: "<li><b>Nhập bản vẽ</b>: ảnh PNG/JPG/PDF hoặc ảnh chụp bản vẽ bằng điện thoại</li><li><b>Đặt tỷ lệ (S)</b>: nhấp 2 điểm có khoảng cách đã biết</li><li><b>Vẽ tường (W)</b>: chọn vật liệu như gạch nhẹ, bê tông, kính</li><li><b>Đặt AP (A)</b>: kéo để di chuyển, heatmap cập nhật ngay</li><li><b>Xuất ảnh</b>: đính kèm vào báo giá cho khách hàng</li>",
    tryDemo: "Thử ví dụ: ký túc xá 14 phòng", startOwn: "Bắt đầu với bản vẽ của tôi", startBlank: "Bắt đầu với vùng trống",
    newTitle: "Tạo dự án mới?", newBody: "Toàn bộ tường và AP trong dự án này sẽ bị xóa (hãy Lưu trước nếu muốn giữ lại).",
    planTitle: "Thay bản vẽ?", planBody: "Nhập bản vẽ mới sẽ xóa tường và AP hiện có (hãy Lưu trước nếu muốn giữ lại).",
    sampleLoaded: "Đã tải ví dụ ký túc xá — thử kéo AP hoặc chuyển 2.4/5 GHz",
    mat_drywall: "Thạch cao", mat_glass: "Kính", mat_wood: "Gỗ / cửa", mat_aac: "Gạch bê tông nhẹ",
    mat_brick: "Gạch trát vữa", mat_concrete: "Bê tông", mat_metal: "Kim loại / thang máy",
  },

  lo: {
    new: "ໃໝ່", loadPlan: "ນຳເຂົ້າແຜນຜັງ", open: "ເປີດໂປຣເຈັກ", save: "ບັນທຶກ", exportPng: "ສົ່ງອອກຮູບ",
    toolSelect: "ເລືອກ / ຍ້າຍ (V)", toolPan: "ເລື່ອນມຸມມອງ (H)", toolScale: "ກຳນົດມາດຕາສ່ວນ (S)",
    toolWall: "ແຕ້ມຝາ (W)", toolAp: "ວາງ Access Point (A)",
    undo: "ຍ້ອນກັບ (Ctrl+Z)", redo: "ເຮັດຊ້ຳ (Ctrl+Y)", fit: "ພໍດີໜ້າຈໍ",
    properties: "ຄຸນສົມບັດ", display: "ການສະແດງຜົນ", legend: "ຄວາມແຮງສັນຍານ", summary: "ສະຫຼຸບ",
    band: "ຄື້ນຄວາມຖີ່", environment: "ສະພາບແວດລ້ອມ", opacity: "ຄວາມທຶບ Heatmap", minSignal: "ສັນຍານຕ່ຳສຸດ",
    envOpen: "ຫ້ອງໂຖງກວ້າງ", envOffice: "ຫ້ອງການ", envHome: "ເຮືອນ / ຫໍພັກ", envDense: "ໜາແໜ້ນ / ສາງ",
    nothingSelected: "ຍັງບໍ່ໄດ້ເລືອກ<br>• ຄລິກ AP ຫຼື ຝາ ເພື່ອແກ້ໄຂ<br>• ກົດ <b>A</b> ເພື່ອວາງ AP, <b>W</b> ເພື່ອແຕ້ມຝາ",
    apName: "ຊື່", tx24: "ກຳລັງສົ່ງ 2.4G", tx5: "ກຳລັງສົ່ງ 5G", gain: "ເກນເສົາອາກາດ",
    material: "ວັດສະດຸຝາ", length: "ຄວາມຍາວ", deleteItem: "ລຶບ",
    wallMaterialForNew: "ວັດສະດຸສຳລັບຝາໃໝ່",
    scaleLen: "ຄວາມຍາວຕົວຈິງຂອງເສັ້ນ", applyScale: "ຕັ້ງມາດຕາສ່ວນ", scaleHelp: "ຄລິກ 2 ຈຸດເທິງແຜນຜັງທີ່ຮູ້ໄລຍະຕົວຈິງ ເຊັ່ນ ຄວາມຍາວຝາ ຫຼື ປະຕູ",
    apCount: "ຈຳນວນ AP", wallCount: "ຈຳນວນຝາ", area: "ເນື້ອທີ່", covGood: "ສັນຍານດີ (≥ -67)", covOk: "ໃຊ້ງານໄດ້ (≥ -75)", covNone: "ຈຸດອັບສັນຍານ",

    hintPan: "ລາກເພື່ອເລື່ອນ • ໝຸນເມົ້າເພື່ອຊູມ",
    hintScale: "ຄລິກຈຸດເລີ່ມ ແລະ ຈຸດສິ້ນສຸດຂອງໄລຍະທີ່ຮູ້ຄວາມຍາວ",
    hintWall: "ຄລິກເພື່ອແຕ້ມຝາຕໍ່ເນື່ອງ • ຄລິກສອງເທື່ອ / Esc / ຄລິກຂວາ ເພື່ອຈົບ • ກົດ Shift ເພື່ອລັອກມຸມ",
    hintAp: "ຄລິກເທິງແຜນຜັງເພື່ອວາງ Access Point",
    sGood: "ດີຫຼາຍ — ວິດີໂອຄອລ / VoIP", sGood2: "ດີ — ໃຊ້ງານທົ່ວໄປ", sOk: "ພໍໃຊ້ — ເວັບ / ແຊັດ", sWeak: "ອ່ອນ — ບໍ່ໝັ້ນຄົງ", sBad: "ບໍ່ດີຫຼາຍ",
    saved: "ບັນທຶກແລ້ວ", loaded: "ເປີດໂປຣເຈັກແລ້ວ", exported: "ສົ່ງອອກຮູບແລ້ວ", planLoaded: "ນຳເຂົ້າແຜນຜັງແລ້ວ — ຕໍ່ໄປໃຫ້ຕັ້ງມາດຕາສ່ວນ (S)",
    scaleSet: "ຕັ້ງມາດຕາສ່ວນແລ້ວ", badFile: "ໄຟລ໌ບໍ່ຖືກຕ້ອງ", autosaveFull: "ແຜນຜັງໃຫຍ່ເກີນໄປສຳລັບການບັນທຶກອັດຕະໂນມັດ — ກົດ ບັນທຶກ ເພື່ອເກັບໄຟລ໌",
    blankPlan: "ພື້ນທີ່ຫວ່າງ 30×20 ມ. — ນຳເຂົ້າແຜນຜັງເພື່ອເລີ່ມວຽກຕົວຈິງ",
    exportTitle: "ແຜນທີ່ສັນຍານ Wi-Fi", noScale: "ຍັງບໍ່ໄດ້ຕັ້ງມາດຕາສ່ວນ",
    help: "ວິທີໃຊ້", finishWall: "ຈົບການແຕ້ມຝາ", cancel: "ຍົກເລີກ", confirm: "ຢືນຢັນ", language: "ພາສາ",
    disclaimer: "ຜົນລັບເປັນການຄາດຄະເນຈາກຄ່າມາດຕະຖານຂອງວັດສະດຸ ຄວນກວດວັດໜ້າງານຕົວຈິງກ່ອນຕິດຕັ້ງ",
    welcomeTitle: "ຍິນດີຕ້ອນຮັບສູ່ Beamwise",
    welcomeIntro: "ອອກແບບຕຳແໜ່ງ Access Point ເທິງແຜນຜັງ ແລະ ເບິ່ງຄວາມແຮງສັນຍານ Wi-Fi ໄດ້ທັນທີ — ຟຣີ ບໍ່ຕ້ອງຕິດຕັ້ງ ຂໍ້ມູນຢູ່ໃນເຄື່ອງຂອງທ່ານເທົ່ານັ້ນ",
    welcomeSteps: "<li><b>ນຳເຂົ້າແຜນຜັງ</b> — ຮູບ PNG/JPG/PDF ຫຼື ຖ່າຍຮູບແຜນຜັງດ້ວຍມືຖື</li><li><b>ຕັ້ງມາດຕາສ່ວນ (S)</b> — ຄລິກ 2 ຈຸດທີ່ຮູ້ໄລຍະຕົວຈິງ</li><li><b>ແຕ້ມຝາ (W)</b> — ເລືອກວັດສະດຸ ເຊັ່ນ ດິນຈີ່ເບົາ ຄອນກີດ ແກ້ວ</li><li><b>ວາງ AP (A)</b> — ລາກຍ້າຍໄດ້ Heatmap ອັບເດດທັນທີ</li><li><b>ສົ່ງອອກຮູບ</b> — ແນບໃບສະເໜີລາຄາໃຫ້ລູກຄ້າ</li>",
    tryDemo: "ລອງຕົວຢ່າງ: ຫໍພັກ 14 ຫ້ອງ", startOwn: "ເລີ່ມດ້ວຍແຜນຜັງຂອງຂ້ອຍ", startBlank: "ເລີ່ມຈາກພື້ນທີ່ຫວ່າງ",
    newTitle: "ເລີ່ມໂປຣເຈັກໃໝ່?", newBody: "ຝາ ແລະ AP ທັງໝົດໃນໂປຣເຈັກນີ້ຈະຖືກລຶບ (ກົດ ບັນທຶກ ກ່ອນຖ້າຕ້ອງການເກັບໄວ້)",
    planTitle: "ປ່ຽນແຜນຜັງ?", planBody: "ການນຳເຂົ້າແຜນຜັງໃໝ່ຈະລຶບຝາ ແລະ AP ທີ່ມີຢູ່ (ກົດ ບັນທຶກ ກ່ອນຖ້າຕ້ອງການເກັບໄວ້)",
    sampleLoaded: "ໂຫຼດຕົວຢ່າງຫໍພັກແລ້ວ — ລອງລາກ AP ຫຼື ສະຫຼັບ 2.4/5 GHz",
    mat_drywall: "ຍິບຊຳ", mat_glass: "ແກ້ວ", mat_wood: "ໄມ້ / ປະຕູ", mat_aac: "ດິນຈີ່ເບົາ",
    mat_brick: "ດິນຈີ່ໂບກປູນ", mat_concrete: "ຄອນກີດ", mat_metal: "ໂລຫະ / ລິຟ",
  },

  my: {
    new: "အသစ်", loadPlan: "အထပ်ပုံစံ တင်သွင်းရန်", open: "ပရောဂျက် ဖွင့်ရန်", save: "သိမ်းရန်", exportPng: "ပုံ ထုတ်ရန်",
    toolSelect: "ရွေးရန် / ရွှေ့ရန် (V)", toolPan: "မြင်ကွင်း ရွှေ့ရန် (H)", toolScale: "စကေး သတ်မှတ်ရန် (S)",
    toolWall: "နံရံ ဆွဲရန် (W)", toolAp: "Access Point ထားရန် (A)",
    undo: "နောက်ပြန် (Ctrl+Z)", redo: "ပြန်လုပ် (Ctrl+Y)", fit: "မျက်နှာပြင်နှင့် ကိုက်ညီစေရန်",
    properties: "ဂုဏ်သတ္တိများ", display: "ပြသမှု", legend: "အချက်ပြ အားကောင်းမှု", summary: "အနှစ်ချုပ်",
    band: "ကြိမ်နှုန်း", environment: "ပတ်ဝန်းကျင်", opacity: "Heatmap အလင်းပိတ်မှု", minSignal: "အနိမ့်ဆုံး အချက်ပြ",
    envOpen: "ကျယ်ဝန်းသော ခန်းမ", envOffice: "ရုံး", envHome: "အိမ် / အဆောင်", envDense: "ကျပ်ညပ် / ဂိုဒေါင်",
    nothingSelected: "ဘာမှ မရွေးရသေးပါ<br>• ပြင်ရန် AP သို့မဟုတ် နံရံကို နှိပ်ပါ<br>• AP ထားရန် <b>A</b>၊ နံရံဆွဲရန် <b>W</b> ကို နှိပ်ပါ",
    apName: "အမည်", tx24: "ထုတ်လွှင့်အား 2.4G", tx5: "ထုတ်လွှင့်အား 5G", gain: "အင်တာနာ ဂိန်း",
    material: "နံရံ ပစ္စည်း", length: "အရှည်", deleteItem: "ဖျက်ရန်",
    wallMaterialForNew: "နံရံအသစ်အတွက် ပစ္စည်း",
    scaleLen: "မျဉ်း၏ အမှန်တကယ် အရှည်", applyScale: "စကေး သတ်မှတ်ရန်", scaleHelp: "အကွာအဝေး အမှန်ကို သိသော အမှတ် ၂ ခုကို နှိပ်ပါ (ဥပမာ နံရံအရှည်၊ တံခါးအကျယ်)",
    apCount: "AP အရေအတွက်", wallCount: "နံရံ အရေအတွက်", area: "ဧရိယာ", covGood: "ကောင်း (≥ -67)", covOk: "သုံးနိုင် (≥ -75)", covNone: "အချက်ပြ မရသော နေရာ",

    hintPan: "ရွှေ့ရန် ဆွဲပါ • ချဲ့ရန် mouse wheel လှည့်ပါ",
    hintScale: "အရှည်သိသော အကွာအဝေး၏ အစနှင့် အဆုံးကို နှိပ်ပါ",
    hintWall: "နံရံ ဆက်တိုက်ဆွဲရန် နှိပ်ပါ • ပြီးရန် နှစ်ချက်နှိပ် / Esc / ညာဘက်နှိပ် • ထောင့်သော့ခတ်ရန် Shift ဖိထားပါ",
    hintAp: "Access Point ထားရန် အထပ်ပုံစံပေါ်တွင် နှိပ်ပါ",
    sGood: "အလွန်ကောင်း — ဗီဒီယိုခေါ်ဆိုမှု / VoIP", sGood2: "ကောင်း — ယေဘုယျ သုံးစွဲမှု", sOk: "အသင့်အတင့် — ဝက်ဘ် / ချတ်", sWeak: "အားနည်း — မတည်ငြိမ်", sBad: "အလွန်ညံ့",
    saved: "သိမ်းပြီးပါပြီ", loaded: "ပရောဂျက် ဖွင့်ပြီးပါပြီ", exported: "ပုံ ထုတ်ပြီးပါပြီ", planLoaded: "အထပ်ပုံစံ တင်သွင်းပြီးပါပြီ — နောက်တစ်ဆင့် စကေး သတ်မှတ်ပါ (S)",
    scaleSet: "စကေး သတ်မှတ်ပြီးပါပြီ", badFile: "ဖိုင် မမှန်ကန်ပါ", autosaveFull: "အထပ်ပုံစံ ကြီးလွန်း၍ အလိုအလျောက် မသိမ်းနိုင်ပါ — ဖိုင်အဖြစ် သိမ်းရန် သိမ်းရန် ကို နှိပ်ပါ",
    blankPlan: "နေရာလွတ် ၃၀×၂၀ မီတာ — အလုပ်အမှန်အတွက် အထပ်ပုံစံ တင်သွင်းပါ",
    exportTitle: "Wi-Fi လွှမ်းခြုံမှု မြေပုံ", noScale: "စကေး မသတ်မှတ်ရသေးပါ",
    help: "အကူအညီ", finishWall: "နံရံဆွဲခြင်း ပြီးပြီ", cancel: "မလုပ်တော့ပါ", confirm: "အတည်ပြု", language: "ဘာသာစကား",
    disclaimer: "ရလဒ်များသည် ပုံမှန် ပစ္စည်းတန်ဖိုးများအပေါ် အခြေခံသော ခန့်မှန်းချက်များ ဖြစ်သည်။ မတပ်ဆင်မီ နေရာတွင် တိုင်းတာ စစ်ဆေးပါ။",
    welcomeTitle: "Beamwise မှ ကြိုဆိုပါသည်",
    welcomeIntro: "အထပ်ပုံစံပေါ်တွင် Access Point နေရာချထားမှုကို စီစဉ်ပြီး Wi-Fi အချက်ပြ အားကောင်းမှုကို ချက်ချင်း ကြည့်ပါ။ အခမဲ့၊ ထည့်သွင်းရန် မလို၊ ဒေတာများသည် သင့်စက်ထဲတွင်သာ ရှိသည်။",
    welcomeSteps: "<li><b>အထပ်ပုံစံ တင်သွင်းပါ</b> — PNG/JPG/PDF ပုံ သို့မဟုတ် ဖုန်းဖြင့် ရိုက်ထားသော ပုံ</li><li><b>စကေး သတ်မှတ်ပါ (S)</b> — အကွာအဝေးသိသော အမှတ် ၂ ခု နှိပ်ပါ</li><li><b>နံရံ ဆွဲပါ (W)</b> — အုတ်ပေါ့၊ ကွန်ကရစ်၊ မှန် စသည့် ပစ္စည်း ရွေးပါ</li><li><b>AP ထားပါ (A)</b> — ဆွဲ၍ ရွှေ့နိုင်ပြီး Heatmap ချက်ချင်း ပြောင်းလဲသည်</li><li><b>ပုံ ထုတ်ပါ</b> — ဖောက်သည်အတွက် ဈေးနှုန်းစာတွင် ပူးတွဲပါ</li>",
    tryDemo: "နမူနာ စမ်းကြည့်ရန်: အခန်း ၁၄ ခန်း အဆောင်", startOwn: "ကျွန်ုပ်၏ အထပ်ပုံစံဖြင့် စတင်ရန်", startBlank: "နေရာလွတ်မှ စတင်ရန်",
    newTitle: "ပရောဂျက်အသစ် စမလား?", newBody: "ဤပရောဂျက်ရှိ နံရံနှင့် AP အားလုံး ဖျက်ပစ်ပါမည် (ထိန်းသိမ်းလိုပါက အရင် သိမ်းပါ)။",
    planTitle: "အထပ်ပုံစံ အစားထိုးမလား?", planBody: "အထပ်ပုံစံအသစ် တင်သွင်းပါက ရှိပြီးသား နံရံနှင့် AP များ ဖျက်ပစ်ပါမည် (ထိန်းသိမ်းလိုပါက အရင် သိမ်းပါ)။",
    sampleLoaded: "အဆောင် နမူနာ ဖွင့်ပြီးပါပြီ — AP ကို ဆွဲကြည့်ပါ သို့မဟုတ် 2.4/5 GHz ပြောင်းကြည့်ပါ",
    mat_drywall: "ဂျစ်ဆမ်ပြား", mat_glass: "မှန်", mat_wood: "သစ်သား / တံခါး", mat_aac: "အုတ်ပေါ့ (AAC)",
    mat_brick: "အုတ် (အင်္ဂတေကိုင်)", mat_concrete: "ကွန်ကရစ်", mat_metal: "သတ္တု / ဓာတ်လှေကား",
  },
};

// ---- AP models, waves, requirement, AI assistant ----
const I18N_EXTRA = {
  th: {
    apModel: "รุ่น AP", custom: "กำหนดเอง", gain24: "เกนเสา 2.4G", gain5: "เกนเสา 5G", ch24: "ช่องสัญญาณ 2.4G", ch5: "ช่องสัญญาณ 5G",
    modelNote: "ค่าทั่วไปจาก datasheet — ควรตรวจสอบ", capNbtc: "จำกัดกำลังส่งตาม กสทช.", waves: "แสดงคลื่นสัญญาณ",
    requirement: "สัญญาณขั้นต่ำที่ต้องการ", reqAuto: "อัตโนมัติตามประเภทอาคาร", req65: "หนาแน่นสูง / โรมมิ่ง", req67: "โทรเสียง / วิดีโอคอล",
    req70: "สตรีมมิ่ง HD", req72: "เว็บทั่วไป / IoT", req75: "ครอบคลุมพื้นฐาน", autoShort: "อัตโนมัติ", meetsReq: "ผ่านเกณฑ์", apModels: "รุ่น AP ที่ใช้",
    aiTitle: "ผู้ช่วย AI", aiTarget: "เป้าหมายพื้นที่", aiMaxAps: "AP สูงสุด", aiKeep: "เก็บ AP เดิมไว้", aiModelUsed: "รุ่น AP ที่จะวาง",
    aiAutoPlace: "วาง AP อัตโนมัติ", aiChannels: "จัดช่องสัญญาณอัตโนมัติ",
    aiPlaced: "วาง {n} AP · ผ่านเกณฑ์ {r} dBm {p}% ของพื้นที่", aiNeedWalls: "วาดผนังก่อน (หรือโหลดตัวอย่าง) เพื่อให้ AI รู้ขอบเขตอาคาร",
    aiNeedAps: "วาง AP ก่อน หรือกด วาง AP อัตโนมัติ", aiNoGain: "เพิ่มพื้นที่ครอบคลุมไม่ได้อีกแล้ว", aiChannelsDone: "จัดช่องสัญญาณแล้ว — ลดการรบกวนกันเอง", close: "ปิด",
  },
  en: {
    apModel: "AP model", custom: "Custom", gain24: "Antenna gain 2.4G", gain5: "Antenna gain 5G", ch24: "Channel 2.4G", ch5: "Channel 5G",
    modelNote: "Typical datasheet values — verify", capNbtc: "Limit power to Thai NBTC rules", waves: "Show signal waves",
    requirement: "Required signal", reqAuto: "Auto by building type", req65: "High density / roaming", req67: "Voice & video calls",
    req70: "HD streaming", req72: "Browsing / IoT", req75: "Basic coverage", autoShort: "auto", meetsReq: "Meets requirement", apModels: "AP models used",
    aiTitle: "AI assistant", aiTarget: "Target coverage", aiMaxAps: "Max APs", aiKeep: "Keep existing APs", aiModelUsed: "AP model to place",
    aiAutoPlace: "Auto-place APs", aiChannels: "Auto-assign channels",
    aiPlaced: "Placed {n} APs · {p}% of the area meets {r} dBm", aiNeedWalls: "Draw walls first (or load the sample) so the AI knows the building",
    aiNeedAps: "Place APs first, or use Auto-place", aiNoGain: "Coverage can't be improved any further", aiChannelsDone: "Channels assigned to reduce self-interference", close: "Close",
  },
  zh: {
    apModel: "AP 型号", custom: "自定义", gain24: "天线增益 2.4G", gain5: "天线增益 5G", ch24: "信道 2.4G", ch5: "信道 5G",
    modelNote: "数据手册典型值 — 请核实", capNbtc: "按泰国 NBTC 规定限制功率", waves: "显示信号波",
    requirement: "所需信号", reqAuto: "按建筑类型自动", req65: "高密度 / 漫游", req67: "语音及视频通话",
    req70: "高清流媒体", req72: "网页浏览 / 物联网", req75: "基本覆盖", autoShort: "自动", meetsReq: "达标", apModels: "使用的 AP 型号",
    aiTitle: "AI 助手", aiTarget: "目标覆盖率", aiMaxAps: "最多 AP 数", aiKeep: "保留现有 AP", aiModelUsed: "放置的 AP 型号",
    aiAutoPlace: "自动放置 AP", aiChannels: "自动分配信道",
    aiPlaced: "已放置 {n} 个 AP · {p}% 区域达到 {r} dBm", aiNeedWalls: "请先绘制墙体（或载入示例），让 AI 了解建筑范围",
    aiNeedAps: "请先放置 AP，或使用自动放置", aiNoGain: "覆盖已无法进一步改善", aiChannelsDone: "已分配信道，减少同频干扰", close: "关闭",
  },
  ja: {
    apModel: "AP の機種", custom: "カスタム", gain24: "アンテナ利得 2.4G", gain5: "アンテナ利得 5G", ch24: "チャネル 2.4G", ch5: "チャネル 5G",
    modelNote: "データシートの代表値 — 要確認", capNbtc: "タイ NBTC 規制で出力を制限", waves: "電波の波を表示",
    requirement: "必要な信号強度", reqAuto: "建物タイプから自動", req65: "高密度 / ローミング", req67: "音声・ビデオ通話",
    req70: "HD ストリーミング", req72: "Web 閲覧 / IoT", req75: "基本カバレッジ", autoShort: "自動", meetsReq: "基準を満たす", apModels: "使用 AP 機種",
    aiTitle: "AI アシスタント", aiTarget: "目標カバー率", aiMaxAps: "最大 AP 数", aiKeep: "既存の AP を残す", aiModelUsed: "配置する AP 機種",
    aiAutoPlace: "AP を自動配置", aiChannels: "チャネルを自動割当",
    aiPlaced: "AP を {n} 台配置 · 面積の {p}% が {r} dBm を満たします", aiNeedWalls: "AI が建物の範囲を把握できるよう、先に壁を描いてください（またはサンプルを読み込み）",
    aiNeedAps: "先に AP を配置するか、自動配置を使ってください", aiNoGain: "これ以上カバレッジを改善できません", aiChannelsDone: "チャネルを割り当て、自己干渉を低減しました", close: "閉じる",
  },
  ko: {
    apModel: "AP 모델", custom: "사용자 지정", gain24: "안테나 이득 2.4G", gain5: "안테나 이득 5G", ch24: "채널 2.4G", ch5: "채널 5G",
    modelNote: "데이터시트 일반 값 — 확인 필요", capNbtc: "태국 NBTC 규정으로 출력 제한", waves: "신호 파동 표시",
    requirement: "필요 신호", reqAuto: "건물 유형에 따라 자동", req65: "고밀도 / 로밍", req67: "음성·영상 통화",
    req70: "HD 스트리밍", req72: "웹 / IoT", req75: "기본 커버리지", autoShort: "자동", meetsReq: "기준 충족", apModels: "사용 AP 모델",
    aiTitle: "AI 도우미", aiTarget: "목표 커버리지", aiMaxAps: "최대 AP 수", aiKeep: "기존 AP 유지", aiModelUsed: "배치할 AP 모델",
    aiAutoPlace: "AP 자동 배치", aiChannels: "채널 자동 할당",
    aiPlaced: "AP {n}대 배치 · 면적의 {p}%가 {r} dBm 충족", aiNeedWalls: "AI가 건물 범위를 알 수 있도록 먼저 벽을 그리세요 (또는 예제 불러오기)",
    aiNeedAps: "먼저 AP를 배치하거나 자동 배치를 사용하세요", aiNoGain: "커버리지를 더 개선할 수 없습니다", aiChannelsDone: "채널을 할당해 자체 간섭을 줄였습니다", close: "닫기",
  },
  vi: {
    apModel: "Mẫu AP", custom: "Tùy chỉnh", gain24: "Độ lợi ăng-ten 2.4G", gain5: "Độ lợi ăng-ten 5G", ch24: "Kênh 2.4G", ch5: "Kênh 5G",
    modelNote: "Giá trị điển hình theo datasheet — cần kiểm tra", capNbtc: "Giới hạn công suất theo NBTC Thái Lan", waves: "Hiện sóng tín hiệu",
    requirement: "Tín hiệu yêu cầu", reqAuto: "Tự động theo loại công trình", req65: "Mật độ cao / roaming", req67: "Gọi thoại & video",
    req70: "Phát video HD", req72: "Lướt web / IoT", req75: "Phủ sóng cơ bản", autoShort: "tự động", meetsReq: "Đạt yêu cầu", apModels: "Mẫu AP sử dụng",
    aiTitle: "Trợ lý AI", aiTarget: "Mục tiêu phủ sóng", aiMaxAps: "Số AP tối đa", aiKeep: "Giữ AP hiện có", aiModelUsed: "Mẫu AP sẽ đặt",
    aiAutoPlace: "Tự động đặt AP", aiChannels: "Tự động gán kênh",
    aiPlaced: "Đã đặt {n} AP · {p}% diện tích đạt {r} dBm", aiNeedWalls: "Hãy vẽ tường trước (hoặc tải ví dụ) để AI biết phạm vi công trình",
    aiNeedAps: "Hãy đặt AP trước, hoặc dùng Tự động đặt", aiNoGain: "Không thể cải thiện vùng phủ thêm nữa", aiChannelsDone: "Đã gán kênh để giảm nhiễu lẫn nhau", close: "Đóng",
  },
  lo: {
    apModel: "ລຸ້ນ AP", custom: "ກຳນົດເອງ", gain24: "ເກນເສົາ 2.4G", gain5: "ເກນເສົາ 5G", ch24: "ຊ່ອງສັນຍານ 2.4G", ch5: "ຊ່ອງສັນຍານ 5G",
    modelNote: "ຄ່າທົ່ວໄປຈາກ datasheet — ຄວນກວດສອບ", capNbtc: "ຈຳກັດກຳລັງສົ່ງຕາມ NBTC ໄທ", waves: "ສະແດງຄື້ນສັນຍານ",
    requirement: "ສັນຍານຂັ້ນຕ່ຳທີ່ຕ້ອງການ", reqAuto: "ອັດຕະໂນມັດຕາມປະເພດອາຄານ", req65: "ໜາແໜ້ນສູງ / ໂຣມມິງ", req67: "ໂທສຽງ / ວິດີໂອຄອລ",
    req70: "ສະຕຣີມມິງ HD", req72: "ເວັບທົ່ວໄປ / IoT", req75: "ຄອບຄຸມພື້ນຖານ", autoShort: "ອັດຕະໂນມັດ", meetsReq: "ຜ່ານເກນ", apModels: "ລຸ້ນ AP ທີ່ໃຊ້",
    aiTitle: "ຜູ້ຊ່ວຍ AI", aiTarget: "ເປົ້າໝາຍພື້ນທີ່", aiMaxAps: "AP ສູງສຸດ", aiKeep: "ເກັບ AP ເດີມໄວ້", aiModelUsed: "ລຸ້ນ AP ທີ່ຈະວາງ",
    aiAutoPlace: "ວາງ AP ອັດຕະໂນມັດ", aiChannels: "ຈັດຊ່ອງສັນຍານອັດຕະໂນມັດ",
    aiPlaced: "ວາງ {n} AP · ຜ່ານເກນ {r} dBm {p}% ຂອງພື້ນທີ່", aiNeedWalls: "ແຕ້ມຝາກ່ອນ (ຫຼື ໂຫຼດຕົວຢ່າງ) ເພື່ອໃຫ້ AI ຮູ້ຂອບເຂດອາຄານ",
    aiNeedAps: "ວາງ AP ກ່ອນ ຫຼື ກົດ ວາງ AP ອັດຕະໂນມັດ", aiNoGain: "ບໍ່ສາມາດເພີ່ມພື້ນທີ່ຄອບຄຸມໄດ້ອີກ", aiChannelsDone: "ຈັດຊ່ອງສັນຍານແລ້ວ — ຫຼຸດການລົບກວນກັນເອງ", close: "ປິດ",
  },
  my: {
    apModel: "AP မော်ဒယ်", custom: "စိတ်ကြိုက်", gain24: "အင်တာနာ ဂိန်း 2.4G", gain5: "အင်တာနာ ဂိန်း 5G", ch24: "ချန်နယ် 2.4G", ch5: "ချန်နယ် 5G",
    modelNote: "datasheet ပုံမှန်တန်ဖိုး — စစ်ဆေးပါ", capNbtc: "ထိုင်း NBTC စည်းမျဉ်းအတိုင်း အား ကန့်သတ်ရန်", waves: "အချက်ပြ လှိုင်း ပြရန်",
    requirement: "လိုအပ်သော အချက်ပြ", reqAuto: "အဆောက်အအုံ အမျိုးအစားအလိုက် အလိုအလျောက်", req65: "လူများ / ရိုမင်း", req67: "အသံ နှင့် ဗီဒီယို ခေါ်ဆိုမှု",
    req70: "HD ဗီဒီယို", req72: "ဝက်ဘ် / IoT", req75: "အခြေခံ လွှမ်းခြုံမှု", autoShort: "အလိုအလျောက်", meetsReq: "စံ ပြည့်မီ", apModels: "သုံးထားသော AP မော်ဒယ်",
    aiTitle: "AI အကူ", aiTarget: "ပစ်မှတ် လွှမ်းခြုံမှု", aiMaxAps: "AP အများဆုံး", aiKeep: "ရှိပြီးသား AP ထားရန်", aiModelUsed: "ထားမည့် AP မော်ဒယ်",
    aiAutoPlace: "AP အလိုအလျောက် ထားရန်", aiChannels: "ချန်နယ် အလိုအလျောက် သတ်မှတ်ရန်",
    aiPlaced: "AP {n} လုံး ထားပြီး · ဧရိယာ၏ {p}% သည် {r} dBm ပြည့်မီသည်", aiNeedWalls: "AI က အဆောက်အအုံ နယ်နိမိတ် သိစေရန် နံရံ အရင်ဆွဲပါ (သို့မဟုတ် နမူနာ ဖွင့်ပါ)",
    aiNeedAps: "AP အရင် ထားပါ သို့မဟုတ် အလိုအလျောက် ထားရန် ကို သုံးပါ", aiNoGain: "လွှမ်းခြုံမှု ထပ်မံ မတိုးနိုင်တော့ပါ", aiChannelsDone: "ချန်နယ် သတ်မှတ်ပြီး — အချင်းချင်း နှောင့်ယှက်မှု လျှော့ချပြီး", close: "ပိတ်ရန်",
  },
};
for (const [code, extra] of Object.entries(I18N_EXTRA)) Object.assign(I18N[code], extra);
// ---- coverage boundary ----
const I18N_AREA = {
  th: {
    toolArea: "ขอบเขตสัญญาณ (B)",
    hintArea: "คลิกทีละจุดรอบพื้นที่ที่ต้องการ • คลิกจุดแรก / ดับเบิลคลิก / Enter เพื่อปิดรูป • Backspace ลบจุดล่าสุด • Esc ยกเลิก",
    finishArea: "ปิดขอบเขต",
    areaHelp: "ลากเส้นล้อมพื้นที่ที่ต้องการให้มีสัญญาณ Heatmap จะแสดงเฉพาะด้านใน และ % ผ่านเกณฑ์ / วาง AP อัตโนมัติ จะคิดเฉพาะพื้นที่นี้<br>วาดได้หลายขอบเขต",
    areaBoundary: "ขอบเขต",
    areaBoundaryShort: "ในขอบเขต",
    areaPoints: "จำนวนจุด",
    areaEditHelp: "ลากจุดสีขาวเพื่อปรับรูปร่าง • ลากเส้นขอบเพื่อย้ายทั้งรูป",
    areaClear: "ลบขอบเขตทั้งหมด",
    areaAdded: "สร้างขอบเขตแล้ว — สัญญาณจะคิดเฉพาะด้านใน",
  },
  en: {
    toolArea: "Coverage boundary (B)",
    hintArea: "Click points around the area • Click the first point / double-click / Enter to close • Backspace removes the last point • Esc cancels",
    finishArea: "Close boundary",
    areaHelp: "Outline the area that needs Wi-Fi. The heatmap shows only inside it, and coverage % and auto-placement count only this area.<br>You can draw several boundaries.",
    areaBoundary: "Boundary",
    areaBoundaryShort: "in boundary",
    areaPoints: "Points",
    areaEditHelp: "Drag the white points to reshape • Drag an edge to move it",
    areaClear: "Remove all boundaries",
    areaAdded: "Boundary created — coverage now counts only the inside",
  },
  zh: {
    toolArea: "覆盖边界 (B)",
    hintArea: "围绕区域逐点点击 • 点击第一个点 / 双击 / Enter 闭合 • Backspace 删除上一点 • Esc 取消",
    finishArea: "闭合边界",
    areaHelp: "圈出需要 Wi-Fi 的区域。热图只在边界内显示，覆盖率和自动放置只计算此区域。<br>可绘制多个边界。",
    areaBoundary: "边界",
    areaBoundaryShort: "边界内",
    areaPoints: "点数",
    areaEditHelp: "拖动白点调整形状 • 拖动边线移动整体",
    areaClear: "删除全部边界",
    areaAdded: "已创建边界 — 只计算边界内的信号",
  },
  ja: {
    toolArea: "カバー範囲 (B)",
    hintArea: "範囲の周りを順にクリック • 最初の点 / ダブルクリック / Enter で閉じる • Backspace で直前の点を削除 • Esc で取消",
    finishArea: "範囲を閉じる",
    areaHelp: "Wi-Fi が必要な範囲を囲みます。ヒートマップは内側のみ表示され、達成率と自動配置もこの範囲だけで計算します。<br>複数描けます。",
    areaBoundary: "範囲",
    areaBoundaryShort: "範囲内",
    areaPoints: "点の数",
    areaEditHelp: "白い点をドラッグで形を調整 • 辺をドラッグで移動",
    areaClear: "すべての範囲を削除",
    areaAdded: "範囲を作成しました — 内側のみ計算します",
  },
  ko: {
    toolArea: "커버리지 경계 (B)",
    hintArea: "영역 둘레를 차례로 클릭 • 첫 점 / 더블클릭 / Enter로 닫기 • Backspace로 마지막 점 삭제 • Esc 취소",
    finishArea: "경계 닫기",
    areaHelp: "Wi-Fi가 필요한 영역을 둘러 그립니다. 히트맵은 안쪽만 표시되고 충족률과 자동 배치도 이 영역만 계산합니다.<br>여러 개를 그릴 수 있습니다.",
    areaBoundary: "경계",
    areaBoundaryShort: "경계 내",
    areaPoints: "점 개수",
    areaEditHelp: "흰 점을 드래그해 모양 조정 • 테두리를 드래그해 이동",
    areaClear: "모든 경계 삭제",
    areaAdded: "경계를 만들었습니다 — 안쪽만 계산합니다",
  },
  vi: {
    toolArea: "Ranh giới phủ sóng (B)",
    hintArea: "Nhấp từng điểm quanh khu vực • Nhấp điểm đầu / nhấp đúp / Enter để đóng • Backspace xóa điểm cuối • Esc hủy",
    finishArea: "Đóng ranh giới",
    areaHelp: "Khoanh vùng cần Wi-Fi. Heatmap chỉ hiển thị bên trong, % đạt chuẩn và đặt AP tự động chỉ tính vùng này.<br>Có thể vẽ nhiều ranh giới.",
    areaBoundary: "Ranh giới",
    areaBoundaryShort: "trong ranh giới",
    areaPoints: "Số điểm",
    areaEditHelp: "Kéo điểm trắng để chỉnh hình • Kéo cạnh để di chuyển",
    areaClear: "Xóa tất cả ranh giới",
    areaAdded: "Đã tạo ranh giới — chỉ tính bên trong",
  },
  lo: {
    toolArea: "ຂອບເຂດສັນຍານ (B)",
    hintArea: "ຄລິກເທື່ອລະຈຸດອ້ອມພື້ນທີ່ • ຄລິກຈຸດທຳອິດ / ຄລິກສອງເທື່ອ / Enter ເພື່ອປິດ • Backspace ລຶບຈຸດລ່າສຸດ • Esc ຍົກເລີກ",
    finishArea: "ປິດຂອບເຂດ",
    areaHelp: "ລາກເສັ້ນອ້ອມພື້ນທີ່ທີ່ຕ້ອງການສັນຍານ Heatmap ຈະສະແດງສະເພາະດ້ານໃນ ແລະ % ຜ່ານເກນ / ວາງ AP ອັດຕະໂນມັດ ຄິດສະເພາະພື້ນທີ່ນີ້<br>ແຕ້ມໄດ້ຫຼາຍຂອບເຂດ",
    areaBoundary: "ຂອບເຂດ",
    areaBoundaryShort: "ໃນຂອບເຂດ",
    areaPoints: "ຈຳນວນຈຸດ",
    areaEditHelp: "ລາກຈຸດສີຂາວເພື່ອປັບຮູບ • ລາກເສັ້ນຂອບເພື່ອຍ້າຍ",
    areaClear: "ລຶບຂອບເຂດທັງໝົດ",
    areaAdded: "ສ້າງຂອບເຂດແລ້ວ — ຄິດສະເພາະດ້ານໃນ",
  },
  my: {
    toolArea: "လွှမ်းခြုံနယ်နိမိတ် (B)",
    hintArea: "နေရာပတ်လည် အမှတ်တစ်ခုချင်း နှိပ်ပါ • ပိတ်ရန် ပထမအမှတ် / နှစ်ချက်နှိပ် / Enter • နောက်ဆုံးအမှတ်ဖျက်ရန် Backspace • ပယ်ဖျက်ရန် Esc",
    finishArea: "နယ်နိမိတ် ပိတ်ရန်",
    areaHelp: "Wi-Fi လိုအပ်သော နေရာကို ဝိုင်းဆွဲပါ။ Heatmap ကို အတွင်းဘက်တွင်သာ ပြပြီး ရာခိုင်နှုန်းနှင့် AP အလိုအလျောက်ထားခြင်းကို ဤနေရာအတွက်သာ တွက်သည်။<br>အများအပြား ဆွဲနိုင်သည်။",
    areaBoundary: "နယ်နိမိတ်",
    areaBoundaryShort: "နယ်နိမိတ်အတွင်း",
    areaPoints: "အမှတ်အရေအတွက်",
    areaEditHelp: "ပုံသဏ္ဌာန်ပြင်ရန် အဖြူအမှတ်ကို ဆွဲပါ • ရွှေ့ရန် အနားကို ဆွဲပါ",
    areaClear: "နယ်နိမိတ်အားလုံး ဖျက်ရန်",
    areaAdded: "နယ်နိမိတ် ဖန်တီးပြီး — အတွင်းဘက်ကိုသာ တွက်သည်",
  },
};
for (const [code, extra] of Object.entries(I18N_AREA)) Object.assign(I18N[code], extra);
// ---- tool labels ----
const I18N_UI = {
  th: { tlSelect: "เลือก", tlPan: "เลื่อน", tlScale: "สเกล", tlWall: "ผนัง", tlArea: "ขอบเขต", tlAp: "วาง AP", tlUndo: "ย้อนกลับ", tlRedo: "ทำซ้ำ", tlFit: "พอดีจอ" },
  en: { tlSelect: "Select", tlPan: "Pan", tlScale: "Scale", tlWall: "Wall", tlArea: "Boundary", tlAp: "AP", tlUndo: "Undo", tlRedo: "Redo", tlFit: "Fit" },
  zh: { tlSelect: "选择", tlPan: "平移", tlScale: "比例", tlWall: "墙体", tlArea: "边界", tlAp: "AP", tlUndo: "撤销", tlRedo: "重做", tlFit: "适应" },
  ja: { tlSelect: "選択", tlPan: "移動", tlScale: "縮尺", tlWall: "壁", tlArea: "範囲", tlAp: "AP", tlUndo: "元に戻す", tlRedo: "やり直し", tlFit: "全体" },
  ko: { tlSelect: "선택", tlPan: "이동", tlScale: "축척", tlWall: "벽", tlArea: "경계", tlAp: "AP", tlUndo: "실행 취소", tlRedo: "다시 실행", tlFit: "맞춤" },
  vi: { tlSelect: "Chọn", tlPan: "Kéo", tlScale: "Tỷ lệ", tlWall: "Tường", tlArea: "Ranh giới", tlAp: "AP", tlUndo: "Hoàn tác", tlRedo: "Làm lại", tlFit: "Vừa khung" },
  lo: { tlSelect: "ເລືອກ", tlPan: "ເລື່ອນ", tlScale: "ມາດຕາ", tlWall: "ຝາ", tlArea: "ຂອບເຂດ", tlAp: "ວາງ AP", tlUndo: "ຍ້ອນກັບ", tlRedo: "ເຮັດຊ້ຳ", tlFit: "ພໍດີຈໍ" },
  my: { tlSelect: "ရွေး", tlPan: "ရွှေ့", tlScale: "စကေး", tlWall: "နံရံ", tlArea: "နယ်နိမိတ်", tlAp: "AP", tlUndo: "နောက်ပြန်", tlRedo: "ပြန်လုပ်", tlFit: "အံကိုက်" },
};
for (const [code, extra] of Object.entries(I18N_UI)) Object.assign(I18N[code], extra);
// ---- theme ----
const I18N_THEME = {
  th: { themeDark: "เปลี่ยนเป็นธีมมืด", themeLight: "เปลี่ยนเป็นธีมสว่าง" },
  en: { themeDark: "Switch to dark theme", themeLight: "Switch to light theme" },
  zh: { themeDark: "切换到深色主题", themeLight: "切换到浅色主题" },
  ja: { themeDark: "ダークテーマに切り替え", themeLight: "ライトテーマに切り替え" },
  ko: { themeDark: "어두운 테마로 전환", themeLight: "밝은 테마로 전환" },
  vi: { themeDark: "Chuyển sang giao diện tối", themeLight: "Chuyển sang giao diện sáng" },
  lo: { themeDark: "ປ່ຽນເປັນທີມມືດ", themeLight: "ປ່ຽນເປັນທີມສະຫວ່າງ" },
  my: { themeDark: "အမှောင် အပြင်အဆင်သို့ ပြောင်းရန်", themeLight: "အလင်း အပြင်အဆင်သို့ ပြောင်းရန်" },
};
for (const [code, extra] of Object.entries(I18N_THEME)) Object.assign(I18N[code], extra);
// ---- data export ----
Object.assign(I18N.th, { exportData: "ส่งออกข้อมูล (CSV)", dataExported: "ส่งออกไฟล์ข้อมูลการออกแบบแล้ว — เปิดด้วย Excel ได้" });
Object.assign(I18N.en, { exportData: "Export data (CSV)", dataExported: "Design data exported — open it in Excel" });
Object.assign(I18N.zh, { exportData: "导出数据 (CSV)", dataExported: "已导出设计数据 — 可用 Excel 打开" });
Object.assign(I18N.ja, { exportData: "データを書き出す (CSV)", dataExported: "設計データを書き出しました — Excel で開けます" });
Object.assign(I18N.ko, { exportData: "데이터 내보내기 (CSV)", dataExported: "설계 데이터를 내보냈습니다 — Excel에서 열 수 있습니다" });
Object.assign(I18N.vi, { exportData: "Xuất dữ liệu (CSV)", dataExported: "Đã xuất dữ liệu thiết kế — mở bằng Excel" });
Object.assign(I18N.lo, { exportData: "ສົ່ງອອກຂໍ້ມູນ (CSV)", dataExported: "ສົ່ງອອກຂໍ້ມູນການອອກແບບແລ້ວ — ເປີດດ້ວຍ Excel ໄດ້" });
Object.assign(I18N.my, { exportData: "ဒေတာ ထုတ်ရန် (CSV)", dataExported: "ဒီဇိုင်းဒေတာ ထုတ်ပြီး — Excel ဖြင့် ဖွင့်နိုင်သည်" });

// ---- multi-AP editing ----
Object.assign(I18N.th, { apsSelected: "เลือก Access Point {n} ตัว", mixedValues: "หลายค่า", multiHelp: "ค่าที่แก้จะใช้กับ AP ทุกตัวที่เลือก • ช่องที่ว่าง (หลายค่า) คือแต่ละตัวตั้งไม่เหมือนกัน แก้แล้วจะเป็นค่าเดียวกันทั้งหมด", multiTip: "เลือกหลายตัว: Shift+คลิก AP, Shift+ลากกรอบ หรือ Ctrl+A", applyToAll: "ใช้รุ่น / กำลังส่ง / เกนนี้กับ AP ทุกตัว", selectAllAps: "เลือก AP ทั้งหมด (Ctrl+A)", appliedAll: "ใช้ค่ากับ AP ทั้ง {n} ตัวแล้ว (ช่องสัญญาณไม่เปลี่ยน)" });
Object.assign(I18N.en, { apsSelected: "{n} access points selected", mixedValues: "Mixed", multiHelp: "Changes apply to every selected AP. A blank field (Mixed) means the APs differ; editing it sets them all to the same value.", multiTip: "Select several: Shift+click APs, Shift+drag a box, or Ctrl+A", applyToAll: "Apply this model / power / gain to all APs", selectAllAps: "Select all APs (Ctrl+A)", appliedAll: "Applied to all {n} APs (channels unchanged)" });
Object.assign(I18N.zh, { apsSelected: "已选择 {n} 个接入点", mixedValues: "多个值", multiHelp: "修改将应用于所有选中的 AP。空白字段（多个值）表示各 AP 设置不同，修改后将统一为同一值。", multiTip: "多选：Shift+点击 AP、Shift+拖框，或 Ctrl+A", applyToAll: "将此型号 / 功率 / 增益应用到所有 AP", selectAllAps: "选择全部 AP (Ctrl+A)", appliedAll: "已应用到全部 {n} 个 AP（信道不变）" });
Object.assign(I18N.ja, { apsSelected: "{n} 台のアクセスポイントを選択中", mixedValues: "複数の値", multiHelp: "変更は選択中のすべての AP に適用されます。空欄（複数の値）は AP ごとに異なることを示し、編集すると同じ値になります。", multiTip: "複数選択：Shift+クリック、Shift+ドラッグで範囲選択、または Ctrl+A", applyToAll: "この機種 / 出力 / 利得をすべての AP に適用", selectAllAps: "すべての AP を選択 (Ctrl+A)", appliedAll: "{n} 台すべてに適用しました（チャネルは変更なし）" });
Object.assign(I18N.ko, { apsSelected: "AP {n}개 선택됨", mixedValues: "여러 값", multiHelp: "변경 사항은 선택한 모든 AP에 적용됩니다. 빈 칸(여러 값)은 AP마다 값이 다르다는 뜻이며, 수정하면 모두 같은 값이 됩니다.", multiTip: "여러 개 선택: Shift+클릭, Shift+드래그로 영역 선택, 또는 Ctrl+A", applyToAll: "이 모델 / 출력 / 이득을 모든 AP에 적용", selectAllAps: "모든 AP 선택 (Ctrl+A)", appliedAll: "AP {n}개 모두에 적용했습니다 (채널은 그대로)" });
Object.assign(I18N.vi, { apsSelected: "Đã chọn {n} điểm truy cập", mixedValues: "Nhiều giá trị", multiHelp: "Thay đổi áp dụng cho mọi AP đã chọn. Ô trống (Nhiều giá trị) nghĩa là các AP khác nhau; sửa ô đó sẽ đặt tất cả cùng một giá trị.", multiTip: "Chọn nhiều: Shift+nhấp AP, Shift+kéo khung, hoặc Ctrl+A", applyToAll: "Áp dụng model / công suất / độ lợi này cho mọi AP", selectAllAps: "Chọn tất cả AP (Ctrl+A)", appliedAll: "Đã áp dụng cho cả {n} AP (kênh không đổi)" });
Object.assign(I18N.lo, { apsSelected: "ເລືອກ Access Point {n} ໜ່ວຍ", mixedValues: "ຫຼາຍຄ່າ", multiHelp: "ຄ່າທີ່ແກ້ຈະໃຊ້ກັບ AP ທຸກໜ່ວຍທີ່ເລືອກ • ຊ່ອງທີ່ຫວ່າງ (ຫຼາຍຄ່າ) ຄືແຕ່ລະໜ່ວຍຕັ້ງບໍ່ຄືກັນ ແກ້ແລ້ວຈະເປັນຄ່າດຽວກັນ", multiTip: "ເລືອກຫຼາຍໜ່ວຍ: Shift+ຄລິກ AP, Shift+ລາກກອບ ຫຼື Ctrl+A", applyToAll: "ໃຊ້ລຸ້ນ / ກຳລັງສົ່ງ / ເກນນີ້ກັບ AP ທຸກໜ່ວຍ", selectAllAps: "ເລືອກ AP ທັງໝົດ (Ctrl+A)", appliedAll: "ໃຊ້ຄ່າກັບ AP ທັງ {n} ໜ່ວຍແລ້ວ (ຊ່ອງສັນຍານບໍ່ປ່ຽນ)" });
Object.assign(I18N.my, { apsSelected: "Access Point {n} ခု ရွေးထားသည်", mixedValues: "တန်ဖိုး အမျိုးမျိုး", multiHelp: "ပြင်ဆင်ချက်များကို ရွေးထားသော AP အားလုံးတွင် သက်ရောက်သည်။ ကွက်လပ် (တန်ဖိုး အမျိုးမျိုး) သည် AP တစ်ခုချင်း မတူကြောင်း ပြသည်၊ ပြင်လျှင် အားလုံး တူညီသွားမည်။", multiTip: "အများအပြား ရွေးရန်: Shift+နှိပ်၊ Shift+ဘောင်ဆွဲ သို့မဟုတ် Ctrl+A", applyToAll: "ဤမော်ဒယ် / ပါဝါ / gain ကို AP အားလုံးတွင် သုံးရန်", selectAllAps: "AP အားလုံး ရွေးရန် (Ctrl+A)", appliedAll: "AP {n} ခုလုံးတွင် သုံးပြီး (channel မပြောင်းပါ)" });

// ---- site survey / calibration ----
Object.assign(I18N.th, {
  toolSurvey: "จุดวัดสัญญาณ (M)",
  tlSurvey: "จุดวัด",
  hintSurvey: "คลิกตำแหน่งที่วัดสัญญาณจริง แล้วกรอกค่า dBm ที่วัดได้ • คลิกจุดเดิมเพื่อแก้ไข",
  surveyHelp: "คลิกบนแบบแปลนตรงจุดที่ไปวัดสัญญาณมา แล้วกรอกค่า RSSI (dBm) ที่วัดได้<br>• วัดด้วยแอปมือถือ เช่น WiFiman หรือ NetSpot<br>• ยืนวัดหลายจุดกระจายทั่วพื้นที่ (แนะนำ 5 จุดขึ้นไป) ทั้งจุดใกล้และไกล AP<br>• ตั้งย่านความถี่ให้ตรงกับที่วัด",
  surveyHowTo: "กรอกค่าสัญญาณที่แรงที่สุดที่วัดได้ ณ จุดนี้ (ค่าเป็นลบ เช่น -62)",
  surveyPoint: "จุดวัด",
  measured: "ค่าที่วัดได้",
  predicted: "ค่าที่คาดการณ์",
  errorLbl: "คลาดเคลื่อน (คาด − วัด)",
  noValue: "ยังไม่กรอกค่า",
  calibTitle: "สอบเทียบกับค่าที่วัดจริง",
  calibPoints: "จุด",
  calibBias: "เฉลี่ย",
  calibMax: "สูงสุด",
  calibAll: "รวม",
  calibNote: "ค่าเป็น dB • บวก = โมเดลคาดว่าแรงกว่าความจริง • RMS ต่ำกว่า 4–6 dB ถือว่าใช้ได้ดี",
  calibNeed: "ยังไม่มีจุดวัดที่กรอกค่า — ใช้เครื่องมือ จุดวัด (M) วางจุดแล้วกรอกค่าที่วัดได้",
  calibActive: "ใช้โมเดลที่ปรับจากค่าที่วัดแล้ว",
  calibEnvWas: "เดิม",
  calibOffset: "ค่าชดเชย",
  calibFit: "ปรับโมเดลจากค่าที่วัด",
  calibReset: "ยกเลิกการปรับโมเดล",
  calibDone: "ปรับโมเดลแล้ว — RMS {a} → {b} dB",
  calibWarnOffset: "ค่าชดเชยสูงผิดปกติ — ตรวจสเกล ตำแหน่ง AP รุ่น/กำลังส่ง และย่านความถี่ของจุดวัดอีกครั้ง",
});
Object.assign(I18N.en, {
  toolSurvey: "Survey point (M)",
  tlSurvey: "Survey",
  hintSurvey: "Click where you measured the signal, then enter the dBm value • Click a point to edit it",
  surveyHelp: "Click on the plan where you measured the signal on site, then enter the RSSI (dBm) you measured.<br>• Measure with a phone app such as WiFiman or NetSpot<br>• Use several points spread over the area (5+ recommended), near and far from APs<br>• Set the band to match the measurement",
  surveyHowTo: "Enter the strongest signal measured at this point (negative, e.g. -62)",
  surveyPoint: "Survey point",
  measured: "Measured",
  predicted: "Predicted",
  errorLbl: "Error (predicted − measured)",
  noValue: "No value yet",
  calibTitle: "Calibration with measurements",
  calibPoints: "Points",
  calibBias: "Mean",
  calibMax: "Max",
  calibAll: "All",
  calibNote: "Values in dB • Positive = the model predicts a stronger signal than measured • RMS under 4–6 dB is a good match",
  calibNeed: "No measured points yet — use the Survey point tool (M) to place points and enter measured values",
  calibActive: "Using the model fitted to your measurements",
  calibEnvWas: "was",
  calibOffset: "Offset",
  calibFit: "Fit model to measurements",
  calibReset: "Remove calibration",
  calibDone: "Model fitted — RMS {a} → {b} dB",
  calibWarnOffset: "Unusually large offset — check the scale, AP positions, model/power and the band of each survey point",
});
Object.assign(I18N.zh, {
  toolSurvey: "测量点 (M)",
  tlSurvey: "测量点",
  hintSurvey: "点击实际测量信号的位置，然后输入测得的 dBm 值 • 点击已有点可编辑",
  surveyHelp: "在平面图上点击现场测量信号的位置，然后输入测得的 RSSI (dBm)。<br>• 使用手机应用测量，如 WiFiman 或 NetSpot<br>• 在区域内分散测量多个点（建议 5 个以上），包括靠近和远离 AP 的位置<br>• 将频段设置为与测量一致",
  surveyHowTo: "输入此处测得的最强信号（负值，如 -62）",
  surveyPoint: "测量点",
  measured: "实测值",
  predicted: "预测值",
  errorLbl: "误差（预测 − 实测）",
  noValue: "尚未输入",
  calibTitle: "与实测值校准",
  calibPoints: "点数",
  calibBias: "平均",
  calibMax: "最大",
  calibAll: "全部",
  calibNote: "单位 dB • 正值 = 模型预测比实测强 • RMS 低于 4–6 dB 表示吻合良好",
  calibNeed: "尚无已输入数值的测量点 — 使用测量点工具 (M) 放置点并输入实测值",
  calibActive: "正在使用按实测值校准的模型",
  calibEnvWas: "原为",
  calibOffset: "偏移",
  calibFit: "按实测值校准模型",
  calibReset: "取消校准",
  calibDone: "模型已校准 — RMS {a} → {b} dB",
  calibWarnOffset: "偏移异常偏大 — 请检查比例、AP 位置、型号/功率以及测量点的频段",
});
Object.assign(I18N.ja, {
  toolSurvey: "測定ポイント (M)",
  tlSurvey: "測定",
  hintSurvey: "実測した位置をクリックし、測定した dBm 値を入力 • 既存の点をクリックで編集",
  surveyHelp: "現地で信号を測定した位置を図面上でクリックし、測定した RSSI (dBm) を入力します。<br>• WiFiman や NetSpot などのスマホアプリで測定<br>• エリア全体に分散して複数点（5 点以上推奨）、AP の近くと遠くの両方で測定<br>• 帯域を測定時と合わせる",
  surveyHowTo: "この地点で測定した最も強い信号を入力（負の値、例 -62）",
  surveyPoint: "測定ポイント",
  measured: "実測値",
  predicted: "予測値",
  errorLbl: "誤差（予測 − 実測）",
  noValue: "未入力",
  calibTitle: "実測値によるキャリブレーション",
  calibPoints: "点数",
  calibBias: "平均",
  calibMax: "最大",
  calibAll: "全体",
  calibNote: "単位 dB • 正の値 = モデルが実測より強く予測 • RMS 4–6 dB 未満なら良好",
  calibNeed: "値が入力された測定ポイントがありません — 測定ポイントツール (M) で点を置き、実測値を入力してください",
  calibActive: "実測値に合わせたモデルを使用中",
  calibEnvWas: "元",
  calibOffset: "オフセット",
  calibFit: "実測値にモデルを合わせる",
  calibReset: "キャリブレーションを解除",
  calibDone: "モデルを調整しました — RMS {a} → {b} dB",
  calibWarnOffset: "オフセットが異常に大きいです — 縮尺、AP の位置、機種/出力、測定点の帯域を確認してください",
});
Object.assign(I18N.ko, {
  toolSurvey: "측정 지점 (M)",
  tlSurvey: "측정",
  hintSurvey: "실제로 측정한 위치를 클릭하고 측정한 dBm 값을 입력 • 기존 지점을 클릭해 편집",
  surveyHelp: "현장에서 신호를 측정한 위치를 평면도에서 클릭하고 측정한 RSSI(dBm)를 입력하세요.<br>• WiFiman, NetSpot 같은 휴대폰 앱으로 측정<br>• 영역 전체에 고르게 여러 지점(5개 이상 권장), AP 근처와 먼 곳 모두 측정<br>• 대역을 측정한 대역과 맞추기",
  surveyHowTo: "이 지점에서 측정한 가장 강한 신호를 입력 (음수, 예: -62)",
  surveyPoint: "측정 지점",
  measured: "측정값",
  predicted: "예측값",
  errorLbl: "오차 (예측 − 측정)",
  noValue: "아직 입력 안 됨",
  calibTitle: "측정값으로 보정",
  calibPoints: "지점",
  calibBias: "평균",
  calibMax: "최대",
  calibAll: "전체",
  calibNote: "단위 dB • 양수 = 모델이 실제보다 강하게 예측 • RMS 4–6 dB 미만이면 잘 맞음",
  calibNeed: "값이 입력된 측정 지점이 없습니다 — 측정 지점 도구(M)로 지점을 놓고 측정값을 입력하세요",
  calibActive: "측정값으로 보정한 모델 사용 중",
  calibEnvWas: "기존",
  calibOffset: "오프셋",
  calibFit: "측정값에 모델 맞추기",
  calibReset: "보정 해제",
  calibDone: "모델을 보정했습니다 — RMS {a} → {b} dB",
  calibWarnOffset: "오프셋이 비정상적으로 큽니다 — 축척, AP 위치, 모델/출력, 측정 지점의 대역을 확인하세요",
});
Object.assign(I18N.vi, {
  toolSurvey: "Điểm đo (M)",
  tlSurvey: "Điểm đo",
  hintSurvey: "Nhấp vào vị trí đã đo tín hiệu, rồi nhập giá trị dBm • Nhấp vào điểm có sẵn để sửa",
  surveyHelp: "Nhấp lên bản vẽ tại vị trí đã đo tín hiệu thực tế, rồi nhập RSSI (dBm) đo được.<br>• Đo bằng ứng dụng điện thoại như WiFiman hoặc NetSpot<br>• Đo nhiều điểm rải đều khu vực (khuyến nghị từ 5 điểm), cả gần và xa AP<br>• Chọn băng tần đúng với lúc đo",
  surveyHowTo: "Nhập tín hiệu mạnh nhất đo được tại điểm này (số âm, ví dụ -62)",
  surveyPoint: "Điểm đo",
  measured: "Đo được",
  predicted: "Dự đoán",
  errorLbl: "Sai số (dự đoán − đo)",
  noValue: "Chưa nhập",
  calibTitle: "Hiệu chỉnh theo số đo thực tế",
  calibPoints: "Điểm",
  calibBias: "Trung bình",
  calibMax: "Lớn nhất",
  calibAll: "Tất cả",
  calibNote: "Đơn vị dB • Dương = mô hình dự đoán mạnh hơn thực tế • RMS dưới 4–6 dB là khớp tốt",
  calibNeed: "Chưa có điểm đo nào có giá trị — dùng công cụ Điểm đo (M) để đặt điểm và nhập số đo",
  calibActive: "Đang dùng mô hình đã hiệu chỉnh theo số đo",
  calibEnvWas: "trước đây",
  calibOffset: "Bù",
  calibFit: "Hiệu chỉnh mô hình theo số đo",
  calibReset: "Bỏ hiệu chỉnh",
  calibDone: "Đã hiệu chỉnh — RMS {a} → {b} dB",
  calibWarnOffset: "Giá trị bù lớn bất thường — kiểm tra tỷ lệ, vị trí AP, model/công suất và băng tần của các điểm đo",
});
Object.assign(I18N.lo, {
  toolSurvey: "ຈຸດວັດສັນຍານ (M)",
  tlSurvey: "ຈຸດວັດ",
  hintSurvey: "ຄລິກຕຳແໜ່ງທີ່ວັດສັນຍານຕົວຈິງ ແລ້ວປ້ອນຄ່າ dBm ທີ່ວັດໄດ້ • ຄລິກຈຸດເດີມເພື່ອແກ້ໄຂ",
  surveyHelp: "ຄລິກເທິງແຜນຜັງຕົງຈຸດທີ່ໄປວັດສັນຍານມາ ແລ້ວປ້ອນຄ່າ RSSI (dBm) ທີ່ວັດໄດ້<br>• ວັດດ້ວຍແອັບມືຖື ເຊັ່ນ WiFiman ຫຼື NetSpot<br>• ວັດຫຼາຍຈຸດກະຈາຍທົ່ວພື້ນທີ່ (ແນະນຳ 5 ຈຸດຂຶ້ນໄປ) ທັງໃກ້ ແລະ ໄກ AP<br>• ຕັ້ງຄື້ນຄວາມຖີ່ໃຫ້ກົງກັບທີ່ວັດ",
  surveyHowTo: "ປ້ອນຄ່າສັນຍານທີ່ແຮງທີ່ສຸດທີ່ວັດໄດ້ຢູ່ຈຸດນີ້ (ຄ່າລົບ ເຊັ່ນ -62)",
  surveyPoint: "ຈຸດວັດ",
  measured: "ຄ່າທີ່ວັດໄດ້",
  predicted: "ຄ່າທີ່ຄາດການ",
  errorLbl: "ຄາດເຄື່ອນ (ຄາດ − ວັດ)",
  noValue: "ຍັງບໍ່ປ້ອນຄ່າ",
  calibTitle: "ສອບທຽບກັບຄ່າທີ່ວັດຕົວຈິງ",
  calibPoints: "ຈຸດ",
  calibBias: "ສະເລ່ຍ",
  calibMax: "ສູງສຸດ",
  calibAll: "ລວມ",
  calibNote: "ຄ່າເປັນ dB • ບວກ = ໂມເດວຄາດວ່າແຮງກວ່າຕົວຈິງ • RMS ຕ່ຳກວ່າ 4–6 dB ຖືວ່າດີ",
  calibNeed: "ຍັງບໍ່ມີຈຸດວັດທີ່ປ້ອນຄ່າ — ໃຊ້ເຄື່ອງມື ຈຸດວັດ (M) ວາງຈຸດແລ້ວປ້ອນຄ່າທີ່ວັດໄດ້",
  calibActive: "ໃຊ້ໂມເດວທີ່ປັບຈາກຄ່າທີ່ວັດແລ້ວ",
  calibEnvWas: "ເດີມ",
  calibOffset: "ຄ່າຊົດເຊີຍ",
  calibFit: "ປັບໂມເດວຈາກຄ່າທີ່ວັດ",
  calibReset: "ຍົກເລີກການປັບໂມເດວ",
  calibDone: "ປັບໂມເດວແລ້ວ — RMS {a} → {b} dB",
  calibWarnOffset: "ຄ່າຊົດເຊີຍສູງຜິດປົກກະຕິ — ກວດສອບມາດຕາສ່ວນ ຕຳແໜ່ງ AP ລຸ້ນ/ກຳລັງສົ່ງ ແລະ ຄື້ນຄວາມຖີ່ຂອງຈຸດວັດ",
});
Object.assign(I18N.my, {
  toolSurvey: "တိုင်းတာမှတ် (M)",
  tlSurvey: "တိုင်းမှတ်",
  hintSurvey: "အချက်ပြ တိုင်းခဲ့သည့်နေရာကို နှိပ်ပြီး တိုင်းရသော dBm ကို ထည့်ပါ • ပြင်ရန် ရှိပြီးသားမှတ်ကို နှိပ်ပါ",
  surveyHelp: "နေရာတွင် အချက်ပြ တိုင်းခဲ့သည့် အမှတ်ကို အထပ်ပုံစံပေါ်တွင် နှိပ်ပြီး တိုင်းရသော RSSI (dBm) ကို ထည့်ပါ။<br>• WiFiman သို့မဟုတ် NetSpot ကဲ့သို့ ဖုန်းအက်ပ်ဖြင့် တိုင်းပါ<br>• နေရာတစ်ခွင် အမှတ်များစွာ (၅ ခုနှင့်အထက် အကြံပြု) AP အနီးနှင့် အဝေး နှစ်မျိုးလုံး တိုင်းပါ<br>• ကြိမ်နှုန်းကို တိုင်းခဲ့သည့်အတိုင်း သတ်မှတ်ပါ",
  surveyHowTo: "ဤနေရာတွင် တိုင်းရသော အပြင်းဆုံး အချက်ပြကို ထည့်ပါ (အနုတ်တန်ဖိုး ဥပမာ -62)",
  surveyPoint: "တိုင်းတာမှတ်",
  measured: "တိုင်းရသည့်တန်ဖိုး",
  predicted: "ခန့်မှန်းတန်ဖိုး",
  errorLbl: "အမှား (ခန့်မှန်း − တိုင်း)",
  noValue: "မထည့်ရသေးပါ",
  calibTitle: "တိုင်းတာချက်ဖြင့် ချိန်ညှိခြင်း",
  calibPoints: "မှတ်",
  calibBias: "ပျမ်းမျှ",
  calibMax: "အများဆုံး",
  calibAll: "စုစုပေါင်း",
  calibNote: "တန်ဖိုး dB • အပေါင်း = မော်ဒယ်က တကယ်ထက် ပိုပြင်းသည်ဟု ခန့်မှန်း • RMS 4–6 dB အောက်ဆိုလျှင် ကောင်းသည်",
  calibNeed: "တန်ဖိုးထည့်ထားသော တိုင်းတာမှတ် မရှိသေးပါ — တိုင်းတာမှတ် ကိရိယာ (M) ဖြင့် မှတ်ချပြီး တန်ဖိုးထည့်ပါ",
  calibActive: "တိုင်းတာချက်ဖြင့် ချိန်ညှိထားသော မော်ဒယ်ကို သုံးနေသည်",
  calibEnvWas: "ယခင်",
  calibOffset: "ချိန်ညှိတန်ဖိုး",
  calibFit: "တိုင်းတာချက်ဖြင့် မော်ဒယ် ချိန်ညှိရန်",
  calibReset: "ချိန်ညှိမှု ဖယ်ရှားရန်",
  calibDone: "မော်ဒယ် ချိန်ညှိပြီး — RMS {a} → {b} dB",
  calibWarnOffset: "ချိန်ညှိတန်ဖိုး ပုံမှန်ထက် များနေသည် — စကေး၊ AP နေရာ၊ မော်ဒယ်/ပါဝါ နှင့် တိုင်းတာမှတ်များ၏ ကြိမ်နှုန်းကို ပြန်စစ်ပါ",
});

// ---- AP model search / user models ----
Object.assign(I18N.th, { myModels: "รุ่นที่เพิ่มเอง", searchModels: "ค้นหารุ่น / ยี่ห้อ ({n} รุ่น)", manageModels: "+ เพิ่มรุ่นเอง", customModelsHelp: "ไม่พบรุ่นที่ใช้ในรายการ? เพิ่มเองได้โดยกรอกค่าจาก datasheet รุ่นที่เพิ่มจะเก็บในเบราว์เซอร์นี้ และแนบไปกับไฟล์โปรเจกต์ที่บันทึก", brandLbl: "ยี่ห้อ", deleteShort: "ลบ", noCustomModels: "ยังไม่มีรุ่นที่เพิ่มเอง", addModel: "เพิ่มรุ่น", modelNamePh: "เช่น EAP625 HD", customModelsNote: "กำลังส่ง = ค่าสูงสุดแบบ conducted ต่อ chain ใน datasheet • ถ้ารุ่นไม่มีย่านไหน ให้ใส่กำลังส่งย่านนั้นเป็น 0", modelAdded: "เพิ่มรุ่น {m} แล้ว" });
Object.assign(I18N.en, { myModels: "My models", searchModels: "Search model / brand ({n} models)", manageModels: "+ Add your own model", customModelsHelp: "Model not in the list? Add it with values from its datasheet. Your models are kept in this browser and saved inside project files.", brandLbl: "Brand", deleteShort: "Delete", noCustomModels: "No models added yet", addModel: "Add model", modelNamePh: "e.g. EAP625 HD", customModelsNote: "Tx power = maximum conducted power per chain from the datasheet • If the model has no radio on a band, set that band's Tx power to 0", modelAdded: "Added {m}" });
Object.assign(I18N.zh, { myModels: "我的型号", searchModels: "搜索型号 / 品牌（{n} 个型号）", manageModels: "+ 添加自定义型号", customModelsHelp: "列表中没有？可根据规格书数值自行添加。自定义型号保存在本浏览器，并随项目文件一起保存。", brandLbl: "品牌", deleteShort: "删除", noCustomModels: "尚未添加型号", addModel: "添加型号", modelNamePh: "例如 EAP625 HD", customModelsNote: "发射功率 = 规格书中每链最大传导功率 • 若无某频段，请将该频段功率设为 0", modelAdded: "已添加 {m}" });
Object.assign(I18N.ja, { myModels: "追加した機種", searchModels: "機種 / メーカーを検索（{n} 機種）", manageModels: "+ 機種を追加", customModelsHelp: "一覧にない機種は、データシートの値で追加できます。追加した機種はこのブラウザに保存され、プロジェクトファイルにも含まれます。", brandLbl: "メーカー", deleteShort: "削除", noCustomModels: "追加した機種はまだありません", addModel: "機種を追加", modelNamePh: "例: EAP625 HD", customModelsNote: "送信出力 = データシートのチェーンあたり最大出力（伝導） • 対応しない帯域は出力を 0 に", modelAdded: "{m} を追加しました" });
Object.assign(I18N.ko, { myModels: "내 모델", searchModels: "모델 / 브랜드 검색 ({n}개 모델)", manageModels: "+ 모델 직접 추가", customModelsHelp: "목록에 없나요? 데이터시트 값으로 직접 추가하세요. 추가한 모델은 이 브라우저에 저장되고 프로젝트 파일에도 함께 저장됩니다.", brandLbl: "브랜드", deleteShort: "삭제", noCustomModels: "추가한 모델이 없습니다", addModel: "모델 추가", modelNamePh: "예: EAP625 HD", customModelsNote: "송신 출력 = 데이터시트의 체인당 최대 전도 출력 • 지원하지 않는 대역은 출력을 0으로", modelAdded: "{m} 추가됨" });
Object.assign(I18N.vi, { myModels: "Model của tôi", searchModels: "Tìm model / hãng ({n} model)", manageModels: "+ Thêm model riêng", customModelsHelp: "Không có trong danh sách? Hãy thêm với thông số từ datasheet. Model của bạn được lưu trong trình duyệt này và trong file dự án.", brandLbl: "Hãng", deleteShort: "Xóa", noCustomModels: "Chưa thêm model nào", addModel: "Thêm model", modelNamePh: "ví dụ EAP625 HD", customModelsNote: "Công suất phát = công suất dẫn tối đa mỗi chain theo datasheet • Nếu không có băng tần nào, đặt công suất băng đó là 0", modelAdded: "Đã thêm {m}" });
Object.assign(I18N.lo, { myModels: "ລຸ້ນທີ່ເພີ່ມເອງ", searchModels: "ຄົ້ນຫາລຸ້ນ / ຍີ່ຫໍ້ ({n} ລຸ້ນ)", manageModels: "+ ເພີ່ມລຸ້ນເອງ", customModelsHelp: "ບໍ່ພົບລຸ້ນໃນລາຍການ? ເພີ່ມເອງໄດ້ໂດຍປ້ອນຄ່າຈາກ datasheet ລຸ້ນທີ່ເພີ່ມຈະເກັບໃນບຣາວເຊີນີ້ ແລະ ແນບໄປກັບໄຟລ໌ໂປຣເຈັກ", brandLbl: "ຍີ່ຫໍ້", deleteShort: "ລຶບ", noCustomModels: "ຍັງບໍ່ມີລຸ້ນທີ່ເພີ່ມເອງ", addModel: "ເພີ່ມລຸ້ນ", modelNamePh: "ເຊັ່ນ EAP625 HD", customModelsNote: "ກຳລັງສົ່ງ = ຄ່າສູງສຸດແບບ conducted ຕໍ່ chain ໃນ datasheet • ຖ້າລຸ້ນບໍ່ມີຄື້ນໃດ ໃຫ້ປ້ອນກຳລັງສົ່ງຄື້ນນັ້ນເປັນ 0", modelAdded: "ເພີ່ມລຸ້ນ {m} ແລ້ວ" });
Object.assign(I18N.my, { myModels: "ကိုယ်ပိုင် မော်ဒယ်များ", searchModels: "မော်ဒယ် / အမှတ်တံဆိပ် ရှာရန် (မော်ဒယ် {n} ခု)", manageModels: "+ မော်ဒယ် ကိုယ်တိုင်ထည့်ရန်", customModelsHelp: "စာရင်းတွင် မရှိပါက datasheet တန်ဖိုးများဖြင့် ကိုယ်တိုင် ထည့်နိုင်သည်။ ထည့်ထားသော မော်ဒယ်များကို ဤ browser နှင့် project ဖိုင်တွင် သိမ်းသည်။", brandLbl: "အမှတ်တံဆိပ်", deleteShort: "ဖျက်ရန်", noCustomModels: "ကိုယ်တိုင်ထည့်ထားသော မော်ဒယ် မရှိသေးပါ", addModel: "မော်ဒယ် ထည့်ရန်", modelNamePh: "ဥပမာ EAP625 HD", customModelsNote: "ထုတ်လွှင့်ပါဝါ = datasheet ပါ chain တစ်ခုချင်း အများဆုံး conducted ပါဝါ • မရှိသော ကြိမ်နှုန်းအတွက် ပါဝါကို 0 ထည့်ပါ", modelAdded: "{m} ထည့်ပြီး" });

// ---- PDF floor plans ----
Object.assign(I18N.th, { pdfLoading: "กำลังเปิด PDF…", pdfPageTitle: "เลือกหน้าแบบแปลน", pdfPageBody: "ไฟล์ PDF นี้มี {n} หน้า — เลือกหน้าที่เป็นแบบแปลนชั้นที่จะออกแบบ", pdfPageLbl: "หน้าที่", pdfUsePage: "ใช้หน้านี้", pdfError: "เปิด PDF ไม่ได้ — ลองบันทึกเป็นรูป PNG/JPG แทน", pdfPassword: "PDF นี้มีรหัสผ่าน — ปลดรหัสก่อนแล้วลองใหม่" });
Object.assign(I18N.en, { pdfLoading: "Opening PDF…", pdfPageTitle: "Choose a page", pdfPageBody: "This PDF has {n} pages. Choose the floor plan page to design on.", pdfPageLbl: "Page", pdfUsePage: "Use this page", pdfError: "Couldn't open the PDF. Try saving it as a PNG/JPG image instead.", pdfPassword: "This PDF is password-protected. Remove the password and try again." });
Object.assign(I18N.zh, { pdfLoading: "正在打开 PDF…", pdfPageTitle: "选择页面", pdfPageBody: "此 PDF 共 {n} 页，请选择要设计的平面图页面。", pdfPageLbl: "页码", pdfUsePage: "使用此页", pdfError: "无法打开 PDF，请另存为 PNG/JPG 图片再试。", pdfPassword: "此 PDF 受密码保护，请先移除密码。" });
Object.assign(I18N.ja, { pdfLoading: "PDF を開いています…", pdfPageTitle: "ページを選択", pdfPageBody: "この PDF は {n} ページあります。設計に使う図面のページを選んでください。", pdfPageLbl: "ページ", pdfUsePage: "このページを使う", pdfError: "PDF を開けませんでした。PNG/JPG 画像として保存して試してください。", pdfPassword: "この PDF はパスワードで保護されています。解除してから再度お試しください。" });
Object.assign(I18N.ko, { pdfLoading: "PDF 여는 중…", pdfPageTitle: "페이지 선택", pdfPageBody: "이 PDF는 {n}페이지입니다. 설계할 평면도 페이지를 선택하세요.", pdfPageLbl: "페이지", pdfUsePage: "이 페이지 사용", pdfError: "PDF를 열 수 없습니다. PNG/JPG 이미지로 저장해 다시 시도하세요.", pdfPassword: "암호로 보호된 PDF입니다. 암호를 해제한 뒤 다시 시도하세요." });
Object.assign(I18N.vi, { pdfLoading: "Đang mở PDF…", pdfPageTitle: "Chọn trang", pdfPageBody: "File PDF này có {n} trang. Hãy chọn trang bản vẽ mặt bằng cần thiết kế.", pdfPageLbl: "Trang", pdfUsePage: "Dùng trang này", pdfError: "Không mở được PDF. Hãy lưu thành ảnh PNG/JPG rồi thử lại.", pdfPassword: "PDF có mật khẩu. Hãy bỏ mật khẩu rồi thử lại." });
Object.assign(I18N.lo, { pdfLoading: "ກຳລັງເປີດ PDF…", pdfPageTitle: "ເລືອກໜ້າແຜນຜັງ", pdfPageBody: "ໄຟລ໌ PDF ນີ້ມີ {n} ໜ້າ — ເລືອກໜ້າທີ່ເປັນແຜນຜັງຊັ້ນທີ່ຈະອອກແບບ", pdfPageLbl: "ໜ້າທີ່", pdfUsePage: "ໃຊ້ໜ້ານີ້", pdfError: "ເປີດ PDF ບໍ່ໄດ້ — ລອງບັນທຶກເປັນຮູບ PNG/JPG ແທນ", pdfPassword: "PDF ນີ້ມີລະຫັດຜ່ານ — ປົດລະຫັດກ່ອນແລ້ວລອງໃໝ່" });
Object.assign(I18N.my, { pdfLoading: "PDF ဖွင့်နေသည်…", pdfPageTitle: "စာမျက်နှာ ရွေးရန်", pdfPageBody: "ဤ PDF တွင် စာမျက်နှာ {n} ခု ရှိသည်။ ဒီဇိုင်းဆွဲမည့် အထပ်ပုံစံ စာမျက်နှာကို ရွေးပါ။", pdfPageLbl: "စာမျက်နှာ", pdfUsePage: "ဤစာမျက်နှာ သုံးရန်", pdfError: "PDF ဖွင့်၍ မရပါ — PNG/JPG ပုံအဖြစ် သိမ်းပြီး ပြန်စမ်းပါ", pdfPassword: "ဤ PDF တွင် စကားဝှက် ရှိသည် — စကားဝှက် ဖြုတ်ပြီး ပြန်စမ်းပါ" });

// ---- install as app ----
Object.assign(I18N.th, { installApp: "ติดตั้งแอป", appInstalled: "ติดตั้งแอปแล้ว — เปิดได้จากไอคอนบนเดสก์ท็อป / หน้าจอหลัก", installIos: "บน iPhone / iPad: แตะปุ่ม <b>แชร์</b> (สี่เหลี่ยมมีลูกศรขึ้น) ใน Safari แล้วเลือก <b>เพิ่มไปยังหน้าจอโฮม</b> แอปจะอยู่บนหน้าจอหลักและใช้งานออฟไลน์ได้" });
Object.assign(I18N.en, { installApp: "Install app", appInstalled: "App installed — open it from your desktop / home screen", installIos: "On iPhone / iPad: tap <b>Share</b> (the square with an up arrow) in Safari, then <b>Add to Home Screen</b>. The app then opens from your home screen and works offline." });
Object.assign(I18N.zh, { installApp: "安装应用", appInstalled: "应用已安装 — 可从桌面 / 主屏幕打开", installIos: "在 iPhone / iPad 上：在 Safari 中点按<b>分享</b>（带向上箭头的方框），然后选择<b>添加到主屏幕</b>。之后可从主屏幕打开并离线使用。" });
Object.assign(I18N.ja, { installApp: "アプリをインストール", appInstalled: "インストールしました — デスクトップ / ホーム画面から開けます", installIos: "iPhone / iPad の場合：Safari で<b>共有</b>（上向き矢印の四角）をタップし、<b>ホーム画面に追加</b>を選びます。ホーム画面から開け、オフラインでも使えます。" });
Object.assign(I18N.ko, { installApp: "앱 설치", appInstalled: "앱이 설치되었습니다 — 바탕화면 / 홈 화면에서 여세요", installIos: "iPhone / iPad: Safari에서 <b>공유</b>(위쪽 화살표가 있는 사각형)를 누른 뒤 <b>홈 화면에 추가</b>를 선택하세요. 홈 화면에서 열 수 있고 오프라인에서도 작동합니다." });
Object.assign(I18N.vi, { installApp: "Cài ứng dụng", appInstalled: "Đã cài ứng dụng — mở từ màn hình chính / desktop", installIos: "Trên iPhone / iPad: chạm <b>Chia sẻ</b> (hình vuông có mũi tên lên) trong Safari, rồi chọn <b>Thêm vào MH chính</b>. Ứng dụng sẽ mở từ màn hình chính và dùng được ngoại tuyến." });
Object.assign(I18N.lo, { installApp: "ຕິດຕັ້ງແອັບ", appInstalled: "ຕິດຕັ້ງແອັບແລ້ວ — ເປີດໄດ້ຈາກໄອຄອນເທິງໜ້າຈໍ", installIos: "ເທິງ iPhone / iPad: ແຕະປຸ່ມ <b>ແບ່ງປັນ</b> (ສີ່ລ່ຽມມີລູກສອນຂຶ້ນ) ໃນ Safari ແລ້ວເລືອກ <b>ເພີ່ມໃສ່ໜ້າຈໍຫຼັກ</b> ແອັບຈະຢູ່ໜ້າຈໍຫຼັກ ແລະ ໃຊ້ອອຟລາຍໄດ້" });
Object.assign(I18N.my, { installApp: "အက်ပ် ထည့်သွင်းရန်", appInstalled: "အက်ပ် ထည့်သွင်းပြီး — desktop / ပင်မစခရင်မှ ဖွင့်ပါ", installIos: "iPhone / iPad တွင်: Safari ရှိ <b>Share</b> (အပေါ်မြှားပါ စတုရန်း) ကို နှိပ်ပြီး <b>Add to Home Screen</b> ကို ရွေးပါ။ ပင်မစခရင်မှ ဖွင့်နိုင်ပြီး အော့ဖ်လိုင်း သုံးနိုင်သည်။" });
Object.assign(I18N.th, { updateReady: "มีเวอร์ชันใหม่ — แตะเพื่อโหลดใหม่" });
Object.assign(I18N.en, { updateReady: "New version available — tap to reload" });
Object.assign(I18N.zh, { updateReady: "有新版本 — 点击重新加载" });
Object.assign(I18N.ja, { updateReady: "新しいバージョンがあります — タップして再読み込み" });
Object.assign(I18N.ko, { updateReady: "새 버전이 있습니다 — 탭하여 새로고침" });
Object.assign(I18N.vi, { updateReady: "Đã có phiên bản mới — chạm để tải lại" });
Object.assign(I18N.lo, { updateReady: "ມີເວີຊັນໃໝ່ — ແຕະເພື່ອໂຫຼດໃໝ່" });
Object.assign(I18N.my, { updateReady: "ဗားရှင်းအသစ် ရနိုင်ပါပြီ — ပြန်ဖွင့်ရန် နှိပ်ပါ" });

// ---- unsaved work ----
Object.assign(I18N.th, { unsavedTitle: "บันทึกงานก่อนไหม?", unsavedBody: "งานปัจจุบันยังไม่ได้บันทึก ถ้าดำเนินการต่อโดยไม่บันทึก งานนี้จะหายไป", saveFirst: "บันทึกก่อน", dontSave: "ไม่บันทึก" });
Object.assign(I18N.en, { unsavedTitle: "Save your work first?", unsavedBody: "The current work hasn't been saved. If you continue without saving, it will be lost.", saveFirst: "Save first", dontSave: "Don't save" });
Object.assign(I18N.zh, { unsavedTitle: "先保存工作吗？", unsavedBody: "当前工作尚未保存。如果不保存就继续，工作将会丢失。", saveFirst: "先保存", dontSave: "不保存" });
Object.assign(I18N.ja, { unsavedTitle: "先に保存しますか？", unsavedBody: "現在の作業は保存されていません。保存せずに続けると失われます。", saveFirst: "先に保存", dontSave: "保存しない" });
Object.assign(I18N.ko, { unsavedTitle: "먼저 저장할까요?", unsavedBody: "현재 작업이 저장되지 않았습니다. 저장하지 않고 계속하면 작업이 사라집니다.", saveFirst: "먼저 저장", dontSave: "저장 안 함" });
Object.assign(I18N.vi, { unsavedTitle: "Lưu công việc trước?", unsavedBody: "Công việc hiện tại chưa được lưu. Nếu tiếp tục mà không lưu, công việc sẽ bị mất.", saveFirst: "Lưu trước", dontSave: "Không lưu" });
Object.assign(I18N.lo, { unsavedTitle: "ບັນທຶກວຽກກ່ອນບໍ?", unsavedBody: "ວຽກປັດຈຸບັນຍັງບໍ່ໄດ້ບັນທຶກ ຖ້າດຳເນີນການຕໍ່ໂດຍບໍ່ບັນທຶກ ວຽກນີ້ຈະຫາຍໄປ", saveFirst: "ບັນທຶກກ່ອນ", dontSave: "ບໍ່ບັນທຶກ" });
Object.assign(I18N.my, { unsavedTitle: "အလုပ်ကို အရင် သိမ်းမလား?", unsavedBody: "လက်ရှိ အလုပ်ကို မသိမ်းရသေးပါ။ မသိမ်းဘဲ ဆက်လုပ်ပါက ပျောက်သွားမည်။", saveFirst: "အရင် သိမ်းရန်", dontSave: "မသိမ်းပါ" });

// ---- rulers ----
I18N.th.rulers = "แสดงไม้บรรทัด (เมตร)";
I18N.en.rulers = "Show rulers (m)";
I18N.zh.rulers = "显示标尺（米）";
I18N.ja.rulers = "ルーラーを表示 (m)";
I18N.ko.rulers = "눈금자 표시 (m)";
I18N.vi.rulers = "Hiện thước đo (m)";
I18N.lo.rulers = "ສະແດງໄມ້ບັນທັດ (ແມັດ)";
I18N.my.rulers = "ပေတံ ပြရန် (မီတာ)";


// t() with {placeholders}
function tf(key, vars = {}) { return t(key).replace(/\{(\w+)\}/g, (_, k) => (k in vars ? vars[k] : `{${k}}`)); }

// First visit: use the browser language if supported, otherwise Thai.
function detectLang() {
  const supported = LANGS.map(l => l.code);
  for (const l of navigator.languages || [navigator.language || ""]) {
    const code = l.toLowerCase().split("-")[0];
    if (supported.includes(code)) return code;
  }
  return "th";
}

let LANG = "th";
try { LANG = localStorage.getItem("wpth-lang") || detectLang(); } catch (e) { LANG = detectLang(); }
if (!I18N[LANG]) LANG = "th";

function t(key) { return (I18N[LANG] && I18N[LANG][key]) || I18N.en[key] || key; }
function langLocale() { return (LANGS.find(l => l.code === LANG) || LANGS[0]).locale; }

function applyI18n() {
  document.documentElement.lang = LANG;
  document.querySelectorAll("[data-i18n]").forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll("[data-i18n-title]").forEach(el => { el.title = t(el.dataset.i18nTitle); });
}

function setLang(lang) {
  if (!I18N[lang]) return;
  LANG = lang;
  try { localStorage.setItem("wpth-lang", lang); } catch (e) {}
  applyI18n();
}
