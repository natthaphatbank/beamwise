// Sample project: a 30 x 20 m dorm floor (หอพัก) with a central corridor,
// 7 rooms on each side, AAC corridor walls with wooden doors, brick party walls,
// and 2 APs in the corridor — a very common (and often weak) Thai dorm layout.
function buildSampleProject() {
  const pxPerM = 40;                       // blank plan 1200 x 800 px = 30 x 20 m
  const m = v => v * pxPerM;
  const walls = [];
  let id = 0;
  const wall = (x1, y1, x2, y2, mat) => walls.push({ id: "s" + id++, x1: m(x1), y1: m(y1), x2: m(x2), y2: m(y2), mat });

  // outer shell
  wall(0.5, 0.5, 29.5, 0.5, "concrete");
  wall(29.5, 0.5, 29.5, 19.5, "concrete");
  wall(29.5, 19.5, 0.5, 19.5, "concrete");
  wall(0.5, 19.5, 0.5, 0.5, "concrete");

  const roomW = 29 / 7;
  const corrTop = 9, corrBot = 11;
  for (let i = 0; i < 7; i++) {
    const x0 = 0.5 + i * roomW, x1 = x0 + roomW;
    // party walls between rooms
    if (i > 0) {
      wall(x0, 0.5, x0, corrTop, "brick");
      wall(x0, corrBot, x0, 19.5, "brick");
    }
    // corridor walls with a 0.9 m wooden door near the right side of each room
    const d0 = x1 - 1.4, d1 = d0 + 0.9;
    for (const y of [corrTop, corrBot]) {
      wall(x0, y, d0, y, "aac");
      wall(d0, y, d1, y, "wood");
      wall(d1, y, x1, y, "aac");
    }
    // bathroom at the back of each room (behind the door side)
    wall(x1 - 1.8, 0.5, x1 - 1.8, 2.6, "aac");
    wall(x1 - 1.8, 2.6, x1, 2.6, "aac");
    wall(x1 - 1.8, 19.5, x1 - 1.8, 17.4, "aac");
    wall(x1 - 1.8, 17.4, x1, 17.4, "aac");
  }
  // glass window at the corridor ends
  wall(0.5, corrTop, 0.5, corrBot, "glass");
  wall(29.5, corrTop, 29.5, corrBot, "glass");

  return {
    version: 1,
    plan: { image: null, width: 1200, height: 800 },
    mPerPx: 1 / pxPerM,
    scaleSet: true,
    walls,
    aps: [
      { id: "ap1", name: "AP-1", x: m(8), y: m(10), model: "generic-ax", tx24: 20, tx5: 23, gain24: 3, gain5: 4, ch24: 1, ch5: 36, mount: "ceiling", h: 2.7 },
      { id: "ap2", name: "AP-2", x: m(22), y: m(10), model: "generic-ax", tx24: 20, tx5: 23, gain24: 3, gain5: 4, ch24: 11, ch5: 149, mount: "ceiling", h: 2.7 },
    ],
    settings: { band: "5", env: 2, opacity: 0.55, minDbm: "auto", req: "auto", capNbtc: true },
    newWallMat: "brick",
  };
}
