/* CMA CGM Air Cargo Virtual — site behaviour (no build step, no framework). */
(() => {
  "use strict";

  const CFG = window.VCMA_CONFIG || {};
  const HUB = "LFPG";
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const el = (tag, attrs = {}, ...children) => {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === "class") node.className = v;
      else if (k === "text") node.textContent = v;
      else if (k.startsWith("on")) node.addEventListener(k.slice(2), v);
      else node.setAttribute(k, v === true ? "" : v);
    }
    for (const c of children.flat()) if (c != null) node.append(c);
    return node;
  };

  const fmtBlock = (min) => `${Math.floor(min / 60)}h${String(min % 60).padStart(2, "0")}`;
  const fmtNum = (n) => new Intl.NumberFormat("en-GB").format(n);
  const fmtFreq = (n) => (n === 1 ? "Weekly" : `${n}× weekly`);
  const fmtDate = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  /* ---------- Navigation ---------- */
  const nav = $(".nav");
  const onScroll = () => nav.classList.toggle("is-solid", window.scrollY > 40);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  const toggle = $(".nav__toggle");
  const links = $("#nav-links");
  toggle.addEventListener("click", () => {
    const open = toggle.getAttribute("aria-expanded") !== "true";
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    links.classList.toggle("is-open", open);
    nav.classList.add("is-solid");
  });
  $$("a", links).forEach((a) =>
    a.addEventListener("click", () => {
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open menu");
      links.classList.remove("is-open");
    })
  );

  /* ---------- Reveal on scroll (the "js" class on <html> hides [data-reveal] until then) ---------- */
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if ("IntersectionObserver" in window && !reduceMotion) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        e.target.classList.add("is-in");
        io.unobserve(e.target);
      }
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    $$("[data-reveal]").forEach((n) => io.observe(n));
  } else {
    $$("[data-reveal]").forEach((n) => n.classList.add("is-in"));
  }

  /* ---------- Light that follows the pointer on cards ---------- */
  if (window.matchMedia("(hover: hover)").matches) {
    $$(".card").forEach((card) =>
      card.addEventListener("pointermove", (e) => {
        const r = card.getBoundingClientRect();
        card.style.setProperty("--mx", `${e.clientX - r.left}px`);
        card.style.setProperty("--my", `${e.clientY - r.top}px`);
      })
    );
  }

  /* ---------- Links from config ---------- */
  const joinUrl = CFG.newskyJoinUrl || "https://newsky.app/pilot/register";
  $$(".js-join-direct").forEach((a) => (a.href = joinUrl));
  if (CFG.discordUrl) $$(".js-discord").forEach((a) => { a.href = CFG.discordUrl; a.hidden = false; });
  if (CFG.contactEmail) $$(".js-contact").forEach((a) => { a.href = `mailto:${CFG.contactEmail}`; a.hidden = false; });

  /* ---------- Live map (Newsky embed) ---------- */
  if (CFG.newskyMapToken) {
    const frame = el("iframe", {
      src: `https://newsky.app/airline/public/map?style=dark&token=${encodeURIComponent(CFG.newskyMapToken)}`,
      title: "CMA CGM Air Cargo Virtual live flights on Newsky",
      loading: "lazy",
    });
    $("#live-map").replaceChildren(frame);
  }

  /* ---------- Route network ---------- */
  /* Who flies each rotation in the real world ("operator" in routes.json, set in data-src/network.txt),
     in the order of the brochure. Colours stay in the flag: blue, red, white. */
  const OPS = {
    cma: {
      rgb: [61, 123, 255], name: "CMA CGM AIR CARGO",
      note: "Its own aircraft and crews, from Paris-CDG and Madrid.",
      badge: "Operated by CMA CGM AIR CARGO",
    },
    bel: {
      rgb: [255, 51, 65], name: "Air Belgium",
      note: "Part of the CMA CGM group since 2025. From Brussels and Liège.",
      badge: "Operated by Air Belgium, CMA CGM group",
    },
    atlas: {
      rgb: [238, 240, 244], name: "Atlas Air",
      note: "CMA CGM AIR CARGO 777Fs flown by Atlas Air, across the Pacific.",
      badge: "Operated by Atlas Air on behalf of CMA CGM AIR CARGO",
    },
  };
  const rgba = (op, a) => `rgba(${OPS[op].rgb.join(",")},${a})`;
  const stopsOf = (r) => [r.legs[0].from, ...r.legs.map((l) => l.to)];

  fetch("data/routes.json")
    .then((r) => r.json())
    .then(initNetwork)
    .catch((err) => {
      console.error(err);
      $("#route-list").replaceChildren(el("p", { class: "empty", text: "Route data could not be loaded." }));
    });

  function initNetwork(data) {
    const { airports, rotations, totals } = data;
    rotations.forEach((r, i) => (r.key = i));

    $$('[data-stat="rotations"]').forEach((n) => (n.textContent = totals.rotations));
    $$('[data-stat="airports"]').forEach((n) => (n.textContent = totals.airports));
    $$('[data-stat="weekly"]').forEach((n) => (n.textContent = totals.weeklyRotations));

    const city = (icao) => airports[icao].city;
    const iata = (icao) => airports[icao].iata;

    /* Departure-board ticker under the hero: every rotation, twice for a seamless loop. */
    const ticker = $("#ticker");
    if (ticker) {
      const run = (hidden) => rotations.map((r) =>
        el("span", { class: "ticker__item", "aria-hidden": hidden ? "true" : null },
          stopsOf(r).map(iata).join(" → "),
          el("em", { text: fmtFreq(r.perWeek) })
        )
      );
      ticker.replaceChildren(...run(false), ...run(true));
    }

    /* List, grouped by operator */
    const items = new Map();
    const groups = new Map();
    const groupsBox = $("#route-list");
    const highlight = (keys) => items.forEach((btn, k) => btn.classList.toggle("is-hover", !!keys && keys.has(k)));
    for (const [op, meta] of Object.entries(OPS)) {
      const rots = rotations.filter((r) => r.operator === op);
      if (!rots.length) continue;
      const ul = el("ul", { class: "routes" });
      for (const r of rots) {
        const stops = stopsOf(r);
        const enter = () => { highlight(new Set([r.key])); map.hover(new Set([r.key])); };
        const leave = () => { highlight(null); map.hover(null); };
        const btn = el("button",
          {
            class: "route", type: "button", style: `--op:rgb(${meta.rgb.join(",")})`,
            onclick: () => select(r.key, true),
            onmouseenter: enter, onmouseleave: leave, onfocus: enter, onblur: leave,
          },
          el("span", { class: "route__codes" }, stops.flatMap((s, i) => (i ? [el("i", { text: "→", "aria-hidden": "true" }), iata(s)] : [iata(s)]))),
          el("span", { class: "route__freq", text: fmtFreq(r.perWeek) }),
          el("span", { class: "route__cities", text: stops.map(city).join(" → ") }),
          el("span", { class: "route__dist", text: `${fmtNum(r.distanceNm)} nm` })
        );
        items.set(r.key, btn);
        ul.append(el("li", {}, btn));
      }
      const group = el("section", { class: "rgroup", "aria-label": meta.badge },
        el("header", { class: "rgroup__head" },
          el("i", { class: `op op--${op}`, "aria-hidden": "true" }),
          el("div", {}, el("strong", { text: meta.name }), el("span", { text: meta.note })),
          el("em", { text: String(rots.length).padStart(2, "0") })
        ),
        ul
      );
      groups.set(op, group);
      groupsBox.append(group);
    }

    const stage = $("#netmap");
    const browser = $("#route-browser");
    const detail = $("#route-detail");
    const map = createNetMap(stage, airports, rotations, {
      hover: highlight,
      select: (key) => select(key, false),
    });

    let filter = "all";
    let selected = null;
    let listScroll = 0;

    function summary() {
      const rots = rotations.filter((r) => filter === "all" || r.operator === filter);
      const weekly = rots.reduce((n, r) => n + r.perWeek, 0);
      $("#route-count").textContent = rots.length;
      $("#map-status").textContent =
        `${filter === "all" ? "All operators" : OPS[filter].name} · ${rots.length} rotations · ${weekly} a week`;
    }

    function setFilter(op) {
      filter = op;
      $$(".seg", stage).forEach((b) => {
        const on = b.dataset.filter === op;
        b.classList.toggle("is-active", on);
        b.setAttribute("aria-pressed", String(on));
      });
      groups.forEach((g, k) => (g.hidden = op !== "all" && op !== k));
      if (selected != null && op !== "all" && rotations[selected].operator !== op) back(false);
      summary();
      map.set({ filter, selected });
      map.fit(true);
    }
    $$(".seg", stage).forEach((b) => b.addEventListener("click", () => setFilter(b.dataset.filter)));

    function select(key, fromList) {
      if (selected == null) listScroll = groupsBox.scrollTop;
      selected = key;
      highlight(null);
      renderDetail(rotations[key]);
      browser.hidden = true;
      detail.hidden = false;
      detail.scrollTop = 0;
      map.set({ filter, selected });
      map.fit(true);
      $("#rd-back").focus({ preventScroll: true });
      // Panel under the map (tablets, phones): bring the map back into view.
      if (fromList && getComputedStyle($(".netmap__panel")).position !== "absolute") {
        stage.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      }
    }

    function back(refit = true) {
      const key = selected;
      selected = null;
      detail.hidden = true;
      browser.hidden = false;
      groupsBox.scrollTop = listScroll;
      map.set({ filter, selected });
      if (!refit) return;
      map.fit(true);
      if (key != null) items.get(key).focus({ preventScroll: true });
    }
    $("#rd-back").addEventListener("click", () => back());
    detail.addEventListener("keydown", (e) => { if (e.key === "Escape") back(); });

    function renderDetail(r) {
      const meta = OPS[r.operator];
      const stops = stopsOf(r);
      detail.style.setProperty("--op", `rgb(${meta.rgb.join(",")})`);
      $("#rd-op").replaceChildren(el("i", { class: `op op--${r.operator}`, "aria-hidden": "true" }), meta.badge);
      $("#rd-title").textContent = stops.map(city).join(" → ");
      $("#rd-codes").textContent = stops.join(" · ");
      $("#rd-dist").textContent = `${fmtNum(r.distanceNm)} nm`;
      $("#rd-block").textContent = fmtBlock(r.blockMin);
      $("#rd-freq").textContent = fmtFreq(r.perWeek);
      const prefix = CFG.flightPrefix ? `${CFG.flightPrefix} ` : "";
      const rows = [];
      stops.forEach((icao, i) => {
        rows.push(el("li", { class: "leg-stop" },
          el("strong", { text: iata(icao) }), el("span", { text: city(icao) }), el("small", { text: icao })));
        const leg = r.legs[i];
        if (!leg) return;
        rows.push(el("li", { class: "leg-hop" },
          leg.flight
            ? el("span", { class: "flight-no", text: `${prefix}${leg.flight}` })
            : el("span", { class: "tba", text: "TBA" }),
          el("span", { text: `${fmtNum(leg.distanceNm)} nm` }),
          el("span", { text: fmtBlock(leg.blockMin) })));
      });
      $("#rd-legs").replaceChildren(...rows);
    }

    summary();
  }

  /* ---------- Dotted world map ----------
     A canvas, no library. Miller cylindrical projection cut at 60°W, in the western Atlantic, so that every
     rotation is drawn in one piece: Campinas and Europe on the left, Asia in the middle, the Americas on the right.
     World units are degrees: X = degrees east of the cut, Y = Miller ordinate (north is negative).
     Land comes from Natural Earth (public domain), sampled on a grid of dots that stays the same size at every zoom. */
  const RAD = Math.PI / 180;
  const CUT = -60;
  const LAND_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-110m.json";
  const MASK_K = 4;                                   // land mask: 4 px per degree, plain longitude / latitude
  const MASK_W = 360 * MASK_K;
  const MASK_H = 180 * MASK_K;
  const worldX = (lon) => (((lon - CUT) % 360) + 360) % 360;
  const worldY = (lat) => (-1.25 * Math.log(Math.tan(Math.PI / 4 + 0.4 * lat * RAD))) / RAD;
  const latOf = (Y) => (2.5 * Math.atan(Math.exp(-0.8 * Y * RAD)) - 0.625 * Math.PI) / RAD;

  function loadLandMask() {
    return fetch(LAND_URL)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((topo) => {
        const cv = document.createElement("canvas");
        cv.width = MASK_W;
        cv.height = MASK_H;
        const c = cv.getContext("2d", { willReadFrequently: true });
        c.beginPath();
        for (const ring of topoRings(topo, topo.objects.land)) {
          // Some rings cross the 180° meridian (Fiji, Chukotka, Antarctica): unwrap their longitudes so the
          // outline stays continuous, then draw it 360° to each side as well so the overflow lands on the other edge.
          let prev = null;
          const pts = ring.map(([lon, lat]) => {
            if (prev != null) lon += Math.round((prev - lon) / 360) * 360;
            prev = lon;
            return [lon, lat];
          });
          for (const off of [-360, 0, 360]) {
            pts.forEach(([lon, lat], i) => {
              const x = (lon + off + 180) * MASK_K;
              const y = (90 - lat) * MASK_K;
              if (i) c.lineTo(x, y);
              else c.moveTo(x, y);
            });
            c.closePath();
          }
        }
        c.fillStyle = "#fff";
        c.fill("evenodd");
        const px = c.getImageData(0, 0, MASK_W, MASK_H).data;
        const mask = new Uint8Array(MASK_W * MASK_H);
        for (let i = 0; i < mask.length; i++) mask[i] = px[i * 4 + 3] > 127 ? 1 : 0;
        return mask;
      });
  }

  /* TopoJSON -> rings of [lon, lat]. A land layer only holds polygons and multipolygons. */
  function topoRings(topo, object) {
    const t = topo.transform;
    const arcs = topo.arcs.map((arc) => {
      let x = 0;
      let y = 0;
      return arc.map(([a, b]) => {
        if (!t) return [a, b];
        x += a;
        y += b;
        return [x * t.scale[0] + t.translate[0], y * t.scale[1] + t.translate[1]];
      });
    });
    const ring = (ids) => {
      const pts = [];
      for (const id of ids) {
        const arc = id < 0 ? arcs[~id].slice().reverse() : arcs[id];
        for (let i = pts.length ? 1 : 0; i < arc.length; i++) pts.push(arc[i]);
      }
      return pts;
    };
    const rings = [];
    for (const g of object.geometries || [object]) {
      const polygons = g.type === "Polygon" ? [g.arcs] : g.type === "MultiPolygon" ? g.arcs : [];
      for (const polygon of polygons) for (const ids of polygon) rings.push(ring(ids));
    }
    return rings;
  }

  function createNetMap(stage, airports, rotations, hooks) {
    const canvas = $("canvas", stage);
    const ctx = canvas.getContext("2d");
    const tip = $("#map-tip");
    const panel = $(".netmap__panel");
    const dots = document.createElement("canvas");  // land dots, redrawn only when the view moves
    const dctx = dots.getContext("2d");

    const DOT_GAP = 5.5;          // CSS px between two land dots
    const cam = { x: 180, y: 0, s: 2 };
    let W = 0;
    let H = 0;
    let dpr = 1;
    let mask = null;
    let landFailed = false;
    let dotsDirty = true;
    let anim = null;
    let raf = 0;
    let visible = !("IntersectionObserver" in window);
    let state = { filter: "all", selected: null };
    let inFilter = new Set();
    let inFocus = new Set();
    let filterApts = new Set();
    let focusApts = new Set();
    let selectedStops = new Set();
    let hovered = null;
    let hotApts = new Set();
    let hoverSig = "";

    /* Airports and arcs, in world units. An arc is drawn once even when several rotations share it. */
    const apts = {};
    for (const [icao, a] of Object.entries(airports)) {
      apts[icao] = { ...a, icao, X: worldX(a.lon), Y: worldY(a.lat), rots: new Set() };
    }
    // Bases away from Paris (Madrid, Brussels, Liège, Chicago, Los Angeles) get a slightly bigger dot.
    const bases = new Set(rotations.filter((r) => !stopsOf(r).includes(HUB)).map((r) => r.legs[0].from));
    const segs = new Map();
    const comets = [];
    for (const r of rotations) {
      for (const leg of r.legs) {
        apts[leg.from].rots.add(r.key);
        apts[leg.to].rots.add(r.key);
        const [p, q] = [leg.from, leg.to].sort();
        const id = `${p}|${q}`;
        let seg = segs.get(id);
        if (!seg) {
          const A = apts[p];
          const B = apts[q];
          const dx = B.X - A.X;
          const dy = B.Y - A.Y;
          const len = Math.hypot(dx, dy) || 1;
          let nx = -dy / len;
          let ny = dx / len;
          if (ny > 0 || (ny === 0 && nx > 0)) { nx = -nx; ny = -ny; }   // every arc bows to the north
          const h = len * 0.2;
          seg = { id, op: r.operator, a: A, b: B, len, rots: new Set(),
                  c: { X: (A.X + B.X) / 2 + nx * h, Y: (A.Y + B.Y) / 2 + ny * h } };
          segs.set(id, seg);
        }
        seg.rots.add(r.key);
        comets.push({ seg, key: r.key, forward: leg.from === p, phase: Math.random(), period: Math.max(2.4, seg.len * 0.045) });
      }
    }
    const segList = [...segs.values()];

    const bez = (s, t) => {
      const u = 1 - t;
      return [u * u * s.a.X + 2 * u * t * s.c.X + t * t * s.b.X, u * u * s.a.Y + 2 * u * t * s.c.Y + t * t * s.b.Y];
    };
    const sx = (X) => (X - cam.x) * cam.s + W / 2;
    const sy = (Y) => (Y - cam.y) * cam.s + H / 2;
    const meets = (set, keys) => {
      if (!keys) return false;
      for (const k of set) if (keys.has(k)) return true;
      return false;
    };

    /* ---- State ---- */
    function set(next) {
      state = { ...state, ...next };
      inFilter = new Set(rotations.filter((r) => state.filter === "all" || r.operator === state.filter).map((r) => r.key));
      inFocus = state.selected != null ? new Set([state.selected]) : inFilter;
      filterApts = new Set();
      focusApts = new Set();
      for (const r of rotations) {
        if (inFilter.has(r.key)) stopsOf(r).forEach((s) => filterApts.add(s));
        if (inFocus.has(r.key)) stopsOf(r).forEach((s) => focusApts.add(s));
      }
      selectedStops = new Set(state.selected != null ? stopsOf(rotations[state.selected]) : []);
      request();
    }

    function setHover(keys, fromMap) {
      const next = keys && keys.size ? keys : null;
      const sig = next ? [...next].sort().join(",") : "";
      if (sig === hoverSig) return;
      hoverSig = sig;
      hovered = next;
      hotApts = new Set();
      if (next) for (const k of next) stopsOf(rotations[k]).forEach((s) => hotApts.add(s));
      if (fromMap) hooks.hover(next);
      request();
    }

    /* ---- Camera ---- */
    const clampScale = (s) => Math.min(40, Math.max(W / 620, s));
    function clampCam(c) {
      c.x = Math.min(380, Math.max(-20, c.x));
      c.y = Math.min(worldY(-55), Math.max(worldY(80), c.y));
      return c;
    }

    function padding() {
      const overlay = getComputedStyle(panel).position === "absolute";
      const small = W < 640;
      // Phones: filters on top, zoom buttons in a row at the bottom. Larger screens: zoom buttons on the left.
      if (small) return { t: 60, b: 54, l: 18, r: 18 };
      return { t: 86, b: 50, l: 76, r: overlay ? panel.offsetWidth + 46 : 40 };
    }

    function viewFor(keys) {
      let x0 = Infinity;
      let y0 = Infinity;
      let x1 = -Infinity;
      let y1 = -Infinity;
      const add = (X, Y) => {
        x0 = Math.min(x0, X); x1 = Math.max(x1, X);
        y0 = Math.min(y0, Y); y1 = Math.max(y1, Y);
      };
      for (const seg of segList) {
        if (!meets(seg.rots, keys)) continue;
        add(seg.a.X, seg.a.Y);
        add(seg.b.X, seg.b.Y);
        add(...bez(seg, 0.5));
      }
      if (x0 === Infinity) return { ...cam };
      const p = padding();
      const w = Math.max(60, W - p.l - p.r);
      const h = Math.max(60, H - p.t - p.b);
      const s = clampScale(Math.min(w / Math.max(x1 - x0, 4), h / Math.max(y1 - y0, 4), 12));
      return clampCam({ s, x: (x0 + x1) / 2 - (p.l + w / 2 - W / 2) / s, y: (y0 + y1) / 2 - (p.t + h / 2 - H / 2) / s });
    }

    function jump(target) {
      anim = null;
      Object.assign(cam, target);
      dotsDirty = true;
      request();
    }

    function flyTo(target, ms = 1000) {
      if (reduceMotion || !visible || !W) return jump(target);
      anim = { from: { ...cam }, to: target, t0: performance.now(), ms };
      request();
    }

    function fit(animate) {
      const view = viewFor(inFocus);
      if (animate) flyTo(view);
      else jump(view);
    }

    function zoomAt(f, px, py, animate) {
      const base = anim ? anim.to : cam;
      const s = clampScale(base.s * f);
      const X = (px - W / 2) / base.s + base.x;
      const Y = (py - H / 2) / base.s + base.y;
      const target = clampCam({ s, x: X - (px - W / 2) / s, y: Y - (py - H / 2) / s });
      if (animate) flyTo(target, 450);
      else jump(target);
    }

    /* ---- Drawing ---- */
    function renderDots() {
      dotsDirty = false;
      dots.width = canvas.width;
      dots.height = canvas.height;
      dctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      if (!mask && !landFailed) return;
      const gap = W < 640 ? DOT_GAP * 0.75 : DOT_GAP;   // finer grid on phones, where the world is small
      const dot = W < 640 ? 0.95 : 1.15;
      const step = gap / cam.s;
      const left = cam.x - W / 2 / cam.s;
      const top = cam.y - H / 2 / cam.s;
      const i0 = Math.ceil(left / step);
      const i1 = Math.floor((left + W / cam.s) / step);
      const j0 = Math.ceil(top / step);
      const j1 = Math.floor((top + H / cam.s) / step);
      dctx.fillStyle = mask ? "rgba(255,255,255,0.27)" : "rgba(255,255,255,0.06)";
      dctx.beginPath();
      for (let j = j0; j <= j1; j++) {
        const lat = latOf(j * step);
        if (lat > 83 || lat < -58) continue;
        const row = Math.min(MASK_H - 1, Math.floor((90 - lat) * MASK_K)) * MASK_W;
        const y = sy(j * step);
        for (let i = i0; i <= i1; i++) {
          if (mask) {
            const col = Math.floor(((((i * step + CUT + 180) % 360) + 360) % 360) * MASK_K);
            if (!mask[row + Math.min(MASK_W - 1, col)]) continue;
          }
          const x = sx(i * step);
          dctx.moveTo(x + dot, y);
          dctx.arc(x, y, dot, 0, 2 * Math.PI);
        }
      }
      dctx.fill();
    }

    // 0 out of the filter, 1 in the filter but faded, 2 shown, 3 highlighted
    const STYLES = [
      { core: 0.07, glow: 0, w: 1 },
      { core: 0.2, glow: 0, w: 1.1 },
      { core: 0.7, glow: 0.1, w: 1.35 },
      { core: 1, glow: 0.22, w: 2 },
    ];
    function level(seg) {
      if (hovered && meets(seg.rots, hovered) && meets(seg.rots, inFilter)) return 3;
      if (meets(seg.rots, inFocus)) return state.selected != null ? 3 : hovered ? 1 : 2;
      return meets(seg.rots, inFilter) ? 1 : 0;
    }

    function drawArcs(time) {
      ctx.lineCap = "round";
      const drawn = segList.map((seg) => [level(seg), seg]).sort((a, b) => a[0] - b[0]);
      for (const [lv, seg] of drawn) {
        const st = STYLES[lv];
        ctx.beginPath();
        ctx.moveTo(sx(seg.a.X), sy(seg.a.Y));
        ctx.quadraticCurveTo(sx(seg.c.X), sy(seg.c.Y), sx(seg.b.X), sy(seg.b.Y));
        if (st.glow) {
          ctx.strokeStyle = rgba(seg.op, st.glow);
          ctx.lineWidth = st.w + 5;
          ctx.stroke();
        }
        ctx.strokeStyle = rgba(seg.op, st.core);
        ctx.lineWidth = st.w;
        ctx.stroke();
      }
      if (reduceMotion) return;
      // Freight in motion: a light runs along every leg, in the direction it is flown.
      const moving = hovered ? new Set([...hovered].filter((k) => inFilter.has(k))) : inFocus;
      if (state.selected != null) moving.add(state.selected);
      for (const c of comets) {
        if (!moving.has(c.key)) continue;
        const u = ((time / c.period + c.phase) % 1) * 1.3;
        if (u <= 1) drawComet(c, u);
      }
    }

    function drawComet(c, u) {
      const seg = c.seg;
      const fade = Math.min(1, u * 8, (1 - u) * 8);
      const span = Math.min(0.45, 90 / Math.max(seg.len * cam.s, 1));
      const head = c.forward ? u : 1 - u;
      const back = c.forward ? -1 : 1;
      const N = 14;
      let [px, py] = bez(seg, head);
      for (let i = 1; i <= N; i++) {
        const t = head + back * span * (i / N);
        if (t < 0 || t > 1) break;
        const [qx, qy] = bez(seg, t);
        ctx.beginPath();
        ctx.moveTo(sx(px), sy(py));
        ctx.lineTo(sx(qx), sy(qy));
        ctx.strokeStyle = rgba(seg.op, 0.95 * fade * (1 - i / N));
        ctx.lineWidth = 2.4 * (1 - i / N) + 0.4;
        ctx.stroke();
        px = qx;
        py = qy;
      }
      const [hx, hy] = bez(seg, head);
      ctx.fillStyle = rgba(seg.op, 0.28 * fade);
      ctx.beginPath();
      ctx.arc(sx(hx), sy(hy), 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${fade})`;
      ctx.beginPath();
      ctx.arc(sx(hx), sy(hy), 1.8, 0, 2 * Math.PI);
      ctx.fill();
    }

    const MONO = '500 10.5px "Geist Mono", ui-monospace, monospace';
    const SANS = '400 11px Geist, system-ui, sans-serif';

    function drawAirports(time) {
      const shown = [];
      for (const a of Object.values(apts)) {
        const x = sx(a.X);
        const y = sy(a.Y);
        if (x < -20 || x > W + 20 || y < -20 || y > H + 20) continue;
        const hub = a.icao === HUB;
        const on = hub || focusApts.has(a.icao) || hotApts.has(a.icao);
        const r = hub ? 3.6 : bases.has(a.icao) ? 2.9 : 2.3;
        ctx.globalAlpha = on ? 1 : filterApts.has(a.icao) ? 0.45 : 0.2;
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(x, y, r + 1.8, 0, 2 * Math.PI);
        ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x, y, r, 0, 2 * Math.PI);
        ctx.fill();
        shown.push({ a, x, y, r, on });
      }
      ctx.globalAlpha = 1;

      // Paris-CDG, the hub, sends out a slow blue ring.
      const hub = apts[HUB];
      const p = reduceMotion ? 0.35 : (time % 2.8) / 2.8;
      ctx.strokeStyle = `rgba(61,123,255,${0.75 * (1 - p)})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(sx(hub.X), sy(hub.Y), 4.5 + p * 16, 0, 2 * Math.PI);
      ctx.stroke();

      // Labels: the hub first, then the stops of the selected rotation, the bases, the busiest airports.
      // A label that would cover another label or an airport is left out.
      const rank = (s) => (s.a.icao === HUB ? 0 : selectedStops.has(s.a.icao) ? 1 : bases.has(s.a.icao) ? 2 : 10 - s.a.rots.size / 10);
      const obstacles = shown.map((s) => ({ x0: s.x - s.r - 2, y0: s.y - s.r - 2, x1: s.x + s.r + 2, y1: s.y + s.r + 2, a: s.a }));
      const placed = [...overlays];
      const overlaps = (b, o) => b.x0 < o.x1 && b.x1 > o.x0 && b.y0 < o.y1 && b.y1 > o.y0;
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      for (const s of shown.filter((s) => s.on).sort((a, b) => rank(a) - rank(b))) {
        const code = s.a.iata;
        const sub = selectedStops.has(s.a.icao) ? s.a.city : "";
        ctx.font = MONO;
        const w1 = ctx.measureText(code).width;
        ctx.font = SANS;
        const w2 = sub ? ctx.measureText(sub).width + 6 : 0;
        const w = w1 + w2;
        const spots = [[s.x + s.r + 5, s.y], [s.x - s.r - 5 - w, s.y], [s.x - w / 2, s.y - s.r - 10], [s.x - w / 2, s.y + s.r + 10]];
        const others = obstacles.filter((o) => o.a !== s.a);
        // The hub and the stops of the open rotation always get a label, over a neighbouring dot if need be.
        const must = rank(s) < 2;
        for (const [n, [lx, ly]] of [...spots, ...(must ? spots : [])].entries()) {
          const box = { x0: lx - 2, y0: ly - 8, x1: lx + w + 2, y1: ly + 8 };
          if (box.x0 < 4 || box.x1 > W - 4 || box.y0 < 4 || box.y1 > H - 4) continue;
          if (placed.some((o) => overlaps(box, o))) continue;
          if (n < spots.length && others.some((o) => overlaps(box, o))) continue;
          placed.push(box);
          ctx.lineWidth = 3;
          ctx.strokeStyle = "rgba(0,0,0,0.85)";
          ctx.font = MONO;
          ctx.strokeText(code, lx, ly);
          ctx.fillStyle = "#fff";
          ctx.fillText(code, lx, ly);
          if (sub) {
            ctx.font = SANS;
            ctx.strokeText(sub, lx + w1 + 6, ly);
            ctx.fillStyle = "rgba(255,255,255,0.62)";
            ctx.fillText(sub, lx + w1 + 6, ly);
          }
          break;
        }
      }
    }

    function frame(now) {
      raf = 0;
      if (anim) {
        const k = Math.min(1, (now - anim.t0) / anim.ms);
        const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
        cam.s = Math.exp(Math.log(anim.from.s) + (Math.log(anim.to.s) - Math.log(anim.from.s)) * e);
        cam.x = anim.from.x + (anim.to.x - anim.from.x) * e;
        cam.y = anim.from.y + (anim.to.y - anim.from.y) * e;
        dotsDirty = true;
        if (k === 1) anim = null;
      }
      if (!W) return;
      if (dotsDirty) renderDots();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(dots, 0, 0);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const time = now / 1000;
      drawArcs(time);
      drawAirports(time);
      if (anim || (!reduceMotion && visible && !document.hidden)) request();
    }

    function request() {
      if (!raf) raf = requestAnimationFrame(frame);
    }

    /* ---- Pointer: drag to pan, hover for details, click to open a rotation ---- */
    function pick(px, py) {
      let best = null;
      let bd = 11;
      for (const a of Object.values(apts)) {
        if (!filterApts.has(a.icao)) continue;
        const d = Math.hypot(sx(a.X) - px, sy(a.Y) - py);
        if (d < bd) { bd = d; best = { apt: a }; }
      }
      if (best) return best;
      bd = 7;
      for (const seg of segList) {
        if (!meets(seg.rots, inFilter)) continue;
        let ax = sx(seg.a.X);
        let ay = sy(seg.a.Y);
        for (let k = 1; k <= 32; k++) {
          const [X, Y] = bez(seg, k / 32);
          const bx = sx(X);
          const by = sy(Y);
          const dx = bx - ax;
          const dy = by - ay;
          const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy || 1)));
          const d = Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
          if (d < bd) { bd = d; best = { seg }; }
          ax = bx;
          ay = by;
        }
      }
      return best;
    }

    const keysOf = (hit) => [...(hit.apt ? hit.apt.rots : hit.seg.rots)].filter((k) => inFilter.has(k)).sort((a, b) => a - b);

    function showTip(px, py, title, sub) {
      if (title == null) { tip.hidden = true; return; }
      tip.replaceChildren(document.createTextNode(title), el("small", { text: sub }));
      tip.hidden = false;
      const w = tip.offsetWidth;
      tip.style.left = `${Math.min(W - w / 2 - 8, Math.max(w / 2 + 8, px))}px`;
      tip.style.top = `${Math.max(tip.offsetHeight + 22, py)}px`;
    }

    function hoverAt(px, py) {
      const hit = pick(px, py);
      canvas.classList.toggle("is-pointing", !!hit);
      if (!hit) {
        setHover(null, true);
        showTip();
        return;
      }
      const keys = keysOf(hit);
      setHover(new Set(keys), true);
      const n = `${keys.length} rotation${keys.length > 1 ? "s" : ""}`;
      if (hit.apt) showTip(px, py, hit.apt.city, `${hit.apt.iata} · ${hit.apt.icao} · ${n}`);
      else showTip(px, py, `${hit.seg.a.city} – ${hit.seg.b.city}`, `${OPS[hit.seg.op].name} · ${n}`);
    }

    function clickAt(px, py) {
      const hit = pick(px, py);
      if (!hit) return;
      const keys = keysOf(hit);
      if (!keys.length) return;
      // Clicking the same line or airport again moves on to the next rotation that uses it.
      showTip();
      hooks.select(keys[(keys.indexOf(state.selected) + 1) % keys.length]);
    }

    let drag = null;
    let wheelOn = false;
    const local = (e) => {
      const r = canvas.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    };
    canvas.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      drag = { x: e.clientX, y: e.clientY, cx: cam.x, cy: cam.y, moved: false };
      wheelOn = true;
      canvas.setPointerCapture(e.pointerId);
    });
    canvas.addEventListener("pointermove", (e) => {
      if (drag) {
        const dx = e.clientX - drag.x;
        const dy = e.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 4) {
          drag.moved = true;
          anim = null;
          canvas.classList.add("is-dragging");
          showTip();
        }
        if (drag.moved) {
          cam.x = drag.cx - dx / cam.s;
          cam.y = drag.cy - dy / cam.s;
          clampCam(cam);
          dotsDirty = true;
          request();
        }
        return;
      }
      if (e.pointerType === "mouse") hoverAt(...local(e));
    });
    const endDrag = (e) => {
      if (!drag) return;
      const click = !drag.moved && e.type === "pointerup";
      drag = null;
      canvas.classList.remove("is-dragging");
      if (click) clickAt(...local(e));
    };
    canvas.addEventListener("pointerup", endDrag);
    canvas.addEventListener("pointercancel", endDrag);
    canvas.addEventListener("pointerleave", () => {
      wheelOn = false;
      if (drag) return;
      setHover(null, true);
      showTip();
    });
    // The wheel zooms only once the map has been clicked (or with Ctrl), so the page still scrolls past it.
    canvas.addEventListener("wheel", (e) => {
      if (!wheelOn && !e.ctrlKey) return;
      e.preventDefault();
      zoomAt(Math.exp(-e.deltaY * 0.0016), ...local(e), false);
    }, { passive: false });

    $$("[data-zoom]", stage).forEach((b) =>
      b.addEventListener("click", () => {
        if (b.dataset.zoom === "fit") return fit(true);
        const p = padding();
        zoomAt(b.dataset.zoom === "in" ? 1.8 : 1 / 1.8, p.l + (W - p.l - p.r) / 2, p.t + (H - p.t - p.b) / 2, true);
      })
    );

    /* ---- Size, visibility, land ---- */
    // Boxes of the controls drawn over the map (filters, zoom, panel): labels keep out of them.
    let overlays = [];
    function measureOverlays() {
      const base = stage.getBoundingClientRect();
      overlays = [".netmap__filters", ".netmap__zoom", ".netmap__panel"]
        .map((sel) => $(sel, stage.parentNode))
        .filter((n) => n && getComputedStyle(n).position === "absolute")
        .map((n) => {
          const r = n.getBoundingClientRect();
          return { x0: r.left - base.left - 4, y0: r.top - base.top - 4, x1: r.right - base.left + 4, y1: r.bottom - base.top + 4 };
        });
    }

    function resize() {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      if (!w || !h || (w === W && h === H)) return;
      W = w;
      H = h;
      measureOverlays();
      dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.round(W * dpr);
      canvas.height = Math.round(H * dpr);
      dotsDirty = true;
      fit(false);
    }

    set({});
    if ("ResizeObserver" in window) new ResizeObserver(resize).observe(stage);
    else window.addEventListener("resize", resize);
    resize();
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(([e]) => {
        visible = e.isIntersecting;
        if (visible) request();
      }).observe(stage);
    }
    document.addEventListener("visibilitychange", request);
    if (document.fonts) document.fonts.ready.then(request);
    loadLandMask()
      .then((m) => { mask = m; })
      .catch((err) => { landFailed = true; console.warn("Land outline unavailable, plain grid instead.", err); })
      .finally(() => { dotsDirty = true; request(); });

    return { set, fit, hover: (keys) => setHover(keys, false) };
  }

  /* ---------- Live stats (written hourly by the Newsky sync job) ---------- */
  fetch("data/stats.json", { cache: "no-cache" })
    .then((r) => r.json())
    .then(renderStats)
    .catch((err) => console.warn("stats.json unavailable", err));

  function ratingClass(v) {
    const score = v > 10 ? v / 10 : v;
    return score >= 8 ? "rating--good" : score >= 6 ? "rating--mid" : "rating--low";
  }
  const fmtRating = (v) => (v == null ? "–" : v > 10 ? Math.round(v) : v.toFixed(1));

  function renderStats(s) {
    if (!s || !s.totals) return;
    const t = s.totals;
    $("#st-flights").textContent = fmtNum(t.flights || 0);
    // One decimal under 10 h, so a single 1h32 flight reads "1.5" instead of "2".
    const hours = (t.blockMinutes || 0) / 60;
    $("#st-hours").textContent = hours < 10 ? String(Math.round(hours * 10) / 10) : fmtNum(Math.round(hours));
    $("#st-pilots").textContent = fmtNum(t.pilots || 0);
    $("#st-rating").textContent = fmtRating(t.avgRating);
    if (t.cargoKg > 0) {
      $("#st-cargo").textContent = `${fmtNum(Math.round(t.cargoKg / 1000))} t`;
      $("#st-cargo-tile").hidden = false;
    }
    if (s.generatedAt) {
      const d = new Date(s.generatedAt);
      $("#st-updated").textContent = `Updated ${d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" })} UTC`;
    }

    if (s.recent && s.recent.length) {
      $("#pirep-empty").hidden = true;
      $("#pirep-rows").replaceChildren(
        ...s.recent.map((f) =>
          el("tr", {},
            el("td", { class: "mono", text: f.flightNumber || "–" }),
            el("td", { text: `${f.dep || "?"} → ${f.arr || "?"}` }),
            el("td", { text: f.pilot || "–" }),
            el("td", { class: "mono", text: f.aircraft || "–" }),
            el("td", { class: "mono", text: f.blockMin ? fmtBlock(f.blockMin) : "–" }),
            el("td", {}, f.rating == null ? "–" : el("span", { class: `rating ${ratingClass(f.rating)}`, text: fmtRating(f.rating) })),
            el("td", { text: f.date ? fmtDate(f.date.slice(0, 10)) : "–" })
          )
        )
      );
    }

    if (s.topPilots && s.topPilots.length) {
      $("#leaders-empty").hidden = true;
      $("#leaders").replaceChildren(
        ...s.topPilots.map((p) =>
          el("li", {},
            el("strong", { text: p.name }),
            el("span", { text: `${p.flights} flt · ${fmtBlock(p.blockMinutes)}` })
          )
        )
      );
    }
  }
})();
