import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as k from "../../../.agents/skills/anatomy/kit/iso-kit.mjs";
import * as G from "../../../.agents/skills/anatomy/kit/lathe.mjs";
import { kitScript } from "../../../.agents/skills/anatomy/scripts/inline-kit.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const theme = process.argv.includes("--light") ? "light" : "dark";

const WIDTH = 600;
const HEIGHT = 430;

/* ---------------------------------------------------------------- layout */
const PLATE = { x: -110, y: -64, w: 224, d: 140, r: 9 };
const PLATE_H = 12;
const FOOT_H = 5;

const CONSOLE = { x: -102, y: -50, w: 98, d: 80, r: 6 };
const FRONT = CONSOLE.y + CONSOLE.d; // 30
const SIDE = CONSOLE.x + CONSOLE.w; // -4
const PLINTH = {
  x: CONSOLE.x - 2.5,
  y: CONSOLE.y - 2.5,
  w: CONSOLE.w + 5,
  d: CONSOLE.d + 5,
  r: 7,
};
const CON_TOP = 70;
const CAP = {
  x: CONSOLE.x - 1.6,
  y: CONSOLE.y - 1.6,
  w: CONSOLE.w + 3.2,
  d: CONSOLE.d + 3.2,
  r: 6.5,
};
const CAP_TOP = CON_TOP + 5; // 75

const SCOPE_BZL = { x0: -95, x1: -19, z0: 39, z1: 63, r: 4, depth: 1.6 };
const SCOPE = { x0: -90, x1: -24, z0: 43, z1: 59, r: 3, depth: 5 };
const FLAG_BZL = { x0: -90, x1: -54, z0: 24, z1: 34, r: 2.4, depth: 1.4 };
const FLAG = { x0: -87, x1: -57, z0: 26.5, z1: 31.5, r: 1.8, depth: 4 };

const GALVO = { x: -66, y: -16, r: 15, z: CAP_TOP, h: 8 };
const GALVO_TOP = GALVO.z + GALVO.h;
const SEL = { x: -26, y: -16, r: 12, z: CAP_TOP, h: 2.2 };
const KNOB = { r: 7.4, z: SEL.z + SEL.h, h: 6 };
const DETENTS = [45, 135, 225, 315].map((a) => (a * Math.PI) / 180);

const DOME = { x: 58, y: 8, r: 34, z: 0, h: 8.5 };
const GLASS_R = 30.5;
const GLASS_Z = DOME.z + DOME.h;
const DOME_PROFILE = [
  [0, GLASS_R],
  [21, GLASS_R],
  [23, GLASS_R - 0.8, 1],
  [26.5, GLASS_R - 4, 1],
  [29.5, GLASS_R - 9.5, 1],
  [32, GLASS_R - 16, 1],
  [33.7, GLASS_R - 22, 1],
  [34.6, GLASS_R - 26.5, 1],
  [34.9, GLASS_R - 29.4, 1],
];
const GLASS_TOP = GLASS_Z + 35;
const FGLASS = G.frameAlong([DOME.x, DOME.y, GLASS_Z], [0, 0, 1]);

const CORK = { x: DOME.x, y: DOME.y, r: 4.6, z: GLASS_Z, h: 2.6 };
const PIN_TOP = 28;
const FLY = {
  hx: 49.5,
  hy: DOME.y,
  hz: 30.4,
  tx: 55,
  tz: 30.8,
  ax: 66.5,
  az: 29.6,
};

const GEARBOX = { x: SIDE, y: 15, w: 9.5, d: 9.5, r: 1.5 };
const GB_H = 11.5;
const XFER = { x: 14.5, y: 15.5, w: 8, d: 8.4, r: 1.5 };
const XFER_H = 11.5;
const PA = { x: 1, y: 20, r: 5, z: GB_H, h: 3.2 };
const PB = { x: 18.5, y: 20, r: 5, z: XFER_H, h: 3.2 };
const BELT_Z = 13.3;
const BELT_RO = 5.15;
const BELT_RI = 3.9;

const STRIP = { x: -100, y: 62, w: 170, d: 7, r: 1 };
const T_FROM = STRIP.x + 6;
const T_TO = STRIP.x + STRIP.w - 6;
const LOOP_S = 4;

const P = k.fitProjection(
  [
    ...k.boxCorners(PLATE, -PLATE_H - FOOT_H, 0),
    [CAP.x, CAP.y, CAP_TOP + 12],
    [DOME.x, DOME.y, GLASS_TOP + 4],
  ],
  WIDTH,
  HEIGHT,
  { pad: 26, azimuth: 52 },
);

const at = (point) => k.iso(point, P);
const S = (paths, style) => k.solidSvg(paths, style);
const L = (d, style) => k.lineSvg(d, style);
const D = (points, style) => k.dotsSvg(points, style);
const byDepth = (points) =>
  [...points].sort(
    (a, b) => k.depthOf([a[0], a[1], 0], P) - k.depthOf([b[0], b[1], 0], P),
  );
const planeOf = (y) => k.sideMatrix([0, y], 0, P, "left");
const flat = (x0, z0, x1, z1, r, steps = 6) =>
  k.pathOf(
    k
      .roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, steps)
      .map(([u, z]) => [u, -z]),
    true,
  );

function stadiumPath(cxA, cxB, cy, r, z) {
  const pts = [];
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI / 2 + (i / 12) * Math.PI;
    pts.push([cxA + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  for (let i = 0; i <= 12; i++) {
    const a = -Math.PI / 2 + (i / 12) * Math.PI;
    pts.push([cxB + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return k.onTop(pts, z, P, true);
}

/* ------------------------------------------------------------- plate ----- */
function plate() {
  const out = [
    `<path class="iso-halo" d="${k.haloOf(PLATE, -PLATE_H - FOOT_H, PLATE_H, P)}"/>`,
  ];
  for (const [x, y] of byDepth(k.corners(PLATE, 22))) {
    out.push(
      S(k.cylinder(x, y, 7, -PLATE_H - FOOT_H, 1.6, P, 28), { tone: "lo" }),
    );
    out.push(
      S(k.cylinder(x, y, 5.4, -PLATE_H - FOOT_H + 1.6, FOOT_H - 1.6, P, 28), {
        tone: "mid",
      }),
    );
  }
  out.push(S(k.slabOf(PLATE, -PLATE_H, PLATE_H, P, 8, 1.6), { tone: "mid" }));
  out.push(L(k.planOutline(k.insetPlan(PLATE, 5), 0, P), { tone: "lo" }));
  const screws = k.corners(PLATE, 10);
  out.push(
    L(screws.map(([x, y]) => k.ring(x, y, 2.2, 0, P, 16)).join(""), {
      tone: "lo",
    }),
  );
  out.push(
    D(
      screws.map(([x, y]) => at([x, y, 0])),
      { size: 0.5 },
    ),
  );
  const label = { x: -104, y: 44, w: 30, d: 9, r: 1.2 };
  out.push(S(k.slabOf(label, 0, 0.8, P, 3), { tone: "lo", crease: "none" }));
  out.push(
    L(
      [20, 13]
        .map((w, i) =>
          k.lineOnTop(
            [label.x + 4, label.y + 2.8 + i * 3],
            [label.x + 4 + w, label.y + 2.8 + i * 3],
            0.8,
            P,
          ),
        )
        .join(""),
      { tone: "lo", free: true },
    ),
  );
  out.push(
    D([at([label.x + label.w - 3, label.y + label.d / 2, 0.8])], {
      size: 0.45,
    }),
  );
  return out.join("");
}

function strip() {
  const out = [];
  out.push(S(k.slabOf(STRIP, 0, 0.6, P, 3), { tone: "lo", crease: "none" }));
  const ticks = k.topTicks(
    T_FROM,
    T_TO,
    5,
    4,
    STRIP.y + 0.8,
    0.6,
    [1.8, 3.4],
    P,
  );
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(
    D(
      [
        at([STRIP.x + 2, STRIP.y + 3.5, 0.6]),
        at([STRIP.x + STRIP.w - 2, STRIP.y + 3.5, 0.6]),
      ],
      { size: 0.45 },
    ),
  );
  out.push(
    `<g data-part="cursor" transform="${k.translateAlong(P, [T_FROM, 0, 0])}">${S(k.slabOf({ x: -2.2, y: STRIP.y + 0.4, w: 4.4, d: 6.2, r: 1 }, 0.6, 2.2, P, 3, 0.4), { tone: "hi" })}${L(
      k.lineOnTop([0, STRIP.y - 0.2], [0, STRIP.y + 0.4], 1.2, P),
      { tone: "hi" },
    )}${D([at([0, STRIP.y + STRIP.d - 1.4, 2.8])], { size: 0.55, tone: "hi" })}</g>`,
  );
  return out.join("");
}

/* ----------------------------------------------------------- recess ------ */
let clips = 0;
function recess(
  { x0, x1, z0, z1, r, depth },
  y,
  back = "",
  backClass = "fb-well",
  inside = "",
) {
  const id = `fb-clip-${clips++}`;
  const ring = k.roundedPlan({ x: x0, y: z0, w: x1 - x0, d: z1 - z0, r }, 6);
  const cx = (x0 + x1) / 2;
  const cz = (z0 + z1) / 2;
  const { sinA } = k.cameraOf(P);
  const tops = [];
  const sides = [[], [], [], []];
  ring.forEach(([ax, az], index) => {
    const [bx, bz] = ring[(index + 1) % ring.length];
    const length = Math.hypot(bx - ax, bz - az) || 1;
    let [nx, nz] = [(bz - az) / length, -(bx - ax) / length];
    if (nx * (cx - (ax + bx) / 2) + nz * (cz - (az + bz) / 2) < 0)
      [nx, nz] = [-nx, -nz];
    const quad = k.pathOf(
      [
        at([ax, y, az]),
        at([bx, y, bz]),
        at([bx, y - depth, bz]),
        at([ax, y - depth, az]),
      ],
      true,
    );
    if (nz >= nx) tops.push(quad);
    else
      sides[
        Math.min(3, Math.max(0, Math.floor(((nx * -sinA + 1) / 2) * 4)))
      ].push(quad);
  });
  const shape = flat(x0, z0, x1, z1, r);
  return [
    `<clipPath id="${id}"><path transform="${planeOf(y)}" d="${shape}"/></clipPath>`,
    `<g clip-path="url(#${id})">`,
    `<path class="iso-top" d="${tops.join("")}"/>`,
    ...sides.map((d, shade) =>
      d.length
        ? `<path class="iso-shade" data-shade="${shade}" d="${d.join("")}"/>`
        : "",
    ),
    `<g transform="${planeOf(y - depth)}"><path class="${backClass}" d="${shape}"/>${back}<path class="iso-line" data-tone="faint" d="${shape}"/></g>`,
    inside,
    `</g>`,
    `<g transform="${planeOf(y)}"><path class="iso-line" data-tone="lo" d="${shape}"/></g>`,
  ].join("");
}

/* ---------------------------------------------------------- console ------ */
const LANES = [46, 49.8, 53.6, 57.4].map((z) => -z);
const CHANS = ["LO", "CX", "MB", "GNG"];

function consoleBody() {
  const out = [`<path class="iso-halo" d="${k.haloOf(PLINTH, 0, 4, P)}"/>`];
  out.push(S(k.slabOf(PLINTH, 0, 4.6, P, 8, 0.8), { tone: "lo" }));
  out.push(
    S(k.slabOf(CONSOLE, 4.6, CON_TOP - 4.6, P, 8, 1.4), { tone: "mid" }),
  );
  out.push(
    `<g transform="${planeOf(FRONT)}"><path class="iso-line" data-tone="faint" d="${flat(CONSOLE.x + 4, 8, SIDE - 4, CON_TOP - 4, 4)}"/></g>`,
  );
  const rivets = [
    [CONSOLE.x + 7, FRONT, 12],
    [SIDE - 7, FRONT, 12],
    [CONSOLE.x + 7, FRONT, CON_TOP - 7],
    [SIDE - 7, FRONT, CON_TOP - 7],
  ];
  out.push(D(rivets.map(at), { size: 0.5 }));
  out.push(L(k.sideSeam(CAP, CON_TOP + 0.7, P, 6), { tone: "faint" }));
  out.push(
    S(k.slabOf(CAP, CON_TOP, CAP_TOP - CON_TOP, P, 8, 0.9), { tone: "mid" }),
  );

  const mk = { x0: -90, x1: -62, z0: 13, z1: 19 };
  out.push(
    `<g transform="${planeOf(FRONT)}"><path class="iso-line" data-tone="lo" d="${flat(mk.x0, mk.z0, mk.x1, mk.z1, 1)}"/></g>`,
  );
  out.push(
    `<g transform="${planeOf(FRONT)}">${L([18, 11].map((w, i) => `M${mk.x0 + 4} ${-(mk.z0 + 3 + i * 3.4)}h${w}`).join(""), { tone: "mid", free: true })}</g>`,
  );
  out.push(
    D(
      [
        at([mk.x1 - 3, FRONT, (mk.z0 + mk.z1) / 2]),
        at([mk.x0 + 2.4, FRONT, (mk.z0 + mk.z1) / 2]),
      ],
      { size: 0.45 },
    ),
  );

  const slots = [];
  for (let i = 0; i < 5; i++)
    slots.push(flat(-44 + i * 5.2, 24.5, -41.6 + i * 5.2, 33.5, 1.2, 4));
  out.push(
    `<g transform="${planeOf(FRONT)}"><path class="iso-line" data-tone="lo" d="${slots.join("")}"/></g>`,
  );
  /* riveted service hatch on the gearbox-side wall (x = SIDE plane) */
  const hatch = { y0: 1, y1: 25, z0: 40, z1: 56 };
  out.push(
    L(
      k.pathOf(
        k
          .roundedPlan(
            { x: hatch.y0, y: hatch.z0, w: hatch.y1 - hatch.y0, d: hatch.z1 - hatch.z0, r: 2.4 },
            6,
          )
          .map(([u, z]) => at([SIDE, u, z])),
        true,
      ),
      { tone: "lo" },
    ),
  );
  out.push(
    D(
      [
        [hatch.y0 + 3, hatch.z0 + 3],
        [hatch.y1 - 3, hatch.z0 + 3],
        [hatch.y0 + 3, hatch.z1 - 3],
        [hatch.y1 - 3, hatch.z1 - 3],
      ].map(([y, z]) => at([SIDE, y, z])),
      { size: 0.45 },
    ),
  );
  out.push(
    L(
      k.pathOf([
        at([SIDE, hatch.y0 + 6, hatch.z0 + 4.5]),
        at([SIDE, hatch.y1 - 6, hatch.z0 + 4.5]),
      ]),
      { tone: "faint", free: true },
    ),
  );
  out.push(
    L(
      k.pathOf([
        at([SIDE, hatch.y0 + 6, hatch.z0 + 7.5]),
        at([SIDE, hatch.y1 - 12, hatch.z0 + 7.5]),
      ]),
      { tone: "faint", free: true },
    ),
  );
  return out.join("");
}

function scopeWindow() {
  const grat = [46, 49.8, 53.6, 57.4]
    .map((z) => `M${SCOPE.x0 + 1.5} ${-z}H${SCOPE.x1 - 1.5}`)
    .join("");
  const mid = `M${(SCOPE.x0 + SCOPE.x1) / 2} ${-SCOPE.z0 - 0.8}V${-SCOPE.z1 + 0.8}`;
  const chans = LANES.map(
    (v, i) =>
      `<circle class="fb-chan" data-chan="${i}" cx="${SCOPE.x0 + 3}" cy="${v}" r="0.9"/>`,
  ).join("");
  const traces = LANES.map(
    (v, i) =>
      `<path class="fb-trace" data-trace="${i}" d="M${SCOPE.x0 + 5} ${v}H${SCOPE.x1 - 3}"/><circle class="fb-pen" data-pen="${i}" cx="${SCOPE.x1 - 3}" cy="${v}" r="1.1"/>`,
  ).join("");
  const back = `<path class="fb-grat" d="${grat}${mid}"/>${chans}${traces}`;
  const inside = `<g transform="${planeOf(FRONT - SCOPE_BZL.depth)}"><path class="fb-glassline" d="${flat(SCOPE.x0, SCOPE.z0, SCOPE.x1, SCOPE.z1, SCOPE.r)}"/></g>`;
  return recess(
    SCOPE_BZL,
    FRONT,
    "",
    "fb-bezel",
    recess(SCOPE, FRONT - SCOPE_BZL.depth, back, "fb-glass", inside),
  );
}

const FLAG_MID = -(FLAG.z0 + FLAG.z1) / 2;
const WORD0 = -(FLAG.z0 - 0.6);
const WORD_STEP = 9.3;
const SRC_WORDS = ["SIMULATED", "KEYFRAMED", "REFERENCE"];

function flagWindow() {
  const drum = SRC_WORDS.map(
    (w, i) =>
      `<text class="fb-word" x="${(FLAG.x0 + FLAG.x1) / 2}" y="${WORD0 - i * WORD_STEP}" text-anchor="middle">${w}</text>`,
  ).join("");
  const firstTy = FLAG_MID - WORD0 + WORD_STEP * 2;
  const back = `<g class="fb-drumwrap"><g data-part="drum" style="transform:translateY(${firstTy.toFixed(1)}px)">${drum}</g></g>`;
  const inside = `<g transform="${planeOf(FRONT - FLAG_BZL.depth)}"><path class="fb-glassline" d="${flat(FLAG.x0, FLAG.z0, FLAG.x1, FLAG.z1, FLAG.r)}"/></g>`;
  return recess(
    FLAG_BZL,
    FRONT,
    "",
    "fb-bezel",
    recess(FLAG, FRONT - FLAG_BZL.depth, back, "fb-glass", inside),
  );
}

function galvo() {
  const out = [];
  const { x, y, r } = GALVO;
  out.push(
    S(k.cylinder(x, y, r, GALVO.z, GALVO.h, P, 64, 0.8), { tone: "mid" }),
  );
  out.push(
    L(k.knurl(x, y, r, GALVO_TOP - 3.4, GALVO_TOP, 84, P, 0.3), { tone: "lo" }),
  );
  out.push(L(k.sideArc(x, y, r, GALVO_TOP - 3.4, P, 40), { tone: "faint" }));
  out.push(L(k.ring(x, y, r - 2.2, GALVO_TOP, P, 64), { tone: "lo" }));
  const ticks = k.radialTicks(
    x,
    y,
    r - 3,
    12,
    4,
    GALVO_TOP,
    [1.3, 2.6],
    P,
    (30 * Math.PI) / 180,
    (120 * Math.PI) / 180,
  );
  out.push(L(ticks.minor, { tone: "lo" }), L(ticks.major, { tone: "mid" }));
  out.push(L(k.ring(x, y, 1.7, GALVO_TOP, P, 16), { tone: "mid" }));
  out.push(
    S(
      k.slabOf(
        { x: x - 2.5, y: y - r - 0.5, w: 5, d: 3, r: 1 },
        GALVO.z + 1.5,
        4.5,
        P,
        3,
      ),
      { tone: "mid" },
    ),
  );
  out.push(
    S(k.cylinder(x, y - r - 2.5, 1.8, GALVO.z + 2, 3.5, P, 16), {
      tone: "mid",
    }),
  );
  out.push(
    k.faceTextSvg(k.topMatrix([x, y + 8.6], GALVO_TOP, P, "x"), "nA", {
      size: 2.2,
      tone: "lo",
      anchor: "middle",
    }),
  );
  return out.join("");
}

const needleAt = (a) => {
  const { x, y, r } = GALVO;
  return k.lineOnTop(
    [x - Math.sin(a) * 1.7, y + Math.cos(a) * 1.7],
    [x + Math.sin(a) * (r - 2.2), y - Math.cos(a) * (r - 2.2)],
    GALVO_TOP + 0.15,
    P,
  );
};

function selector() {
  const out = [];
  const { x, y, r } = SEL;
  out.push(S(k.cylinder(x, y, r, SEL.z, SEL.h, P, 48, 0.5), { tone: "mid" }));
  out.push(L(k.ring(x, y, r - 1.6, SEL.z + SEL.h, P, 48), { tone: "faint" }));
  const det = DETENTS.map((a) =>
    at([
      x + Math.cos(a) * (r - 3.4),
      y + Math.sin(a) * (r - 3.4),
      SEL.z + SEL.h,
    ]),
  );
  out.push(D(det, { size: 0.6, tone: "mid" }));
  const marks = DETENTS.map((a) =>
    k.lineOnTop(
      [x + Math.cos(a) * (r - 0.4), y + Math.sin(a) * (r - 0.4)],
      [x + Math.cos(a) * (r + 1.6), y + Math.sin(a) * (r + 1.6)],
      SEL.z + SEL.h,
      P,
    ),
  ).join("");
  out.push(L(marks, { tone: "lo" }));
  out.push(
    S(k.cylinder(x, y, KNOB.r, KNOB.z, KNOB.h, P, 40, 0.5), {
      tone: "hi",
      crease: "lo",
    }),
  );
  out.push(
    L(k.knurl(x, y, KNOB.r, KNOB.z + 1, KNOB.z + KNOB.h - 0.6, 44, P), {
      tone: "lo",
    }),
  );
  out.push(
    L(k.ring(x, y, KNOB.r - 2.2, KNOB.z + KNOB.h, P, 36), { tone: "lo" }),
  );
  out.push(D([at([x, y, KNOB.z + KNOB.h])], { size: 1.05, tone: "hi" }));
  const c = at([x, y, SEL.z + SEL.h]);
  out.push(
    `<circle cx="${c[0]}" cy="${c[1]}" r="${(r + 3) * k.cameraOf(P).k}" fill="#000" fill-opacity="0" style="pointer-events:all;cursor:pointer"/>`,
  );
  return `<g data-part="dial-zone">${out.join("")}</g>`;
}

const pointerAt = (a) => {
  const { x, y } = SEL;
  return k.lineOnTop(
    [x - Math.cos(a) * 0.7, y - Math.sin(a) * 0.7],
    [x + Math.cos(a) * (SEL.r - 1.6), y + Math.sin(a) * (SEL.r - 1.6)],
    KNOB.z + KNOB.h + 0.12,
    P,
  );
};

function postsAndWire() {
  const out = [];
  for (const [x, y] of [
    [-94, -34],
    [-87, -38],
  ]) {
    out.push(S(k.cylinder(x, y, 2.4, CAP_TOP, 1.4, P, 20), { tone: "mid" }));
    out.push(
      S(k.cylinder(x, y, 1.3, CAP_TOP + 1.4, 3.6, P, 16), { tone: "mid" }),
    );
    out.push(D([at([x, y, CAP_TOP + 5])], { size: 0.5, tone: "hi" }));
  }
  const p1 = at([-94, -34, CAP_TOP + 4.4]);
  const p2 = at([-87, -38, CAP_TOP + 4.4]);
  const lug = at([GALVO.x, GALVO.y - GALVO.r - 2.5, GALVO.z + 5.5]);
  out.push(
    k.wireSvg(p1, p2, {
      via: [at([-90, -38, CAP_TOP + 6.8])],
      tone: "lo",
      size: 0.9,
    }),
  );
  out.push(
    k.wireSvg(p2, lug, {
      via: [
        at([-80, -34, CAP_TOP + 7.6]),
        at([GALVO.x - 4, GALVO.y - GALVO.r - 4, GALVO.z + 8]),
      ],
      tone: "lo",
      size: 0.9,
      ends: "to",
    }),
  );
  return out.join("");
}

function gearbox() {
  const out = [];
  out.push(S(k.slabOf(GEARBOX, 0, GB_H, P, 4, 0.6), { tone: "mid" }));
  out.push(
    L(k.planOutline(k.insetPlan(GEARBOX, 1.6), GB_H, P, 3), { tone: "faint" }),
  );
  out.push(
    D(
      [
        [GEARBOX.x + 2, GEARBOX.y + 2],
        [GEARBOX.x + GEARBOX.w - 2, GEARBOX.y + 2],
        [GEARBOX.x + 2, GEARBOX.y + GEARBOX.d - 2],
      ].map(([x, y]) => at([x, y, GB_H])),
      { size: 0.45 },
    ),
  );
  out.push(
    S(k.cylinder(PA.x, PA.y, 1.1, GB_H, PA.z - GB_H + 0.4, P, 16), {
      tone: "mid",
    }),
  );
  return out.join("");
}

function transfer() {
  const out = [];
  out.push(S(k.slabOf(XFER, 0, XFER_H, P, 4, 0.6), { tone: "mid" }));
  out.push(
    L(k.planOutline(k.insetPlan(XFER, 1.6), XFER_H, P, 3), { tone: "faint" }),
  );
  out.push(
    D(
      [
        [XFER.x + 2, XFER.y + 2],
        [XFER.x + XFER.w - 2, XFER.y + XFER.d - 2],
        [XFER.x + 2, XFER.y + XFER.d - 2],
      ].map(([x, y]) => at([x, y, XFER_H])),
      { size: 0.45 },
    ),
  );
  out.push(
    S(k.cylinder(PB.x, PB.y, 1.1, XFER_H, PB.z - XFER_H + 0.4, P, 16), {
      tone: "mid",
    }),
  );
  return out.join("");
}

function pulley(c) {
  const out = [];
  out.push(S(k.cylinder(c.x, c.y, c.r, c.z, c.h, P, 48, 0.5), { tone: "mid" }));
  out.push(L(k.ring(c.x, c.y, c.r - 1.1, c.z + c.h, P, 48), { tone: "faint" }));
  out.push(
    L(k.ring(c.x, c.y, c.r - 2.3, c.z + c.h, P, 40), {
      tone: "lo",
      flow: true,
      className: "fb-flow",
    }),
  );
  out.push(D([at([c.x, c.y, c.z + c.h])], { size: 0.8, tone: "mid" }));
  return out.join("");
}

function belt() {
  const outer = stadiumPath(PA.x, PB.x, PA.y, BELT_RO, BELT_Z);
  const inner = stadiumPath(PA.x, PB.x, PA.y, BELT_RI, BELT_Z);
  const mid = stadiumPath(PA.x, PB.x, PA.y, (BELT_RO + BELT_RI) / 2, BELT_Z);
  const out = [
    `<path class="iso-fill" fill-rule="evenodd" d="${outer}${inner}"/>`,
    L(outer, { tone: "lo" }),
    L(inner, { tone: "faint" }),
    `<path class="iso-line fb-flow" data-tone="mid" data-flow d="${mid}"/>`,
  ];
  return `<g data-part="belt">${out.join("")}</g>`;
}

/* ------------------------------------------------------------- dome ------ */
function domeBase() {
  const out = [
    `<path class="iso-halo" d="${k.haloOf({ x: DOME.x - 36, y: DOME.y - 36, w: 72, d: 72, r: 10 }, 0, 3, P)}"/>`,
  ];
  out.push(
    S(k.cylinder(DOME.x, DOME.y, DOME.r + 2.5, 0, 2.4, P, 72, 0.6), {
      tone: "lo",
    }),
  );
  out.push(
    S(k.cylinder(DOME.x, DOME.y, DOME.r, 2.4, DOME.h - 2.4, P, 72, 0.6), {
      tone: "mid",
    }),
  );
  out.push(L(k.sideArc(DOME.x, DOME.y, DOME.r, 4.6, P, 64), { tone: "faint" }));
  out.push(
    L(k.ring(DOME.x, DOME.y, GLASS_R + 1.6, DOME.h, P, 72), { tone: "lo" }),
  );
  out.push(
    L(k.ring(DOME.x, DOME.y, GLASS_R - 1.2, DOME.h, P, 72), { tone: "faint" }),
  );
  const bolts = [20, 80, 140, 200, 260, 320].map((a) => (a * Math.PI) / 180);
  out.push(
    D(
      bolts.map((a) =>
        at([
          DOME.x + (DOME.r + 1.2) * Math.cos(a),
          DOME.y + (DOME.r + 1.2) * Math.sin(a),
          2.4,
        ]),
      ),
      { size: 0.5 },
    ),
  );
  const label = {
    x: DOME.x - 8,
    y: DOME.y + DOME.r + 5.5,
    w: 16,
    d: 6.5,
    r: 1,
  };
  out.push(S(k.slabOf(label, 0, 0.7, P, 3), { tone: "lo", crease: "none" }));
  out.push(
    L(
      k.lineOnTop(
        [label.x + 2.5, label.y + 3.4],
        [label.x + 11, label.y + 3.4],
        0.7,
        P,
      ),
      { tone: "lo", free: true },
    ),
  );
  return out.join("");
}

function pedestal() {
  const out = [];
  out.push(
    S(k.cylinder(CORK.x, CORK.y, CORK.r, CORK.z, CORK.h, P, 40, 0.3), {
      tone: "lo",
    }),
  );
  out.push(
    L(k.ring(CORK.x, CORK.y, CORK.r - 1, CORK.z + CORK.h, P, 40), {
      tone: "faint",
    }),
  );
  out.push(
    S(
      k.cylinder(
        CORK.x,
        CORK.y,
        0.65,
        CORK.z + CORK.h,
        PIN_TOP - CORK.z - CORK.h,
        P,
        12,
      ),
      { tone: "mid", crease: "none" },
    ),
  );
  return out.join("");
}

function flyBody() {
  const out = [];
  const F_A = G.frameAlong([FLY.ax, FLY.hy, FLY.az], [-1, 0, 0]);
  const abdomen = G.solidOf(
    [
      [0.4, 1.1, 1],
      [2, 2.7, 1],
      [4, 3.4, 1],
      [7, 3.3, 1],
      [9.4, 2.6, 1],
      [10.7, 1.9],
    ],
    F_A,
    P,
  );
  const stripes = [
    G.arcOf(F_A, 3.2, 3.05, P, { slope: 0.22, least: 0.06 }),
    G.arcOf(F_A, 5.8, 3.5, P, { slope: 0.02, least: 0.06 }),
    G.arcOf(F_A, 8.3, 3.05, P, { slope: -0.24, least: 0.06 }),
  ].join("");
  out.push(
    S(abdomen, {
      tone: "hi",
      crease: "none",
      inner: L(stripes, { tone: "lo" }),
    }),
  );
  out.push(S(G.sphereOf([FLY.tx, FLY.hy, FLY.tz], 4.1, P), { tone: "hi" }));
  out.push(S(G.sphereOf([FLY.hx, FLY.hy, FLY.hz], 2.75, P), { tone: "hi" }));
  out.push(
    S(G.sphereOf([FLY.hx - 1.35, FLY.hy - 1.95, FLY.hz + 0.55], 1.08, P), {
      tone: "mid",
    }),
  );
  out.push(
    S(G.sphereOf([FLY.hx - 1.35, FLY.hy + 1.95, FLY.hz + 0.55], 1.08, P), {
      tone: "mid",
    }),
  );
  const ant = [
    k.pathOf([
      at([47.8, FLY.hy - 1.4, 29.6]),
      at([45.6, FLY.hy - 2.6, 28.2]),
      at([44.8, FLY.hy - 3.1, 27.2]),
    ]),
    k.pathOf([
      at([47.8, FLY.hy + 1.4, 29.6]),
      at([45.6, FLY.hy + 2.6, 28.2]),
      at([44.8, FLY.hy + 3.1, 27.2]),
    ]),
  ].join("");
  out.push(L(ant, { tone: "hi" }));
  out.push(
    D([at([44.8, FLY.hy - 3.1, 27.2]), at([44.8, FLY.hy + 3.1, 27.2])], {
      size: 0.55,
      tone: "hi",
    }),
  );
  return out.join("");
}

function glassDome() {
  const paths = G.lathe(DOME_PROFILE, FGLASS, P, { steps: 96 });
  const out = [
    `<path class="fb-glassfill" d="${paths.fill}"/>`,
    `<path class="iso-line" data-tone="lo" d="${paths.outline}"/>`,
  ];
  const V = G.viewOf(P);
  const a = G.angleToward(FGLASS, V) - 0.62;
  const streak = (from, to, opacity) => {
    const pts = [];
    for (let s = from; s <= to; s += 1.4) {
      let r = GLASS_R;
      for (let i = 0; i < DOME_PROFILE.length - 1; i++) {
        const [s0, r0] = DOME_PROFILE[i];
        const [s1, r1] = DOME_PROFILE[i + 1];
        if (s >= s0 && s <= s1) {
          const t = (s - s0) / (s1 - s0 || 1);
          r = r0 + (r1 - r0) * t;
        }
      }
      pts.push(G.pointOf(FGLASS, s, r + 0.15, a));
    }
    return `<path class="iso-line" data-tone="hi" d="${k.pathOf(pts.map((p) => at(p)))}" style="opacity:${opacity}" data-free="both"/>`;
  };
  out.push(streak(23.5, 34.5, 0.3));
  out.push(streak(23.5, 33.5, 0.12));
  out.push(
    S(k.cylinder(DOME.x, DOME.y, 2.6, GLASS_TOP - 0.8, 1.4, P, 28), {
      tone: "mid",
    }),
  );
  out.push(
    S(G.sphereOf([DOME.x, DOME.y, GLASS_TOP + 1.4], 2.4, P), { tone: "mid" }),
  );
  return `<g data-part="glass">${out.join("")}</g>`;
}

/* ------------------------------------------------------------ moving ----- */
const legEls = (list) =>
  list
    .map(
      (i) =>
        `<path class="iso-line" data-tone="hi" data-leg="${i}" d="" style="stroke-width:.9"/><circle class="fb-foot" data-foot="${i}" r="0.7"/>`,
    )
    .join("");
const wingEls = (i) =>
  `<path class="fb-wing" data-wing="${i}" d=""/><path class="iso-line" data-tone="mid" data-wedge="${i}" d=""/>`;

const svg = k.figureSvg({
  width: WIDTH,
  height: HEIGHT,
  label:
    "A brass museum demonstration engine. On the left a console carries a recorder window where four pens write neuropil activity, a provenance drum that shows the words SIMULATED, KEYFRAMED or REFERENCE, a galvanometer and a four-position selector dial. On the right a glass dome holds an automaton fruit fly on a pin. A flat belt drive joins a gearbox on the console to a transfer box at the dome base, so one mechanism animates the fly and the traces on the same timeline.",
  body: [
    plate(),
    consoleBody(),
    scopeWindow(),
    flagWindow(),
    galvo(),
    selector(),
    `<path data-part="pointer" class="iso-line" data-tone="hi" d="${pointerAt(DETENTS[0])}" style="stroke-width:1"/>`,
    `<path data-part="needle" class="iso-line" data-tone="hi" d="${needleAt(0)}" style="stroke-width:1"/>`,
    postsAndWire(),
    gearbox(),
    transfer(),
    belt(),
    pulley(PA),
    pulley(PB),
    domeBase(),
    pedestal(),
    `<g data-part="fly">${legEls([0, 1, 2])}${wingEls(0)}${flyBody()}${wingEls(1)}${legEls([3, 4, 5])}<path class="iso-line" data-tone="hi" data-part="proboscis" d="" style="stroke-width:.8"/><circle class="fb-foot" data-part="probtip" r="0.65"/></g>`,
    glassDome(),
    strip(),
  ],
});

/* ---------------------------------------------------------------- model -- */
const MODEL = `
const LOOP = ${LOOP_S};
const B = [
  { name: "walking",  src: 2, gain: [0.75, 0.95, 0.3, 0.7] },
  { name: "grooming", src: 1, gain: [0.35, 0.5, 0.3, 0.95] },
  { name: "feeding",  src: 0, gain: [0.3, 0.35, 0.85, 0.8] },
  { name: "escape",   src: 0, gain: [1, 0.75, 0.45, 0.9] },
];
const FREQ = [0.9, 1.35, 0.7, 1.7];
const PHASE = [0, 1.7, 3.1, 0.8];
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function envelope(b, ph, i) {
  const u = ph / LOOP;
  if (b === 0) return 0.7 + 0.3 * Math.sin(u * 6.283 + i * 1.3);
  if (b === 1) return sstep(0.05, 0.18, u) * (1 - sstep(0.36, 0.48, u)) + 0.65 * sstep(0.55, 0.68, u) * (1 - sstep(0.86, 0.97, u)) + 0.12;
  if (b === 2) return 0.25 + 0.75 * sstep(0.06, 0.3, u) * (1 - sstep(0.8, 0.98, u) * 0.5);
  return 1.1 * Math.exp(-u * 3.2) + 0.55 * sstep(0.6, 0.8, u) + 0.12;
}
function hash(n) { const s = Math.sin(n * 127.1 + 311.7) * 43758.545; return s - Math.floor(s); }
function value(b, t, i) {
  const ph = ((t % LOOP) + LOOP) % LOOP;
  const wave = 0.5 + 0.5 * Math.sin(6.283 * FREQ[i] * t + PHASE[i]);
  const cell = Math.floor(t * 7 + i * 13);
  const spike = hash(cell) > 0.78 ? 0.9 * (1 - (t * 7 + i * 13 - cell)) : 0;
  const e = envelope(b, ph, i) * B[b].gain[i];
  return Math.min(1, (0.14 + 0.86 * e) * (0.45 + 0.55 * wave) + spike * e);
}
`;

const live = `
const P = ${JSON.stringify(P)};
${MODEL}
const SCOPE = ${JSON.stringify(SCOPE)};
const LANES = ${JSON.stringify(LANES)};
const FLAG_MID = ${FLAG_MID};
const WORD0 = ${WORD0};
const WORD_STEP = ${WORD_STEP};
const DETENTS = ${JSON.stringify(DETENTS)};
const GALVO = ${JSON.stringify({ x: GALVO.x, y: GALVO.y, r: GALVO.r, top: GALVO_TOP })};
const SEL = ${JSON.stringify({ x: SEL.x, y: SEL.y, r: SEL.r, top: KNOB.z + KNOB.h })};
const T_FROM = ${T_FROM}, T_SPAN = ${T_TO - T_FROM};
const FLY = ${JSON.stringify(FLY)};

const stage = document.querySelector(".iso-stage");
const svg = stage.querySelector("svg");
const readout = document.querySelector("[data-readout]");
const status = document.querySelector("[data-status]");
const still = matchMedia("(prefers-reduced-motion: reduce)");
const traceEls = [0, 1, 2, 3].map((i) => svg.querySelector('[data-trace="' + i + '"]'));
const penEls = [0, 1, 2, 3].map((i) => svg.querySelector('[data-pen="' + i + '"]'));
const chanEls = [0, 1, 2, 3].map((i) => svg.querySelector('[data-chan="' + i + '"]'));
const needle = svg.querySelector('[data-part="needle"]');
const pointer = svg.querySelector('[data-part="pointer"]');
const drum = svg.querySelector('[data-part="drum"]');
const cursor = svg.querySelector('[data-part="cursor"]');
const belt = svg.querySelector('[data-part="belt"]');
const flowEls = [...svg.querySelectorAll(".fb-flow")];
const fly = svg.querySelector('[data-part="fly"]');
const probEl = svg.querySelector('[data-part="proboscis"]');
const probTip = svg.querySelector('[data-part="probtip"]');
const legEls = [0, 1, 2, 3, 4, 5].map((i) => svg.querySelector('[data-leg="' + i + '"]'));
const footEls = [0, 1, 2, 3, 4, 5].map((i) => svg.querySelector('[data-foot="' + i + '"]'));
const wingEls = [svg.querySelector('[data-wing="0"]'), svg.querySelector('[data-wing="1"]')];
const wedgeEls = [svg.querySelector('[data-wedge="0"]'), svg.querySelector('[data-wedge="1"]')];

const needleAt = (a) => lineOnTop(
  [GALVO.x - Math.sin(a) * 1.7, GALVO.y + Math.cos(a) * 1.7],
  [GALVO.x + Math.sin(a) * (GALVO.r - 2.2), GALVO.y - Math.cos(a) * (GALVO.r - 2.2)],
  GALVO.top + 0.15, P);
const pointerAt = (a) => lineOnTop(
  [SEL.x - Math.cos(a) * 0.7, SEL.y - Math.sin(a) * 0.7],
  [SEL.x + Math.cos(a) * (SEL.r - 1.6), SEL.y + Math.sin(a) * (SEL.r - 1.6)],
  SEL.top + 0.12, P);

const HIPS = [
  [52.5, -2.7], [55.8, -3.2], [59.2, -2.8],
  [52.5, 2.7], [55.8, 3.2], [59.2, 2.8],
];
const FOOT0 = [
  [49, -6.5, 21], [57.5, -7.5, 20.5], [63.5, -6.5, 21],
  [49, 6.5, 21], [57.5, 7.5, 20.5], [63.5, 6.5, 21],
];
function legPose(b, t, i) {
  const far = i < 3;
  const pair = i % 3;
  const w = (t / LOOP) * Math.PI * 2;
  const [bx, by, bz] = FOOT0[i];
  if (b === 0) {
    const ph = w * 2 + [0, 2.1, 4.2][pair] + (far ? Math.PI : 0);
    return [bx + Math.cos(ph) * 2.1, by, bz + Math.max(0, Math.sin(ph)) * 2.6];
  }
  if (b === 1) {
    if (pair === 0) {
      const ph = w * 3 + (far ? Math.PI : 0);
      return [48.2 + Math.cos(ph) * 1.1, by * 0.62, 29.4 + Math.sin(ph) * 1.5];
    }
    const ph = w * 2 + pair + (far ? 0.9 : 0);
    return [bx + Math.cos(ph) * 0.7, by, bz + Math.max(0, Math.sin(ph)) * 1.1];
  }
  if (b === 2) {
    const ph = w + pair * 2 + (far ? Math.PI : 0);
    return [bx + Math.cos(ph) * 0.5, by * 1.12, bz - 0.5];
  }
  return [bx + 1.2, by * 0.72, 27.5 + Math.sin(w * 4 + pair) * 0.4];
}
function legPath(i, fx, fy, fz) {
  const [hx, oy] = HIPS[i];
  const hy = FLY.hy + oy, hz = 29.6 - Math.abs(oy) * 0.3;
  const kx = (hx + fx) / 2 + (i % 3 === 0 ? -1.5 : 1.2);
  const ky = (hy + fy) / 2 + (i < 3 ? -1.6 : 1.6);
  const kz = Math.max(hz, fz) + 2.6;
  return pathOf([iso([hx, hy, hz], P), iso([kx, ky, kz], P), iso([fx, fy, fz], P)]);
}
function wingPath(side, flap) {
  const root = [55, FLY.hy + side * 1.6, 33.2];
  const u = [0.97, side * 0.28, -0.02];
  const v = [-0.2, side * 0.95, 0.1];
  const c = Math.cos(flap), s = Math.sin(flap);
  const ur = [u[0], u[1] * c - u[2] * s, u[1] * s + u[2] * c];
  const vr = [v[0], v[1] * c - v[2] * s, v[1] * s + v[2] * c];
  const pts = [];
  for (let i = 0; i < 20; i++) {
    const a = (i / 20) * Math.PI * 2;
    const ca = Math.cos(a), sa = Math.sin(a);
    pts.push(iso([
      root[0] + ur[0] * ca * 5.6 + vr[0] * sa * 2.1,
      root[1] + ur[1] * ca * 5.6 + vr[1] * sa * 2.1,
      root[2] + ur[2] * ca * 5.6 + vr[2] * sa * 2.1,
    ], P));
  }
  return pathOf(pts, true);
}
function flyFrame(bPrev, bNow, mix, t) {
  for (let i = 0; i < 6; i++) {
    const a = legPose(bPrev, t, i);
    const f = mix > 0.001 ? legPose(bNow, t, i).map((v, j) => a[j] * (1 - mix) + v * mix) : a;
    legEls[i].setAttribute("d", legPath(i, f[0], f[1], f[2]));
    const fp = iso([f[0], f[1], f[2]], P);
    footEls[i].setAttribute("cx", fp[0].toFixed(2));
    footEls[i].setAttribute("cy", fp[1].toFixed(2));
  }
  const w = (t / LOOP) * Math.PI * 2;
  const esc = mix < 0.5 ? bPrev === 3 : bNow === 3;
  const flap = esc ? Math.sin(w * 7) * 0.85 + 0.35 : 0.12 + Math.sin(w * 2) * 0.08;
  const d0 = wingPath(-1, flap), d1 = wingPath(1, flap);
  wingEls[0].setAttribute("d", d0);
  wedgeEls[0].setAttribute("d", d0);
  wingEls[1].setAttribute("d", d1);
  wedgeEls[1].setAttribute("d", d1);
  const now = mix < 0.5 ? bPrev : bNow;
  const bob = now === 3 ? 1.6 : now === 0 ? 0.4 * Math.sin(w * 4) : 0;
  fly.setAttribute("transform", translateAlong(P, [0, 0, bob]));
  const ext = now === 2 ? 1.2 + 4.6 * Math.max(0, Math.sin(w - 0.6)) : 1.2;
  const tipW = [47.9 - ext * 0.55, FLY.hy, 28.8 - ext];
  probEl.setAttribute("d", pathOf([iso([47.9, FLY.hy, 28.8], P), iso(tipW, P)]));
  probTip.setAttribute("cx", iso(tipW, P)[0].toFixed(2));
  probTip.setAttribute("cy", iso(tipW, P)[1].toFixed(2));
}

let behavior = 0, prevBehavior = 0, mixB = 1;
let clock = 0, running = true, touring = !still.matches;
let needleX = 0, needleV = 0, pointerA = DETENTS[0], pointerT = DETENTS[0];
const srcWord = ["simulated", "keyframed", "reference replay"];
function say() {
  const live = B[behavior].gain.filter((g) => g > 0.5).length;
  const text = B[behavior].name + " · t " + (clock % LOOP).toFixed(1) + " s · " + live + "/4 ch · " + srcWord[B[behavior].src];
  if (readout.textContent !== text) readout.textContent = text;
}
function describe() {
  status.textContent = "Behaviour " + B[behavior].name + ". Body clip source: " + srcWord[B[behavior].src] + ".";
}
const setBehavior = (i) => {
  const next = ((i % 4) + 4) % 4;
  if (next === behavior) return;
  prevBehavior = behavior;
  behavior = next;
  mixB = 0;
  pointerT = DETENTS[behavior];
  drum.style.transform = "translateY(" + (FLAG_MID - WORD0 + WORD_STEP * B[behavior].src) + "px)";
  describe();
};
const easeTo = (x, target, dt, tau, calm) => (calm ? target : x + (target - x) * (1 - Math.exp(-dt / tau)));

function draw(t) {
  const N = 46, SPAN = SCOPE.x1 - 4 - (SCOPE.x0 + 6);
  for (let i = 0; i < 4; i++) {
    let d = "";
    for (let j = 0; j < N; j++) {
      const back = (N - 1 - j) / (N - 1);
      const tau = t - back * 2.6;
      const vp = value(prevBehavior, tau, i);
      const v = mixB > 0.999 ? value(behavior, tau, i) : vp * (1 - mixB) + value(behavior, tau, i) * mixB;
      const x = SCOPE.x0 + 6 + (j / (N - 1)) * SPAN;
      const y = LANES[i] - 1.5 + v * 3;
      d += (j ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(2);
    }
    traceEls[i].setAttribute("d", d);
    const vNow = value(behavior, t, i);
    penEls[i].setAttribute("cy", (LANES[i] - 1.5 + vNow * 3).toFixed(2));
    chanEls[i].toggleAttribute("data-on", B[behavior].gain[i] > 0.5);
  }
}
function drawFrame(t, calm) {
  draw(t);
  flyFrame(prevBehavior, behavior, mixB, t);
}
let frame = 0, last = 0, visible = false, idleTimer = 0;
function tick(now) {
  const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
  last = now;
  const calm = still.matches;
  if (running || touring) clock += dt;
  mixB = easeTo(mixB, 1, dt, 0.45, calm);
  pointerA = easeTo(pointerA, pointerT, dt, 0.2, calm);
  pointer.setAttribute("d", pointerAt(pointerA));
  const t = clock % LOOP;
  const mean = [0, 1, 2, 3].reduce((s, i) => s + value(behavior, t, i), 0) / 4;
  const want = (mean - 0.45) * 2.1;
  needleV += ((want - needleX) * 160 - needleV * 9) * dt;
  needleX += needleV * dt;
  needle.setAttribute("d", needleAt(Math.max(-1.1, Math.min(1.1, needleX)) * -1 + (30 * Math.PI) / 180 * 0 + needleX * 0));
  drawFrame(t, calm);
  cursor.setAttribute("transform", translateAlong(P, [T_FROM + (t / LOOP) * T_SPAN, 0, 0]));
  say();
  const settled = !touring && !running;
  frame = visible && !settled ? requestAnimationFrame(tick) : 0;
}
const run = () => { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } };
new IntersectionObserver((entries) => { visible = entries[entries.length - 1].isIntersecting; if (visible) run(); }, { rootMargin: "120px 0px" }).observe(stage);
const userActs = () => {
  touring = false;
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => { if (!still.matches) { touring = true; running = true; setFlow(true); } }, 9000);
  run();
};
const setFlow = (v) => flowEls.forEach((el) => (v ? el.setAttribute("data-flow", "") : el.removeAttribute("data-flow")));
svg.addEventListener("click", (event) => {
  if (event.target.closest('[data-part="dial-zone"]')) { userActs(); setBehavior(behavior + 1); return; }
  if (event.target.closest('[data-part="glass"], [data-part="fly"]')) { userActs(); running = !running; setFlow(running); }
});
stage.addEventListener("keydown", (event) => {
  if (event.metaKey || event.ctrlKey || event.altKey) return;
  const key = event.key;
  if (key === "ArrowRight" || key === "ArrowUp") { event.preventDefault(); userActs(); setBehavior(behavior + 1); }
  else if (key === "ArrowLeft" || key === "ArrowDown") { event.preventDefault(); userActs(); setBehavior(behavior - 1); }
  else if (key === " ") { event.preventDefault(); userActs(); running = !running; setFlow(running); }
  else if (key === "Home") { event.preventDefault(); userActs(); setBehavior(0); }
  else if (key >= "1" && key <= "4") { userActs(); setBehavior(Number(key) - 1); }
});
let tourClock = 0;
(function tour() {
  if (touring) { tourClock += 0.25; if (tourClock > 7) { tourClock = 0; setBehavior(behavior + 1); } }
  setTimeout(tour, 250);
})();
drawFrame(0, false);
say();
describe();
`;

const css = `<style>
.fb-well{fill:var(--anatomy-shade-1)}
.fb-bezel{fill:var(--anatomy-top)}
.fb-glass{fill:var(--anatomy-shade-0)}
.fb-glassline{fill:none;stroke:var(--anatomy-lo);stroke-width:.6px;vector-effect:non-scaling-stroke}
.fb-grat{fill:none;stroke:var(--anatomy-faint);stroke-width:.5px;vector-effect:non-scaling-stroke}
.fb-trace{fill:none;stroke:var(--anatomy-lit);stroke-width:.7px;vector-effect:non-scaling-stroke;stroke-linecap:round;stroke-linejoin:round}
.fb-pen{fill:var(--anatomy-lit)}
.fb-chan{fill:var(--anatomy-mid);opacity:.5}
.fb-chan[data-on]{fill:var(--anatomy-lit);opacity:1}
.fb-word{fill:var(--anatomy-hi);font-family:var(--anatomy-mono);font-size:3.8px;letter-spacing:.12em}
.fb-drumwrap [data-part="drum"]{transition:transform .5s var(--anatomy-ease)}
.fb-glassfill{fill:var(--anatomy-lit);opacity:.045}
.fb-wing{fill:var(--anatomy-top);stroke:none;opacity:.92}
.fb-foot{fill:var(--anatomy-hi)}
.iso-stage{touch-action:pan-y}
.iso-stage:focus{outline:none}
.iso-stage:focus-visible{outline:1px solid var(--anatomy-muted);outline-offset:6px}
.fb-sr{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
@media (prefers-reduced-motion:reduce){.fb-drumwrap [data-part="drum"]{transition:none}}
</style>`;

const body =
  css +
  k.plateHtml({
    fig: "Fig 1",
    title: "FlyBrain — one timeline, two views",
    hint: "Arrows pick a behaviour · Space pauses",
    readout: "walking · t 0.0 s · 3/4 ch · reference replay",
    keys: [
      {
        mark: "lit",
        label:
          "Four pens write simulated neuropil activity, one channel per region",
      },
      {
        mark: "raised",
        label: "The glass dome: an automaton fly on a specimen pin",
      },
      {
        mark: "edge",
        label: "One belt drive runs the body and the trace on the same clock",
      },
      { mark: "dotted", label: "The drum names the body clip's provenance" },
    ],
    caption:
      "A museum demonstration engine for the fly brain. Pick a behaviour on the selector — walking, grooming, feeding or escape — and one belt drive turns the timeline: the automaton fly under the dome performs the clip while four pens write simulated neuropil activity on the same pass, the galvanometer reads the total, the rider sweeps the 4-second rule and the drum names where the body motion came from. The site labels every claim exactly this way: simulated model, keyframed, or reference replay.",
    body: `<div class="iso-stage" tabindex="0" role="group" aria-label="FlyBrain demonstration engine. Arrow keys pick a behaviour; Space pauses the timeline.">${svg}<span class="fb-sr" role="status" aria-live="polite" data-status></span></div>`,
  });

const name = theme === "light" ? "index-light.html" : "index.html";
writeFileSync(
  join(HERE, name),
  k.pageHtml({
    title: "FlyBrain demonstration engine",
    theme,
    body,
    script: kitScript() + live,
  }),
);
console.log("wrote", name);
