// Access point catalogue: typical max Tx power (dBm, conducted) and antenna gain (dBi)
// per band, taken from public datasheets. Values are approximate; real APs
// sold in Thailand are limited by the country code, so enable the NBTC cap.
// Add a model by appending one line.
const AP_MODELS = [
  // id,                  brand,              model,                      std,       tx24, tx5, g24, g5
  ["generic-ax",          "Generic",          "Wi-Fi 6 ceiling AP",       "Wi-Fi 6",  20, 23, 3,   4],
  ["generic-ac",          "Generic",          "Wi-Fi 5 ceiling AP",       "Wi-Fi 5",  20, 20, 3,   4],
  ["home-router",         "Generic",          "Home router (Wi-Fi 5/6)",  "Wi-Fi 6",  20, 20, 3,   3],
  ["isp-onu",             "Generic",          "ISP ONU / fiber router",   "Wi-Fi 5",  18, 20, 2,   3],

  ["ubnt-u6-lite",        "Ubiquiti UniFi",   "U6 Lite",                  "Wi-Fi 6",  23, 26, 2.8, 3],
  ["ubnt-u6-plus",        "Ubiquiti UniFi",   "U6+",                      "Wi-Fi 6",  23, 26, 4,   5.5],
  ["ubnt-u6-pro",         "Ubiquiti UniFi",   "U6 Pro",                   "Wi-Fi 6",  22, 26, 4,   6],
  ["ubnt-u6-lr",          "Ubiquiti UniFi",   "U6 Long-Range",            "Wi-Fi 6",  26, 26, 4,   5.5],
  ["ubnt-u6-ent",         "Ubiquiti UniFi",   "U6 Enterprise",            "Wi-Fi 6E", 25, 26, 4,   6],
  ["ubnt-u7-pro",         "Ubiquiti UniFi",   "U7 Pro",                   "Wi-Fi 7",  22, 25, 4,   6],
  ["ubnt-u6-iw",          "Ubiquiti UniFi",   "U6 In-Wall",               "Wi-Fi 6",  22, 26, 3,   4],

  ["tpl-eap225",          "TP-Link Omada",    "EAP225",                   "Wi-Fi 5",  23, 23, 4,   5],
  ["tpl-eap245",          "TP-Link Omada",    "EAP245",                   "Wi-Fi 5",  23, 23, 4,   5],
  ["tpl-eap610",          "TP-Link Omada",    "EAP610",                   "Wi-Fi 6",  23, 23, 4,   5],
  ["tpl-eap650",          "TP-Link Omada",    "EAP650",                   "Wi-Fi 6",  23, 25, 4,   5],
  ["tpl-eap670",          "TP-Link Omada",    "EAP670",                   "Wi-Fi 6",  23, 25, 5,   5],
  ["tpl-eap235w",         "TP-Link Omada",    "EAP235-Wall",              "Wi-Fi 5",  20, 20, 3,   4],
  ["tpl-eap615w",         "TP-Link Omada",    "EAP615-Wall",              "Wi-Fi 6",  20, 23, 3,   4],

  ["rj-rap2200e",         "Ruijie Reyee",     "RG-RAP2200(E)",            "Wi-Fi 5",  20, 20, 3,   4],
  ["rj-rap2260g",         "Ruijie Reyee",     "RG-RAP2260(G)",            "Wi-Fi 6",  20, 23, 3,   4],
  ["rj-rap1260",          "Ruijie Reyee",     "RG-RAP1260",               "Wi-Fi 6",  20, 23, 3,   4],

  ["aruba-ap11",          "Aruba Instant On", "AP11",                     "Wi-Fi 5",  21, 21, 3.5, 4.9],
  ["aruba-ap22",          "Aruba Instant On", "AP22",                     "Wi-Fi 6",  21, 21, 3.6, 5.4],
  ["aruba-ap25",          "Aruba Instant On", "AP25",                     "Wi-Fi 6",  22, 22, 3.6, 5.6],

  ["meraki-mr36",         "Cisco Meraki",     "MR36",                     "Wi-Fi 6",  20, 20, 5.4, 6],
  ["meraki-mr46",         "Cisco Meraki",     "MR46",                     "Wi-Fi 6",  22, 22, 5.4, 6],

  ["ruckus-r550",         "Ruckus",           "R550",                     "Wi-Fi 6",  22, 22, 3,   3],
  ["ruckus-r650",         "Ruckus",           "R650",                     "Wi-Fi 6",  23, 23, 3,   3],

  ["huawei-ae5761",       "Huawei",           "AirEngine 5761-11",        "Wi-Fi 6",  23, 23, 4,   5],
  ["mikrotik-capax",      "MikroTik",         "cAP ax",                   "Wi-Fi 6",  25, 25, 3.5, 5.5],
  ["gs-gwn7660",          "Grandstream",      "GWN7660",                  "Wi-Fi 6",  25, 25, 4,   5],
  ["tpl-deco-x20",        "TP-Link Deco",     "Deco X20 (mesh)",          "Wi-Fi 6",  20, 23, 3,   4],
].map(([id, brand, model, std, tx24, tx5, gain24, gain5]) => ({ id, brand, model, std, tx24, tx5, gain24, gain5 }));

const AP_BY_ID = Object.fromEntries(AP_MODELS.map(m => [m.id, m]));

// Thai NBTC EIRP caps (dBm). 5 GHz: 5150–5350 MHz (ch 36–64) 200 mW; 5470–5850 MHz (ch 100+) 1 W.
// Verify against the current NBTC notification before quoting a project.
const NBTC_CAP = { "2.4": 20, "5": 23, "5high": 30 };

// Coverage requirement profiles (minimum acceptable RSSI).
const REQ_PROFILES = [
  { dbm: -65, key: "req65" },
  { dbm: -67, key: "req67" },
  { dbm: -70, key: "req70" },
  { dbm: -72, key: "req72" },
  { dbm: -75, key: "req75" },
];
// "Auto" picks a requirement from the building type (index = ENVIRONMENTS index).
const REQ_AUTO_BY_ENV = [-67, -67, -70, -72];

// Non-overlapping channel plans used by the optimizer.
const CHANNELS = { "2.4": [1, 6, 11], "5": [36, 44, 149, 157] };
