// Access point catalogue: typical max Tx power (dBm, conducted) and antenna gain (dBi)
// per band, taken from public datasheets. Values are approximate; real APs
// sold in Thailand are limited by the country code, so enable the NBTC cap.
// Add a model by appending one line. Users can also add their own models in the app
// (stored in the browser and in the project file); see registerCustomModels() in app.js.
// A band the model does not have is written as tx = 0 (e.g. 2.4 GHz-only APs).
// Wi-Fi 7 models without a 6 GHz radio (dual-band 2.4 / 5 GHz)
const NO_6GHZ = new Set(["ubnt-u7-lite", "ubnt-u7-iw", "tpl-eap723", "asus-rt-be88u", "xiaomi-be7000", "huawei-ae5773-21"]);

const AP_MODELS = [
  // id,                  brand,              model,                      std,       tx24, tx5, g24, g5
  // ---- generic ----
  ["generic-ax",          "Generic",          "Wi-Fi 6 ceiling AP",       "Wi-Fi 6",  20, 23, 3,   4],
  ["generic-be",          "Generic",          "Wi-Fi 7 ceiling AP",       "Wi-Fi 7",  21, 24, 4,   5],
  ["generic-ac",          "Generic",          "Wi-Fi 5 ceiling AP",       "Wi-Fi 5",  20, 20, 3,   4],
  ["generic-n",           "Generic",          "Wi-Fi 4 (802.11n) AP",     "Wi-Fi 4",  20, 17, 3,   4],
  ["generic-wall",        "Generic",          "Wall-plate AP",            "Wi-Fi 6",  18, 20, 2,   3],
  ["generic-outdoor",     "Generic",          "Outdoor omni AP",          "Wi-Fi 6",  26, 26, 5,   6],
  ["home-router",         "Generic",          "Home router (Wi-Fi 5/6)",  "Wi-Fi 6",  20, 20, 3,   3],
  ["generic-mesh",        "Generic",          "Mesh node (home)",         "Wi-Fi 6",  20, 22, 3,   4],
  ["isp-onu",             "Generic",          "ISP ONU / fiber router",   "Wi-Fi 5",  18, 20, 2,   3],

  // ---- ISP fiber routers common in Thailand (AIS / True / 3BB / NT) ----
  ["isp-hg8145v5",        "ISP router",       "Huawei HG8145V5",          "Wi-Fi 5",  18, 20, 2,   3],
  ["isp-hg8145x6",        "ISP router",       "Huawei HG8145X6",          "Wi-Fi 6",  20, 22, 3,   4],
  ["isp-zte-f670l",       "ISP router",       "ZTE F670L",                "Wi-Fi 5",  18, 20, 2,   3],
  ["isp-zte-f6600p",      "ISP router",       "ZTE F6600P",               "Wi-Fi 6",  20, 22, 3,   4],
  ["isp-zte-f6107a",      "ISP router",       "ZTE F6107A",               "Wi-Fi 6",  20, 22, 3,   4],
  ["isp-fh-hg6145f",      "ISP router",       "FiberHome HG6145F",        "Wi-Fi 5",  18, 20, 2,   3],
  ["isp-fh-hg6145f3",     "ISP router",       "FiberHome HG6145F3",       "Wi-Fi 6",  20, 22, 3,   4],
  ["isp-nokia-g2425g",    "ISP router",       "Nokia G-2425G-A",          "Wi-Fi 6",  20, 22, 3,   4],

  // ---- Ubiquiti UniFi ----
  ["ubnt-uap-ac-lite",    "Ubiquiti UniFi",   "UAP-AC-Lite",              "Wi-Fi 5",  20, 20, 3,   3],
  ["ubnt-uap-ac-lr",      "Ubiquiti UniFi",   "UAP-AC-LR",                "Wi-Fi 5",  24, 22, 3,   3],
  ["ubnt-uap-ac-pro",     "Ubiquiti UniFi",   "UAP-AC-Pro",               "Wi-Fi 5",  22, 22, 3,   3],
  ["ubnt-uap-nanohd",     "Ubiquiti UniFi",   "nanoHD",                   "Wi-Fi 5",  23, 26, 2.8, 3],
  ["ubnt-uap-flexhd",     "Ubiquiti UniFi",   "FlexHD",                   "Wi-Fi 5",  23, 26, 2.8, 3],
  ["ubnt-uap-ac-m",       "Ubiquiti UniFi",   "UAP-AC-Mesh (outdoor)",    "Wi-Fi 5",  20, 20, 3,   4],
  ["ubnt-u6-lite",        "Ubiquiti UniFi",   "U6 Lite",                  "Wi-Fi 6",  23, 26, 2.8, 3],
  ["ubnt-u6-plus",        "Ubiquiti UniFi",   "U6+",                      "Wi-Fi 6",  23, 26, 4,   5.5],
  ["ubnt-u6-pro",         "Ubiquiti UniFi",   "U6 Pro",                   "Wi-Fi 6",  22, 26, 4,   6],
  ["ubnt-u6-lr",          "Ubiquiti UniFi",   "U6 Long-Range",            "Wi-Fi 6",  26, 26, 4,   5.5],
  ["ubnt-u6-mesh",        "Ubiquiti UniFi",   "U6 Mesh",                  "Wi-Fi 6",  23, 26, 4,   6],
  ["ubnt-u6-ent",         "Ubiquiti UniFi",   "U6 Enterprise",            "Wi-Fi 6E", 25, 26, 4,   6],
  ["ubnt-u6-ent-iw",      "Ubiquiti UniFi",   "U6 Enterprise In-Wall",    "Wi-Fi 6E", 22, 26, 3,   4],
  ["ubnt-u6-iw",          "Ubiquiti UniFi",   "U6 In-Wall",               "Wi-Fi 6",  22, 26, 3,   4],
  ["ubnt-u6-ext",         "Ubiquiti UniFi",   "U6 Extender",              "Wi-Fi 6",  23, 26, 4,   5.5],
  ["ubnt-u7-lite",        "Ubiquiti UniFi",   "U7 Lite",                  "Wi-Fi 7",  23, 25, 4,   5],
  ["ubnt-u7-pro",         "Ubiquiti UniFi",   "U7 Pro",                   "Wi-Fi 7",  22, 25, 4,   6],
  ["ubnt-u7-pro-max",     "Ubiquiti UniFi",   "U7 Pro Max",               "Wi-Fi 7",  25, 26, 4,   6],
  ["ubnt-u7-pro-wall",    "Ubiquiti UniFi",   "U7 Pro Wall",              "Wi-Fi 7",  22, 25, 4,   6],
  ["ubnt-u7-outdoor",     "Ubiquiti UniFi",   "U7 Outdoor",               "Wi-Fi 7",  25, 26, 5,   6],
  ["ubnt-u7-iw",          "Ubiquiti UniFi",   "U7 In-Wall",               "Wi-Fi 7",  22, 25, 3,   4],

  // ---- TP-Link Omada ----
  ["tpl-eap110",          "TP-Link Omada",    "EAP110",                   "Wi-Fi 4",  20, 0,  3,   0],
  ["tpl-eap115",          "TP-Link Omada",    "EAP115",                   "Wi-Fi 4",  20, 0,  3,   0],
  ["tpl-eap115w",         "TP-Link Omada",    "EAP115-Wall",              "Wi-Fi 4",  20, 0,  2,   0],
  ["tpl-eap223",          "TP-Link Omada",    "EAP223",                   "Wi-Fi 5",  23, 23, 4,   5],
  ["tpl-eap225",          "TP-Link Omada",    "EAP225",                   "Wi-Fi 5",  23, 23, 4,   5],
  ["tpl-eap225o",         "TP-Link Omada",    "EAP225-Outdoor",           "Wi-Fi 5",  23, 23, 5,   6],
  ["tpl-eap230w",         "TP-Link Omada",    "EAP230-Wall",              "Wi-Fi 5",  20, 20, 3,   4],
  ["tpl-eap235w",         "TP-Link Omada",    "EAP235-Wall",              "Wi-Fi 5",  20, 20, 3,   4],
  ["tpl-eap245",          "TP-Link Omada",    "EAP245",                   "Wi-Fi 5",  23, 23, 4,   5],
  ["tpl-eap265hd",        "TP-Link Omada",    "EAP265 HD",                "Wi-Fi 5",  23, 23, 4,   5],
  ["tpl-eap610",          "TP-Link Omada",    "EAP610",                   "Wi-Fi 6",  23, 23, 4,   5],
  ["tpl-eap610o",         "TP-Link Omada",    "EAP610-Outdoor",           "Wi-Fi 6",  23, 23, 5,   6],
  ["tpl-eap613",          "TP-Link Omada",    "EAP613",                   "Wi-Fi 6",  23, 23, 4,   5],
  ["tpl-eap615w",         "TP-Link Omada",    "EAP615-Wall",              "Wi-Fi 6",  20, 23, 3,   4],
  ["tpl-eap620hd",        "TP-Link Omada",    "EAP620 HD",                "Wi-Fi 6",  23, 25, 4,   5],
  ["tpl-eap625o",         "TP-Link Omada",    "EAP625-Outdoor HD",        "Wi-Fi 6",  23, 25, 5,   6],
  ["tpl-eap650",          "TP-Link Omada",    "EAP650",                   "Wi-Fi 6",  23, 25, 4,   5],
  ["tpl-eap650o",         "TP-Link Omada",    "EAP650-Outdoor",           "Wi-Fi 6",  23, 25, 5,   6],
  ["tpl-eap653",          "TP-Link Omada",    "EAP653",                   "Wi-Fi 6",  23, 25, 4,   5],
  ["tpl-eap655w",         "TP-Link Omada",    "EAP655-Wall",              "Wi-Fi 6",  20, 23, 3,   4],
  ["tpl-eap660hd",        "TP-Link Omada",    "EAP660 HD",                "Wi-Fi 6",  23, 25, 4,   5],
  ["tpl-eap670",          "TP-Link Omada",    "EAP670",                   "Wi-Fi 6",  23, 25, 5,   5],
  ["tpl-eap673",          "TP-Link Omada",    "EAP673",                   "Wi-Fi 6",  23, 25, 5,   5],
  ["tpl-eap680",          "TP-Link Omada",    "EAP680",                   "Wi-Fi 6E", 23, 25, 5,   5],
  ["tpl-eap683lr",        "TP-Link Omada",    "EAP683 LR",                "Wi-Fi 6",  27, 27, 5,   6],
  ["tpl-eap690e",         "TP-Link Omada",    "EAP690E HD",               "Wi-Fi 6E", 23, 25, 5,   6],
  ["tpl-eap723",          "TP-Link Omada",    "EAP723",                   "Wi-Fi 7",  23, 25, 4,   5],
  ["tpl-eap770",          "TP-Link Omada",    "EAP770",                   "Wi-Fi 7",  23, 25, 5,   5],
  ["tpl-eap772",          "TP-Link Omada",    "EAP772",                   "Wi-Fi 7",  23, 25, 5,   5],
  ["tpl-eap773",          "TP-Link Omada",    "EAP773",                   "Wi-Fi 7",  23, 25, 5,   6],
  ["tpl-eap783",          "TP-Link Omada",    "EAP783",                   "Wi-Fi 7",  23, 25, 5,   6],
  ["tpl-eap787",          "TP-Link Omada",    "EAP787",                   "Wi-Fi 7",  23, 25, 5,   6],

  // ---- TP-Link home / mesh ----
  ["tpl-c6",              "TP-Link Archer",   "Archer C6",                "Wi-Fi 5",  20, 20, 3,   4],
  ["tpl-c80",             "TP-Link Archer",   "Archer C80",               "Wi-Fi 5",  20, 20, 4,   5],
  ["tpl-ax10",            "TP-Link Archer",   "Archer AX10",              "Wi-Fi 6",  20, 22, 4,   5],
  ["tpl-ax23",            "TP-Link Archer",   "Archer AX23",              "Wi-Fi 6",  20, 22, 5,   5],
  ["tpl-ax55",            "TP-Link Archer",   "Archer AX55",              "Wi-Fi 6",  20, 23, 5,   5],
  ["tpl-ax73",            "TP-Link Archer",   "Archer AX73",              "Wi-Fi 6",  20, 23, 5,   5],
  ["tpl-be550",           "TP-Link Archer",   "Archer BE550",             "Wi-Fi 7",  20, 23, 4,   5],
  ["tpl-deco-m4",         "TP-Link Deco",     "Deco M4",                  "Wi-Fi 5",  20, 20, 3,   4],
  ["tpl-deco-m5",         "TP-Link Deco",     "Deco M5",                  "Wi-Fi 5",  20, 20, 3,   4],
  ["tpl-deco-x20",        "TP-Link Deco",     "Deco X20",                 "Wi-Fi 6",  20, 23, 3,   4],
  ["tpl-deco-x50",        "TP-Link Deco",     "Deco X50",                 "Wi-Fi 6",  20, 23, 3,   4],
  ["tpl-deco-x55",        "TP-Link Deco",     "Deco X55",                 "Wi-Fi 6",  20, 23, 3,   4],
  ["tpl-deco-x60",        "TP-Link Deco",     "Deco X60",                 "Wi-Fi 6",  20, 23, 3,   4],
  ["tpl-deco-xe75",       "TP-Link Deco",     "Deco XE75",                "Wi-Fi 6E", 20, 23, 3,   4],
  ["tpl-deco-be65",       "TP-Link Deco",     "Deco BE65",                "Wi-Fi 7",  20, 23, 3,   4],
  ["mercusys-halo-h80x",  "Mercusys",         "Halo H80X",                "Wi-Fi 6",  20, 23, 3,   4],
  ["mercusys-mr70x",      "Mercusys",         "MR70X",                    "Wi-Fi 6",  20, 22, 4,   5],

  // ---- Ruijie / Reyee ----
  ["rj-rap1200f",         "Ruijie Reyee",     "RG-RAP1200(F)",            "Wi-Fi 5",  20, 20, 3,   4],
  ["rj-rap2200e",         "Ruijie Reyee",     "RG-RAP2200(E)",            "Wi-Fi 5",  20, 20, 3,   4],
  ["rj-rap2200f",         "Ruijie Reyee",     "RG-RAP2200(F)",            "Wi-Fi 5",  20, 20, 3,   4],
  ["rj-rap1260",          "Ruijie Reyee",     "RG-RAP1260",               "Wi-Fi 6",  20, 23, 3,   4],
  ["rj-rap1261",          "Ruijie Reyee",     "RG-RAP1261",               "Wi-Fi 6",  20, 23, 3,   4],
  ["rj-rap2260g",         "Ruijie Reyee",     "RG-RAP2260(G)",            "Wi-Fi 6",  20, 23, 3,   4],
  ["rj-rap2260e",         "Ruijie Reyee",     "RG-RAP2260(E)",            "Wi-Fi 6",  20, 23, 4,   5],
  ["rj-rap2266",          "Ruijie Reyee",     "RG-RAP2266",               "Wi-Fi 6",  23, 25, 4,   5],
  ["rj-rap62r",           "Ruijie Reyee",     "RG-RAP62R (outdoor)",      "Wi-Fi 6",  23, 25, 5,   6],
  ["rj-rap6262",          "Ruijie Reyee",     "RG-RAP6262 (outdoor)",     "Wi-Fi 6",  23, 25, 5,   6],
  ["rj-rap1200p",         "Ruijie Reyee",     "RG-RAP1200(P) wall",       "Wi-Fi 5",  18, 20, 2,   3],
  ["rj-rap1201",          "Ruijie Reyee",     "RG-RAP1201 wall",          "Wi-Fi 6",  18, 20, 2,   3],
  ["rj-ap820l",           "Ruijie",           "RG-AP820-L(V3)",           "Wi-Fi 6",  23, 23, 4,   5],
  ["rj-ap880i",           "Ruijie",           "RG-AP880-I",               "Wi-Fi 6",  23, 25, 4,   5],
  ["rj-ap180",            "Ruijie",           "RG-AP180 wall",            "Wi-Fi 6",  20, 20, 3,   3],

  // ---- Aruba Instant On ----
  ["aruba-ap11",          "Aruba Instant On", "AP11",                     "Wi-Fi 5",  21, 21, 3.5, 4.9],
  ["aruba-ap11d",         "Aruba Instant On", "AP11D (desk/wall)",        "Wi-Fi 5",  21, 21, 3.5, 4.9],
  ["aruba-ap12",          "Aruba Instant On", "AP12",                     "Wi-Fi 5",  21, 21, 3.5, 4.9],
  ["aruba-ap15",          "Aruba Instant On", "AP15",                     "Wi-Fi 5",  21, 21, 3.6, 5.4],
  ["aruba-ap17",          "Aruba Instant On", "AP17 (outdoor)",           "Wi-Fi 5",  21, 21, 5,   5.5],
  ["aruba-ap21",          "Aruba Instant On", "AP21",                     "Wi-Fi 6",  21, 21, 3.6, 5.4],
  ["aruba-ap22",          "Aruba Instant On", "AP22",                     "Wi-Fi 6",  21, 21, 3.6, 5.4],
  ["aruba-ap22d",         "Aruba Instant On", "AP22D (desk/wall)",        "Wi-Fi 6",  21, 21, 3.6, 5.4],
  ["aruba-ap25",          "Aruba Instant On", "AP25",                     "Wi-Fi 6",  22, 22, 3.6, 5.6],
  ["aruba-ap27",          "Aruba Instant On", "AP27 (outdoor)",           "Wi-Fi 6",  22, 22, 5,   5.5],
  ["aruba-ap32",          "Aruba Instant On", "AP32",                     "Wi-Fi 6E", 21, 21, 3.6, 5.4],

  // ---- HPE Aruba Networking (campus) ----
  ["aruba-303",           "HPE Aruba",        "AP-303",                   "Wi-Fi 5",  21, 21, 3.5, 5],
  ["aruba-305",           "HPE Aruba",        "AP-305",                   "Wi-Fi 5",  21, 21, 3.6, 5],
  ["aruba-505",           "HPE Aruba",        "AP-505",                   "Wi-Fi 6",  21, 21, 3.8, 5.8],
  ["aruba-515",           "HPE Aruba",        "AP-515",                   "Wi-Fi 6",  21, 21, 3.8, 5.8],
  ["aruba-535",           "HPE Aruba",        "AP-535",                   "Wi-Fi 6",  21, 21, 4,   6],
  ["aruba-565",           "HPE Aruba",        "AP-565 (outdoor)",         "Wi-Fi 6",  21, 21, 5,   6],
  ["aruba-615",           "HPE Aruba",        "AP-615",                   "Wi-Fi 6E", 21, 21, 3.8, 5.8],
  ["aruba-635",           "HPE Aruba",        "AP-635",                   "Wi-Fi 6E", 21, 21, 4,   6],
  ["aruba-655",           "HPE Aruba",        "AP-655",                   "Wi-Fi 6E", 21, 21, 4,   6],
  ["aruba-735",           "HPE Aruba",        "AP-735",                   "Wi-Fi 7",  21, 21, 4,   6],

  // ---- Cisco Meraki ----
  ["meraki-mr20",         "Cisco Meraki",     "MR20",                     "Wi-Fi 5",  20, 20, 4,   5],
  ["meraki-mr28",         "Cisco Meraki",     "MR28",                     "Wi-Fi 6",  20, 20, 4,   5],
  ["meraki-mr33",         "Cisco Meraki",     "MR33",                     "Wi-Fi 5",  20, 20, 3.5, 5],
  ["meraki-mr36",         "Cisco Meraki",     "MR36",                     "Wi-Fi 6",  20, 20, 5.4, 6],
  ["meraki-mr36h",        "Cisco Meraki",     "MR36H (wall)",             "Wi-Fi 6",  20, 20, 3,   4],
  ["meraki-mr44",         "Cisco Meraki",     "MR44",                     "Wi-Fi 6",  22, 22, 5.4, 6],
  ["meraki-mr46",         "Cisco Meraki",     "MR46",                     "Wi-Fi 6",  22, 22, 5.4, 6],
  ["meraki-mr56",         "Cisco Meraki",     "MR56",                     "Wi-Fi 6",  23, 23, 5.4, 6],
  ["meraki-mr57",         "Cisco Meraki",     "MR57",                     "Wi-Fi 6E", 23, 23, 5.4, 6],
  ["meraki-mr76",         "Cisco Meraki",     "MR76 (outdoor)",           "Wi-Fi 6",  23, 23, 5,   6],
  ["meraki-mr86",         "Cisco Meraki",     "MR86 (outdoor)",           "Wi-Fi 6",  23, 23, 5,   6],
  ["meraki-cw9162",       "Cisco Meraki",     "CW9162",                   "Wi-Fi 6E", 21, 23, 4,   5],
  ["meraki-cw9164",       "Cisco Meraki",     "CW9164",                   "Wi-Fi 6E", 22, 23, 4,   5],
  ["meraki-cw9166",       "Cisco Meraki",     "CW9166",                   "Wi-Fi 6E", 23, 23, 4,   5],
  ["meraki-cw9172",       "Cisco Meraki",     "CW9172",                   "Wi-Fi 7",  22, 23, 4,   5],
  ["meraki-cw9176",       "Cisco Meraki",     "CW9176",                   "Wi-Fi 7",  23, 23, 4,   6],

  // ---- Cisco Catalyst / Business ----
  ["cisco-9105axi",       "Cisco Catalyst",   "C9105AXI",                 "Wi-Fi 6",  20, 20, 4,   5],
  ["cisco-9115axi",       "Cisco Catalyst",   "C9115AXI",                 "Wi-Fi 6",  21, 21, 4,   5],
  ["cisco-9120axi",       "Cisco Catalyst",   "C9120AXI",                 "Wi-Fi 6",  23, 23, 4,   6],
  ["cisco-9130axi",       "Cisco Catalyst",   "C9130AXI",                 "Wi-Fi 6",  23, 23, 4,   6],
  ["cisco-9136i",         "Cisco Catalyst",   "C9136I",                   "Wi-Fi 6E", 23, 23, 4,   6],
  ["cisco-cbw140ac",      "Cisco Business",   "CBW140AC",                 "Wi-Fi 5",  20, 20, 4,   5],
  ["cisco-cbw150ax",      "Cisco Business",   "CBW150AX",                 "Wi-Fi 6",  20, 20, 4,   5],
  ["cisco-cbw240ac",      "Cisco Business",   "CBW240AC",                 "Wi-Fi 5",  21, 21, 4,   5],

  // ---- CommScope Ruckus ----
  ["ruckus-r320",         "Ruckus",           "R320",                     "Wi-Fi 5",  20, 20, 3,   3],
  ["ruckus-r350",         "Ruckus",           "R350",                     "Wi-Fi 6",  20, 20, 3,   3],
  ["ruckus-r510",         "Ruckus",           "R510",                     "Wi-Fi 5",  22, 22, 3,   3],
  ["ruckus-r550",         "Ruckus",           "R550",                     "Wi-Fi 6",  22, 22, 3,   3],
  ["ruckus-r610",         "Ruckus",           "R610",                     "Wi-Fi 5",  23, 23, 3,   3],
  ["ruckus-r650",         "Ruckus",           "R650",                     "Wi-Fi 6",  23, 23, 3,   3],
  ["ruckus-r750",         "Ruckus",           "R750",                     "Wi-Fi 6",  24, 24, 3,   3],
  ["ruckus-r760",         "Ruckus",           "R760",                     "Wi-Fi 6E", 24, 24, 3,   3],
  ["ruckus-r770",         "Ruckus",           "R770",                     "Wi-Fi 7",  24, 24, 3,   3],
  ["ruckus-r850",         "Ruckus",           "R850",                     "Wi-Fi 6",  25, 25, 3,   3],
  ["ruckus-h550",         "Ruckus",           "H550 (wall)",              "Wi-Fi 6",  20, 20, 2,   3],
  ["ruckus-t350",         "Ruckus",           "T350 (outdoor)",           "Wi-Fi 6",  23, 23, 5,   6],
  ["ruckus-t750",         "Ruckus",           "T750 (outdoor)",           "Wi-Fi 6",  25, 25, 5,   6],

  // ---- Huawei ----
  ["huawei-ap4050dn",     "Huawei",           "AP4050DN",                 "Wi-Fi 5",  23, 23, 4,   5],
  ["huawei-ap6050dn",     "Huawei",           "AP6050DN",                 "Wi-Fi 5",  23, 23, 4,   5],
  ["huawei-ae5760-10",    "Huawei",           "AirEngine 5760-10",        "Wi-Fi 6",  23, 23, 4,   5],
  ["huawei-ae5760-51",    "Huawei",           "AirEngine 5760-51",        "Wi-Fi 6",  25, 25, 4,   5],
  ["huawei-ae5761-11",    "Huawei",           "AirEngine 5761-11",        "Wi-Fi 6",  23, 23, 4,   5],
  ["huawei-ae5761-11w",   "Huawei",           "AirEngine 5761-11W (wall)","Wi-Fi 6",  20, 20, 3,   4],
  ["huawei-ae5762-10",    "Huawei",           "AirEngine 5762-10",        "Wi-Fi 6",  23, 23, 4,   5],
  ["huawei-ae6760-x1",    "Huawei",           "AirEngine 6760-X1",        "Wi-Fi 6",  25, 25, 4,   5],
  ["huawei-ae8760-x1",    "Huawei",           "AirEngine 8760-X1-PRO",    "Wi-Fi 6",  25, 25, 4,   5],
  ["huawei-ae5773-21",    "Huawei",           "AirEngine 5773-21",        "Wi-Fi 7",  23, 23, 4,   5],
  ["huawei-ax3",          "Huawei",           "WiFi AX3 (home)",          "Wi-Fi 6",  20, 22, 3,   4],

  // ---- H3C ----
  ["h3c-wa6320",          "H3C",              "WA6320",                   "Wi-Fi 6",  23, 23, 4,   5],
  ["h3c-wa6322",          "H3C",              "WA6322",                   "Wi-Fi 6",  23, 25, 4,   5],
  ["h3c-wa6638",          "H3C",              "WA6638",                   "Wi-Fi 6",  25, 25, 4,   5],

  // ---- Fortinet ----
  ["fortinet-fap221e",    "Fortinet",         "FortiAP 221E",             "Wi-Fi 5",  20, 20, 4,   5],
  ["fortinet-fap231f",    "Fortinet",         "FortiAP 231F",             "Wi-Fi 6",  22, 22, 4,   5],
  ["fortinet-fap231g",    "Fortinet",         "FortiAP 231G",             "Wi-Fi 6E", 22, 22, 4,   5],
  ["fortinet-fap431f",    "Fortinet",         "FortiAP 431F",             "Wi-Fi 6",  24, 24, 4,   5],
  ["fortinet-fap431g",    "Fortinet",         "FortiAP 431G",             "Wi-Fi 6E", 24, 24, 4,   5],
  ["fortinet-fap441k",    "Fortinet",         "FortiAP 441K",             "Wi-Fi 7",  24, 24, 4,   5],
  ["fortinet-fap234f",    "Fortinet",         "FortiAP 234F (outdoor)",   "Wi-Fi 6",  23, 23, 5,   6],

  // ---- Juniper Mist ----
  ["mist-ap12",           "Juniper Mist",     "AP12 (wall)",              "Wi-Fi 6",  20, 20, 3,   4],
  ["mist-ap24",           "Juniper Mist",     "AP24",                     "Wi-Fi 6E", 21, 21, 4,   5],
  ["mist-ap32",           "Juniper Mist",     "AP32",                     "Wi-Fi 6",  21, 21, 4,   5],
  ["mist-ap34",           "Juniper Mist",     "AP34",                     "Wi-Fi 6E", 21, 21, 4,   5],
  ["mist-ap43",           "Juniper Mist",     "AP43",                     "Wi-Fi 6",  23, 23, 4,   6],
  ["mist-ap45",           "Juniper Mist",     "AP45",                     "Wi-Fi 6E", 23, 23, 4,   6],
  ["mist-ap47",           "Juniper Mist",     "AP47",                     "Wi-Fi 7",  23, 23, 4,   6],

  // ---- Extreme Networks ----
  ["extreme-ap305c",      "Extreme Networks", "AP305C",                   "Wi-Fi 6",  20, 20, 4,   5],
  ["extreme-ap410c",      "Extreme Networks", "AP410C",                   "Wi-Fi 6",  22, 22, 4,   5],
  ["extreme-ap460c",      "Extreme Networks", "AP460C (outdoor)",         "Wi-Fi 6",  23, 23, 5,   6],
  ["extreme-ap3000",      "Extreme Networks", "AP3000",                   "Wi-Fi 6E", 21, 21, 4,   5],
  ["extreme-ap4000",      "Extreme Networks", "AP4000",                   "Wi-Fi 6E", 22, 22, 4,   5],
  ["extreme-ap5010",      "Extreme Networks", "AP5010",                   "Wi-Fi 7",  23, 23, 4,   6],

  // ---- Cambium Networks ----
  ["cambium-e410",        "Cambium",          "cnPilot E410",             "Wi-Fi 5",  22, 22, 4,   5],
  ["cambium-e510",        "Cambium",          "cnPilot E510 (outdoor)",   "Wi-Fi 5",  23, 23, 5,   6],
  ["cambium-xv2-2",       "Cambium",          "XV2-2",                    "Wi-Fi 6",  22, 22, 4,   5],
  ["cambium-xv2-21x",     "Cambium",          "XV2-21X",                  "Wi-Fi 6",  22, 22, 4,   5],
  ["cambium-xv3-8",       "Cambium",          "XV3-8",                    "Wi-Fi 6",  24, 24, 4,   5],
  ["cambium-xe3-4",       "Cambium",          "XE3-4",                    "Wi-Fi 6E", 23, 23, 4,   5],
  ["cambium-xv2-23t",     "Cambium",          "XV2-23T (outdoor)",        "Wi-Fi 6",  23, 23, 5,   6],

  // ---- Sophos / Zyxel / Netgear / D-Link / EnGenius ----
  ["sophos-apx320",       "Sophos",           "APX 320",                  "Wi-Fi 5",  20, 20, 3,   4],
  ["sophos-apx530",       "Sophos",           "APX 530",                  "Wi-Fi 5",  22, 22, 4,   5],
  ["sophos-ap6-420",      "Sophos",           "AP6 420",                  "Wi-Fi 6",  22, 22, 4,   5],
  ["sophos-ap6-840",      "Sophos",           "AP6 840",                  "Wi-Fi 6",  23, 23, 4,   5],

  ["zyxel-nwa50ax",       "Zyxel",            "NWA50AX",                  "Wi-Fi 6",  22, 22, 3,   4],
  ["zyxel-nwa50axpro",    "Zyxel",            "NWA50AX Pro",              "Wi-Fi 6",  22, 22, 3,   4],
  ["zyxel-nwa90axpro",    "Zyxel",            "NWA90AX Pro",              "Wi-Fi 6",  22, 22, 3,   4],
  ["zyxel-nwa110ax",      "Zyxel",            "NWA110AX",                 "Wi-Fi 6",  22, 22, 3,   4],
  ["zyxel-nwa210ax",      "Zyxel",            "NWA210AX",                 "Wi-Fi 6",  22, 22, 4,   5],
  ["zyxel-nwa1123acv3",   "Zyxel",            "NWA1123ACv3",              "Wi-Fi 5",  20, 20, 3,   4],
  ["zyxel-wax510d",       "Zyxel",            "WAX510D",                  "Wi-Fi 6",  22, 22, 3,   4],
  ["zyxel-wax610d",       "Zyxel",            "WAX610D",                  "Wi-Fi 6",  22, 22, 4,   5],
  ["zyxel-wax620d",       "Zyxel",            "WAX620D-6E",               "Wi-Fi 6E", 22, 22, 4,   5],
  ["zyxel-wax630s",       "Zyxel",            "WAX630S",                  "Wi-Fi 6",  23, 23, 4,   5],
  ["zyxel-wax655e",       "Zyxel",            "WAX655E",                  "Wi-Fi 6E", 23, 23, 4,   5],
  ["zyxel-wbe660s",       "Zyxel",            "WBE660S",                  "Wi-Fi 7",  23, 23, 4,   5],

  ["netgear-wax214",      "Netgear",          "WAX214",                   "Wi-Fi 6",  20, 20, 3,   4],
  ["netgear-wax218",      "Netgear",          "WAX218",                   "Wi-Fi 6",  22, 22, 4,   5],
  ["netgear-wax610",      "Netgear",          "WAX610",                   "Wi-Fi 6",  22, 22, 4,   5],
  ["netgear-wax615",      "Netgear",          "WAX615",                   "Wi-Fi 6",  23, 23, 4,   5],
  ["netgear-wax620",      "Netgear",          "WAX620",                   "Wi-Fi 6",  23, 23, 4,   5],
  ["netgear-wax630",      "Netgear",          "WAX630",                   "Wi-Fi 6",  23, 23, 4,   5],
  ["netgear-wbe710",      "Netgear",          "WBE710",                   "Wi-Fi 7",  23, 23, 4,   5],
  ["netgear-orbi-rbk752", "Netgear",          "Orbi RBK752 (mesh)",       "Wi-Fi 6",  20, 23, 3,   4],

  ["dlink-dap2610",       "D-Link",           "DAP-2610",                 "Wi-Fi 5",  20, 20, 3,   4],
  ["dlink-dap2662",       "D-Link",           "DAP-2662",                 "Wi-Fi 5",  22, 22, 4,   5],
  ["dlink-dapx2810",      "D-Link",           "DAP-X2810",                "Wi-Fi 6",  22, 22, 4,   5],
  ["dlink-dba1210p",      "D-Link",           "DBA-1210P (Nuclias)",      "Wi-Fi 5",  20, 20, 3,   4],
  ["dlink-dbax1230p",     "D-Link",           "DBA-X1230P (Nuclias)",     "Wi-Fi 6",  22, 22, 4,   5],
  ["dlink-m15",           "D-Link",           "AQUILA PRO AI M15 (mesh)", "Wi-Fi 6",  20, 22, 3,   4],

  ["engenius-ecw115",     "EnGenius",         "ECW115",                   "Wi-Fi 5",  20, 20, 3,   4],
  ["engenius-ecw220",     "EnGenius",         "ECW220",                   "Wi-Fi 6",  22, 22, 4,   5],
  ["engenius-ecw230",     "EnGenius",         "ECW230",                   "Wi-Fi 6",  23, 23, 4,   5],
  ["engenius-ecw336",     "EnGenius",         "ECW336",                   "Wi-Fi 6E", 23, 23, 4,   5],
  ["engenius-ecw536",     "EnGenius",         "ECW536",                   "Wi-Fi 7",  23, 23, 4,   5],
  ["engenius-ews377ap",   "EnGenius",         "EWS377AP",                 "Wi-Fi 6",  23, 23, 4,   5],

  // ---- MikroTik / Grandstream / Cudy / Tenda / IP-COM ----
  ["mikrotik-capac",      "MikroTik",         "cAP ac",                   "Wi-Fi 5",  22, 22, 2.5, 3.5],
  ["mikrotik-capax",      "MikroTik",         "cAP ax",                   "Wi-Fi 6",  25, 25, 3.5, 5.5],
  ["mikrotik-wapac",      "MikroTik",         "wAP ac (outdoor)",         "Wi-Fi 5",  22, 22, 2,   2],
  ["mikrotik-wapax",      "MikroTik",         "wAP ax (outdoor)",         "Wi-Fi 6",  24, 24, 3,   4],
  ["mikrotik-hapax2",     "MikroTik",         "hAP ax²",                  "Wi-Fi 6",  25, 25, 3,   4],
  ["mikrotik-hapax3",     "MikroTik",         "hAP ax³",                  "Wi-Fi 6",  25, 25, 3,   5.5],
  ["mikrotik-audience",   "MikroTik",         "Audience",                 "Wi-Fi 5",  25, 25, 3,   4],

  ["gs-gwn7600",          "Grandstream",      "GWN7600",                  "Wi-Fi 5",  22, 22, 3,   4],
  ["gs-gwn7605",          "Grandstream",      "GWN7605",                  "Wi-Fi 5",  22, 22, 3,   4],
  ["gs-gwn7615",          "Grandstream",      "GWN7615",                  "Wi-Fi 5",  24, 24, 4,   5],
  ["gs-gwn7625",          "Grandstream",      "GWN7625",                  "Wi-Fi 6",  24, 24, 4,   5],
  ["gs-gwn7630",          "Grandstream",      "GWN7630",                  "Wi-Fi 5",  24, 24, 4,   5],
  ["gs-gwn7660",          "Grandstream",      "GWN7660",                  "Wi-Fi 6",  25, 25, 4,   5],
  ["gs-gwn7662",          "Grandstream",      "GWN7662",                  "Wi-Fi 6",  25, 25, 4,   5],
  ["gs-gwn7664",          "Grandstream",      "GWN7664",                  "Wi-Fi 6",  25, 25, 4,   5],
  ["gs-gwn7660e",         "Grandstream",      "GWN7660E (outdoor)",       "Wi-Fi 6",  25, 25, 5,   6],

  ["cudy-ap1300",         "Cudy",             "AP1300",                   "Wi-Fi 5",  20, 20, 3,   4],
  ["cudy-ap3000",         "Cudy",             "AP3000",                   "Wi-Fi 6",  20, 22, 3,   4],
  ["cudy-wr3000",         "Cudy",             "WR3000 (router)",          "Wi-Fi 6",  20, 22, 4,   5],
  ["tenda-i24",           "Tenda",            "i24",                      "Wi-Fi 5",  20, 20, 3,   4],
  ["tenda-i27",           "Tenda",            "i27",                      "Wi-Fi 6",  20, 22, 3,   4],
  ["tenda-w15e",          "Tenda",            "W15E (router)",            "Wi-Fi 5",  20, 20, 4,   5],
  ["tenda-mx12",          "Tenda",            "Nova MX12 (mesh)",         "Wi-Fi 6",  20, 22, 3,   4],
  ["ipcom-pro6",          "IP-COM",           "Pro-6-Lite",               "Wi-Fi 6",  20, 22, 3,   4],

  // ---- home routers / mesh ----
  ["asus-rt-ax58u",       "ASUS",             "RT-AX58U",                 "Wi-Fi 6",  20, 23, 4,   5],
  ["asus-rt-ax86u",       "ASUS",             "RT-AX86U Pro",             "Wi-Fi 6",  20, 23, 5,   5],
  ["asus-rt-be88u",       "ASUS",             "RT-BE88U",                 "Wi-Fi 7",  20, 23, 5,   5],
  ["asus-xt8",            "ASUS",             "ZenWiFi XT8 (mesh)",       "Wi-Fi 6",  20, 23, 3,   4],
  ["asus-xd5",            "ASUS",             "ZenWiFi XD5 (mesh)",       "Wi-Fi 6",  20, 22, 3,   4],
  ["asus-eba63",          "ASUS",             "ExpertWiFi EBA63",         "Wi-Fi 6",  20, 22, 3,   4],
  ["xiaomi-ax3000t",      "Xiaomi",           "Router AX3000T",           "Wi-Fi 6",  20, 22, 4,   5],
  ["xiaomi-ax3600",       "Xiaomi",           "AIoT Router AX3600",       "Wi-Fi 6",  20, 23, 5,   5],
  ["xiaomi-be7000",       "Xiaomi",           "Router BE7000",            "Wi-Fi 7",  20, 23, 5,   5],
  ["linksys-velop-mx4200","Linksys",          "Velop MX4200 (mesh)",      "Wi-Fi 6",  20, 23, 3,   4],
  ["linksys-e8450",       "Linksys",          "E8450",                    "Wi-Fi 6",  20, 23, 4,   5],
  ["google-nest-wifi-pro","Google",           "Nest Wifi Pro",            "Wi-Fi 6E", 20, 22, 3,   4],
  ["eero-6plus",          "eero",             "eero 6+",                  "Wi-Fi 6",  20, 22, 3,   4],
].map(([id, brand, model, std, tx24, tx5, gain24, gain5]) => {
  // 6 GHz radio: Wi-Fi 6E / 7 models except the dual-band ones; about 1 dB below the 5 GHz radio
  const has6 = (std === "Wi-Fi 6E" || std === "Wi-Fi 7") && !NO_6GHZ.has(id);
  return { id, brand, model, std, tx24, tx5, gain24, gain5, tx6: has6 ? tx5 - 1 : 0, gain6: has6 ? gain5 : 0 };
});

const AP_BY_ID = Object.fromEntries(AP_MODELS.map(m => [m.id, m]));
if (Object.keys(AP_BY_ID).length !== AP_MODELS.length) console.warn("catalog.js: duplicate AP model id");

// Thai NBTC EIRP caps (dBm). 5 GHz: 5150–5350 MHz (ch 36–64) 200 mW; 5470–5850 MHz (ch 100+) 1 W.
// Verify against the current NBTC notification before quoting a project.
// 6 GHz: 5925–6425 MHz, indoor low power, 250 mW (24 dBm) EIRP.
const NBTC_CAP = { "2.4": 20, "5": 23, "5high": 30, "6": 24 };

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

// Non-overlapping channel plans used by the optimizer: channelPlan() in radio.js.
