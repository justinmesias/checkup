/* ===== Tsek engine: sheet layouts, rendering, and OMR reading ===== */
const Tsek = (() => {
  const APP = 'CheckUP'; // app name: change here to rename everywhere
  const LET = ['A', 'B', 'C', 'D', 'E'];
  // All units in millimetres. Slips fit both Letter (short bond) and A4.
  // fmt = slips per page: 4 (quarter), 2 (half, landscape), 1 (full page)
  const FORMATS = {
    4: { W: 104, H: 136, m: 7, ly1: 19, ly2: 27, gridTop: 36, label: 'Quarter sheet' },
    2: { W: 208, H: 136, m: 7, ly1: 19, ly2: 27, gridTop: 36, label: 'Half sheet' },
    1: { W: 206, H: 270, m: 8, ly1: 24, ly2: 33, gridTop: 44, label: 'Full sheet' }
  };
  const SIZES = [10, 20, 30, 40, 50], FMTS = [4, 2, 1];
  const DEFAULT_FMT = { 10: 4, 20: 2, 30: 2, 40: 1, 50: 1 };
  // printed layout codes 1–15 (40-item sheets were added later, so they take 13–15)
  const OLD = [10, 20, 30, 50];
  const codeFor = (n, fmt) => n === 40 ? 13 + FMTS.indexOf(fmt) : FMTS.indexOf(fmt) * 4 + OLD.indexOf(n) + 1;
  const PX_MAX = 5.4, PX_MIN = 3.6, LW = 5.5; // bubble pitch limits; LW = width of the item-number label

  // Choose columns and bubble pitch so n items fit the slip.
  function fit(n, F) {
    const inset = 4, aw = F.W - 2 * inset - 4, ah = F.H - F.gridTop - (inset + F.m + 2.5);
    let best = null;
    for (let cols = 1; cols <= 6; cols++) {
      const rows = Math.ceil(n / cols), g = rows > 10 ? Math.floor((rows - 1) / 5) : 0;
      // width = 2px (class no.) + cols*(gap + LW + 5px), gap = 0.4px + 1.5
      const pw = (aw - cols * (LW + 1.5)) / (2 + cols * 5.4);
      const ph = Math.min((ah - g * 1.2) / (1.12 * rows), ah / (1.12 * 10));
      const px = Math.min(PX_MAX, pw, ph);
      if (!best || px > best.px + 0.05) best = { cols, rows, g, px };
    }
    return best;
  }

  function layout(n, fmt) {
    fmt = fmt || DEFAULT_FMT[n];
    const F = FORMATS[fmt];
    if (!F || !SIZES.includes(n)) throw new Error('Unsupported sheet ' + n + '/' + fmt);
    const { W, H, m } = F;
    const fz = fit(n, F), { cols, rows, px } = fz;
    const r = +(px * 0.36).toFixed(2), py = px * 1.12, gap = 0.4 * px + 1.5;
    const inset = 4, mc = inset + m / 2;
    const L = { n, fmt, W, H, m, r, px, py, cols, rows, hdrH: F.gridTop - 4, nameY: F.ly1, small: px < 4.6, spec: { perPage: fmt, label: F.label, px }, bubbles: [], items: [], idCols: [[], []], text: [], lines: [] };
    L.markers = [[mc, mc], [W - mc, mc], [W - mc, H - mc], [mc, H - mc]];
    L.orient = { x: inset + m + 4, y: mc, s: 3 };
    L.titleAt = { x: inset + m + 8.5, y: mc + 1.3 };
    const ly1 = F.ly1, ly2 = F.ly2, half = (W - inset * 2) / 2;
    L.text.push({ x: inset + 2, y: ly1, s: 3, t: 'Name', w: 600 });
    L.lines.push([inset + 14, ly1 + 0.6, W - inset - 2, ly1 + 0.6]);
    L.text.push({ x: inset + 2, y: ly2, s: 3, t: 'Section', w: 600 });
    L.lines.push([inset + 17, ly2 + 0.6, inset + half - 4, ly2 + 0.6]);
    L.text.push({ x: inset + half + 2, y: ly2, s: 3, t: 'Date', w: 600 });
    L.lines.push([inset + half + 12, ly2 + 0.6, W - inset - 2, ly2 + 0.6]);
    L.text.push({ x: W - inset - m - 6, y: mc + 1.2, s: 3, t: 'Score  ____ / ' + n, w: 600, a: 'end', score: true });
    const gridTop = F.gridTop;
    const classW = 2 * px, colW = LW + 5 * px;
    const total = classW + cols * (gap + colW);
    const x0 = (W - total) / 2;
    const rowY = i => gridTop + i * py + (rows > 10 ? Math.floor(i / 5) * 1.2 : 0) + py / 2;
    L.text.push({ x: x0 + classW / 2, y: gridTop - 2.4, s: 2.3, t: 'Class no.', w: 700, a: 'middle' });
    for (let j = 0; j < 2; j++) for (let d = 0; d < 10; d++) {
      const b = { kind: 'id', col: j, val: d, x: x0 + px / 2 + j * px, y: gridTop + d * py + py / 2, r, lab: String(d) };
      L.bubbles.push(b); L.idCols[j].push(b);
    }
    const ns = Math.min(2.7, Math.max(2, px * 0.5));
    for (let c = 0; c < cols; c++) {
      const cx = x0 + classW + gap + c * (colW + gap);
      for (let i = 0; i < rows; i++) {
        const q = c * rows + i + 1;
        if (q > n) break;
        const y = rowY(i);
        L.text.push({ x: cx + LW - 0.8, y, s: ns, t: String(q), w: 700, a: 'end', mid: true });
        const row = [];
        for (let k = 0; k < 5; k++) {
          const b = { kind: 'item', q, opt: k, x: cx + LW + px / 2 + k * px, y, r, lab: LET[k] };
          L.bubbles.push(b); row.push(b);
        }
        L.items[q - 1] = row;
      }
    }
    L.brand = { x: W - inset - m - 6, y: mc + 5.2, s: 2.2, t: APP };
    L.footer = { x: W - inset - m - 8, y: H - mc + 0.8, s: 2.2, t: 'Shade one circle fully. Erase cleanly.', a: 'end' };
    // layout code: anchor bit + 4 bits for the layout number, printed beside the bottom-left square
    const idx = codeFor(n, fmt);
    L.code = { id: idx, s: 2.6, pos: [0, 1, 2, 3, 4].map(i => [inset + m + 4 + i * 4.2, H - mc]), bits: [1, (idx >> 3) & 1, (idx >> 2) & 1, (idx >> 1) & 1, idx & 1] };
    return L;
  }

  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // One slip as SVG (mm user units). fill: optional map q -> opt index or 'id' digits for previews.
  function slipSVG(L, title, opts = {}) {
    const f = 'font-family="Helvetica,Arial,sans-serif"';
    let s = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${L.W} ${L.H}" width="${opts.width || L.W + 'mm'}" ${opts.height ? `height="${opts.height}"` : opts.width ? "" : `height="${L.H}mm"`}>`;
    s += `<rect width="${L.W}" height="${L.H}" fill="#fff"/>`;
    for (const [x, y] of L.markers) s += `<rect x="${x - L.m / 2}" y="${y - L.m / 2}" width="${L.m}" height="${L.m}" fill="#000"/>`;
    const o = L.orient; s += `<rect x="${o.x - o.s / 2}" y="${o.y - o.s / 2}" width="${o.s}" height="${o.s}" fill="#000"/>`;
    s += `<text x="${L.titleAt.x}" y="${L.titleAt.y}" font-size="3.6" font-weight="700" ${f}>${esc(trimTitle(title, L))}</text>`;
    for (const t of L.text) s += `<text x="${t.x}" y="${t.y}" font-size="${t.s}" font-weight="${t.w || 400}" ${t.a ? `text-anchor="${t.a}"` : ''} ${t.mid ? 'dominant-baseline="central"' : ''} ${f}>${esc(tx(t, L, opts.total))}</text>`;
    for (const [a, b, c, d] of L.lines) s += `<line x1="${a}" y1="${b}" x2="${c}" y2="${d}" stroke="#000" stroke-width="0.25"/>`;
    const br = L.brand; s += `<text x="${br.x}" y="${br.y}" font-size="${br.s}" text-anchor="end" fill="#777" ${f}>${esc(br.t)}</text>`;
    L.code.pos.forEach(([x, y], i) => { if (L.code.bits[i]) s += `<rect x="${x - L.code.s / 2}" y="${y - L.code.s / 2}" width="${L.code.s}" height="${L.code.s}" fill="#000"/>`; });
    const ft = L.footer; s += `<text x="${ft.x}" y="${ft.y}" font-size="${ft.s}" text-anchor="end" fill="#444" ${f}>${esc(ft.t)}</text>`;
    for (const b of L.bubbles) {
      s += `<circle cx="${b.x}" cy="${b.y}" r="${b.r}" fill="#fff" stroke="#222" stroke-width="0.3"/>`;
      s += `<text x="${b.x}" y="${b.y}" font-size="${(b.r * 1.15).toFixed(2)}" fill="#9a9a9a" text-anchor="middle" dominant-baseline="central" ${f}>${b.lab}</text>`;
    }
    return s + '</svg>';
  }
  const tx = (t, L, total) => t.score && total ? 'Score  ____ / ' + total : t.t;
  function trimTitle(t, L) {
    t = String(t || '').trim() || 'Answer sheet';
    const max = Math.floor((L.W - 50) / 2.1);
    return t.length > max ? t.slice(0, max - 1) + '…' : t;
  }

  // Draw slips onto a jsPDF doc.
  function drawPDF(doc, L, title, paper, pages, total) {
    doc.setProperties({ title: title + ' answer sheets', creator: APP });
    const P = paper === 'a4' ? [210, 297] : [215.9, 279.4];
    const per = L.fmt;
    const cells = per === 4 ? [[0, 0], [1, 0], [0, 1], [1, 1]] : per === 2 ? [[0, 0], [0, 1]] : [[0, 0]];
    const cw = per === 4 ? P[0] / 2 : P[0], ch = per === 1 ? P[1] : P[1] / 2;
    for (let p = 0; p < pages; p++) {
      if (p) doc.addPage();
      // cut lines
      doc.setLineDashPattern([1.5, 1.5], 0); doc.setDrawColor(170); doc.setLineWidth(0.2);
      if (per === 4) { doc.line(P[0] / 2, 0, P[0] / 2, P[1]); doc.line(0, P[1] / 2, P[0], P[1] / 2); }
      if (per === 2) doc.line(0, P[1] / 2, P[0], P[1] / 2);
      doc.setLineDashPattern([], 0);
      for (const [ci, cj] of cells) {
        const ox = ci * cw + (cw - L.W) / 2, oy = cj * ch + (ch - L.H) / 2;
        drawSlip(doc, L, title, ox, oy, total);
      }
    }
  }
  const PT = mm => mm / 0.3528;
  function drawSlip(doc, L, title, ox, oy, total) {
    doc.setFillColor(0); doc.setDrawColor(0);
    for (const [x, y] of L.markers) doc.rect(ox + x - L.m / 2, oy + y - L.m / 2, L.m, L.m, 'F');
    const o = L.orient; doc.rect(ox + o.x - o.s / 2, oy + o.y - o.s / 2, o.s, o.s, 'F');
    doc.setTextColor(0); doc.setFont('helvetica', 'bold'); doc.setFontSize(PT(3.6));
    doc.text(trimTitle(title, L), ox + L.titleAt.x, oy + L.titleAt.y);
    for (const t of L.text) {
      doc.setFont('helvetica', (t.w || 400) >= 600 ? 'bold' : 'normal'); doc.setFontSize(PT(t.s));
      const al = t.a === 'end' ? 'right' : t.a === 'middle' ? 'center' : 'left';
      doc.text(tx(t, L, total), ox + t.x, oy + t.y, { align: al, baseline: t.mid ? 'middle' : 'alphabetic' });
    }
    doc.setLineWidth(0.25);
    for (const [a, b, c, d] of L.lines) doc.line(ox + a, oy + b, ox + c, oy + d);
    const ft = L.footer; doc.setFont('helvetica', 'normal'); doc.setFontSize(PT(ft.s)); doc.setTextColor(70);
    doc.text(ft.t, ox + ft.x, oy + ft.y, { align: 'right' });
    doc.setFillColor(0); L.code.pos.forEach(([x, y], i) => { if (L.code.bits[i]) doc.rect(ox + x - L.code.s / 2, oy + y - L.code.s / 2, L.code.s, L.code.s, 'F'); });
    doc.setTextColor(119); doc.setFontSize(PT(L.brand.s)); doc.text(L.brand.t, ox + L.brand.x, oy + L.brand.y, { align: 'right' });
    doc.setLineWidth(0.3); doc.setDrawColor(34);
    for (const b of L.bubbles) {
      doc.circle(ox + b.x, oy + b.y, b.r, 'S');
    }
    doc.setTextColor(154); doc.setFontSize(PT(b0(L).r * 1.15));
    for (const b of L.bubbles) doc.text(b.lab, ox + b.x, oy + b.y, { align: 'center', baseline: 'middle' });
    doc.setTextColor(0);
  }
  const b0 = L => L.bubbles[0];

  /* ---------- Image processing ---------- */
  function grayFromImageData(id) {
    const d = id.data, n = id.width * id.height, g = new Uint8ClampedArray(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) g[i] = (d[j] * 77 + d[j + 1] * 150 + d[j + 2] * 29) >> 8;
    return { g, w: id.width, h: id.height };
  }

  function binarize(G) {
    const { g, w, h } = G, I = new Uint32Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
      let row = 0;
      for (let x = 0; x < w; x++) { row += g[y * w + x]; I[(y + 1) * (w + 1) + x + 1] = I[y * (w + 1) + x + 1] + row; }
    }
    const hw = Math.max(8, Math.floor(Math.min(w, h) / 14)), bin = new Uint8Array(w * h), t = 0.18;
    for (let y = 0; y < h; y++) {
      const y1 = Math.max(0, y - hw), y2 = Math.min(h - 1, y + hw);
      for (let x = 0; x < w; x++) {
        const x1 = Math.max(0, x - hw), x2 = Math.min(w - 1, x + hw);
        const cnt = (x2 - x1 + 1) * (y2 - y1 + 1);
        const sum = I[(y2 + 1) * (w + 1) + x2 + 1] - I[y1 * (w + 1) + x2 + 1] - I[(y2 + 1) * (w + 1) + x1] + I[y1 * (w + 1) + x1];
        if (g[y * w + x] * cnt <= sum * (1 - t) && g[y * w + x] < 160) bin[y * w + x] = 1;
      }
    }
    return bin;
  }

  function components(bin, w, h, minA, maxA) {
    const lab = new Int32Array(w * h), stack = new Int32Array(w * h), out = [];
    let id = 0;
    for (let s = 0; s < w * h; s++) {
      if (!bin[s] || lab[s]) continue;
      id++;
      let sp = 0; stack[sp++] = s; lab[s] = id;
      const c = { n: 0, sx: 0, sy: 0, ext: [[1e9, 0], [-1e9, 0], [0, 1e9], [0, -1e9], null, null, null, null], es: [1e9, -1e9, 1e9, -1e9] };
      let minx = 1e9, maxx = -1, miny = 1e9, maxy = -1;
      const P = new Array(8);
      while (sp) {
        const p = stack[--sp], x = p % w, y = (p - x) / w;
        c.n++; c.sx += x; c.sy += y;
        if (x < minx) { minx = x; P[0] = [x, y]; } if (x > maxx) { maxx = x; P[1] = [x, y]; }
        if (y < miny) { miny = y; P[2] = [x, y]; } if (y > maxy) { maxy = y; P[3] = [x, y]; }
        const a = x + y, b = x - y;
        if (a < c.es[0]) { c.es[0] = a; P[4] = [x, y]; } if (a > c.es[1]) { c.es[1] = a; P[5] = [x, y]; }
        if (b < c.es[2]) { c.es[2] = b; P[6] = [x, y]; } if (b > c.es[3]) { c.es[3] = b; P[7] = [x, y]; }
        if (c.n > maxA * 1.5) { /* keep labelling but it will be rejected */ }
        if (x > 0 && bin[p - 1] && !lab[p - 1]) { lab[p - 1] = id; stack[sp++] = p - 1; }
        if (x < w - 1 && bin[p + 1] && !lab[p + 1]) { lab[p + 1] = id; stack[sp++] = p + 1; }
        if (y > 0 && bin[p - w] && !lab[p - w]) { lab[p - w] = id; stack[sp++] = p - w; }
        if (y < h - 1 && bin[p + w] && !lab[p + w]) { lab[p + w] = id; stack[sp++] = p + w; }
      }
      if (c.n < minA || c.n > maxA) continue;
      const bw = maxx - minx + 1, bh = maxy - miny + 1;
      if (bw / bh > 2.2 || bh / bw > 2.2) continue;
      const cx = c.sx / c.n, cy = c.sy / c.n;
      const pts = P.slice().sort((p, q) => Math.atan2(p[1] - cy, p[0] - cx) - Math.atan2(q[1] - cy, q[0] - cx));
      let area = 0;
      for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
      area = Math.abs(area) / 2 + (bw + bh); // add half-perimeter for pixel extents
      const sol = c.n / area;
      if (sol < 0.82 || sol > 1.3) continue;
      out.push({ x: cx, y: cy, a: c.n, sol });
    }
    return out;
  }

  function orderCW(p) {
    const cx = (p[0].x + p[1].x + p[2].x + p[3].x) / 4, cy = (p[0].y + p[1].y + p[2].y + p[3].y) / 4;
    return p.slice().sort((a, b) => Math.atan2(a.y - cy, a.x - cx) - Math.atan2(b.y - cy, b.x - cx));
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

  function pickQuad(cands, L) {
    const C = cands;
    const found = [];
    for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) for (let k = j + 1; k < C.length; k++) for (let l = k + 1; l < C.length; l++) {
      const q = [C[i], C[j], C[k], C[l]];
      const amin = Math.min(q[0].a, q[1].a, q[2].a, q[3].a), amax = Math.max(q[0].a, q[1].a, q[2].a, q[3].a);
      if (amax / amin > 3.6) continue;
      const o = orderCW(q);
      // convexity
      let sign = 0, ok = true;
      for (let t = 0; t < 4; t++) {
        const a = o[t], b = o[(t + 1) % 4], c = o[(t + 2) % 4];
        const cr = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
        if (!sign) sign = Math.sign(cr); else if (Math.sign(cr) !== sign) { ok = false; break; }
      }
      if (!ok) continue;
      const s0 = dist(o[0], o[1]), s1 = dist(o[1], o[2]), s2 = dist(o[2], o[3]), s3 = dist(o[3], o[0]);
      if (Math.max(s0, s2) / Math.min(s0, s2) > 1.7 || Math.max(s1, s3) / Math.min(s1, s3) > 1.7) continue;
      // edge lengths measured in marker widths must match the template (perspective-local scale)
      const sz = o.map(p => Math.sqrt(p.a));
      const e0 = s0 / ((sz[0] + sz[1]) / 2), e1 = s1 / ((sz[1] + sz[2]) / 2), e2 = s2 / ((sz[2] + sz[3]) / 2), e3 = s3 / ((sz[3] + sz[0]) / 2);
      const tw = (L.W - 2 * L.markers[0][0]) / L.m, th = (L.H - 2 * L.markers[0][1]) / L.m;
      const fit = (a, b, c, d) => Math.max(Math.abs(Math.log(a / tw)), Math.abs(Math.log(c / tw)), Math.abs(Math.log(b / th)), Math.abs(Math.log(d / th)));
      const dr = Math.min(fit(e0, e1, e2, e3), fit(e1, e0, e3, e2));
      if (dr > 0.25) continue;
      let angOk = true;
      for (let t = 0; t < 4; t++) {
        const a = o[(t + 3) % 4], b = o[t], c = o[(t + 1) % 4];
        const v1x = a.x - b.x, v1y = a.y - b.y, v2x = c.x - b.x, v2y = c.y - b.y;
        const cos = (v1x * v2x + v1y * v2y) / (Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y));
        if (Math.abs(cos) > 0.5) { angOk = false; break; }
      }
      if (!angOk) continue;
      let area = 0;
      for (let t = 0; t < 4; t++) { const a = o[t], b = o[(t + 1) % 4]; area += a.x * b.y - b.x * a.y; }
      area = Math.abs(area) / 2;
      found.push({ o, score: area * Math.exp(-8 * dr), ids: [i, j, k, l] });
    }
    return found.sort((a, b) => b.score - a.score);
  }

  function homography(src, dst) { // src [[x,y]] -> dst [[u,v]]
    const A = [], b = [];
    for (let i = 0; i < 4; i++) {
      const [x, y] = src[i], [u, v] = dst[i];
      A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); b.push(u);
      A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); b.push(v);
    }
    for (let c = 0; c < 8; c++) {
      let p = c; for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      for (let r = 0; r < 8; r++) if (r !== c) {
        const f = A[r][c] / A[c][c];
        for (let k = c; k < 8; k++) A[r][k] -= f * A[c][k];
        b[r] -= f * b[c];
      }
    }
    const h = b.map((v, i) => v / A[i][i]);
    return (x, y) => { const d = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d]; };
  }

  function bil(G, x, y) {
    const { g, w, h } = G;
    if (x < 0 || y < 0 || x >= w - 1 || y >= h - 1) return 255;
    const x0 = x | 0, y0 = y | 0, fx = x - x0, fy = y - y0, i = y0 * w + x0;
    return (g[i] * (1 - fx) + g[i + 1] * fx) * (1 - fy) + (g[i + w] * (1 - fx) + g[i + w + 1] * fx) * fy;
  }

  function pct(vals, p) { const a = Float64Array.from(vals).sort(); return a[Math.min(a.length - 1, Math.floor(p * a.length))]; }

  function darkAt(G, H, x, y, rad) { // via homography, template mm
    const inner = [], paper = [];
    for (let dy = -rad; dy <= rad; dy += rad / 3) for (let dx = -rad; dx <= rad; dx += rad / 3) if (dx * dx + dy * dy <= rad * rad) { const [u, v] = H(x + dx, y + dy); inner.push(bil(G, u, v)); }
    for (let dy = -6; dy <= 6; dy += 1) for (let dx = -6; dx <= 6; dx += 1) { const [u, v] = H(x + dx, y + dy); paper.push(bil(G, u, v)); }
    const m = inner.reduce((a, b) => a + b, 0) / inner.length, p = pct(paper, 0.9);
    return 1 - m / Math.max(p, 1);
  }

  function rectify(G, H, L, s) {
    const w = Math.round(L.W * s), h = Math.round(L.H * s), g = new Uint8ClampedArray(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const [u, v] = H((x + 0.5) / s, (y + 0.5) / s); g[y * w + x] = bil(G, u, v); }
    return { g, w, h, s };
  }

  function readBubble(R, b) {
    const { g, w, h, s } = R, cx = b.x * s, cy = b.y * s, rad = b.r * 0.62 * s;
    let sum = 0, n = 0;
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad || x < 0 || y < 0 || x >= w || y >= h) continue;
      sum += g[y * w + x]; n++;
    }
    const hs = Math.round(7 * s), hist = new Uint32Array(256); let cnt = 0;
    for (let y = Math.max(0, Math.round(cy - hs)); y < Math.min(h, cy + hs); y += 2) for (let x = Math.max(0, Math.round(cx - hs)); x < Math.min(w, cx + hs); x += 2) { hist[g[y * w + x]]++; cnt++; }
    let acc = 0, paper = 255; const target = cnt * 0.9;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= target) { paper = v; break; } }
    b._paper = paper;
    const d = Math.max(0, Math.min(1, 1 - (sum / Math.max(n, 1)) / Math.max(paper, 1)));
    // coverage: share of the inside that is actually dark. Solid shading is even (high);
    // a handwritten letter over correction fluid is thin strokes on white (low).
    let dark = 0; const cut = paper * (1 - Math.max(0.12, d * 0.5));
    for (let y = Math.floor(cy - rad); y <= cy + rad; y++) for (let x = Math.floor(cx - rad); x <= cx + rad; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > rad * rad || x < 0 || y < 0 || x >= w || y >= h) continue;
      if (g[y * w + x] < cut) dark++;
    }
    b._cov = dark / Math.max(n, 1);
    return d;
  }

  // An X drawn over a bubble leaves strokes running out past the circle on the diagonals,
  // while a normal (even messy) shading spills evenly or not at all.
  function crossed(R, b) {
    const { g, w, h, s } = R, paper = Math.max(b._paper || 255, 1);
    const dk = (x, y) => { const X = Math.round(x * s), Y = Math.round(y * s); return X < 0 || Y < 0 || X >= w || Y >= h ? 0 : 1 - g[Y * w + X] / paper; };
    const ray = (deg, r0, r1) => { const a = deg * Math.PI / 180; let m = 0; for (let d = r0; d <= r1; d += 0.15) m = Math.max(m, dk(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d)); return m; };
    const sector = (c, half, r0, r1) => { let m = 0; for (let d = -half; d <= half; d += 4) m = Math.max(m, ray(c + d, r0, r1)); return m; };
    const diag = [45, 135, 225, 315].map(d => sector(d, 22, b.r + 0.45, b.r + 1.5)), axis = [0, 90, 180, 270].map(d => sector(d, 8, b.r + 0.45, b.r + 0.85));
    const nd = diag.filter(v => v > 0.28).length, na = axis.filter(v => v > 0.3).length;
    return nd >= 3 && na <= 1;
  }

  function ringScore(R, L) {
    const { g, w, h, s } = R; let tot = 0, n = 0;
    for (const b of L.bubbles) {
      for (let t = 0; t < 12; t++) {
        const an = t * Math.PI / 6; let mn = 255;
        for (let dr = -0.5; dr <= 0.5; dr += 0.25) {
          const x = Math.round((b.x + Math.cos(an) * (b.r + dr)) * s), y = Math.round((b.y + Math.sin(an) * (b.r + dr)) * s);
          if (x >= 0 && y >= 0 && x < w && y < h) mn = Math.min(mn, g[y * w + x]);
        }
        const ox = Math.round((b.x + Math.cos(an) * (b.r + 1.2)) * s), oy = Math.round((b.y + Math.sin(an) * (b.r + 1.2)) * s);
        const out = ox >= 0 && oy >= 0 && ox < w && oy < h ? g[oy * w + ox] : 255;
        tot += 1 - mn / Math.max(out, 1); n++;
      }
    }
    return tot / n;
  }

  // An X drawn inside a shaded circle (pen over pencil): both diagonals darker than the rest of the fill
  function crossedInside(R, b) {
    const { g, w, h, s } = R, paper = Math.max(b._paper || 255, 1);
    const dk = (x, y) => { const X = Math.round(x * s), Y = Math.round(y * s); return X < 0 || Y < 0 || X >= w || Y >= h ? 0 : 1 - g[Y * w + X] / paper; };
    const ray = deg => { const a = deg * Math.PI / 180; let t = 0, n = 0; for (let d = b.r * 0.2; d <= b.r * 0.8; d += 0.12) { let m = 0; for (let o = -6; o <= 6; o += 3) { const aa = a + o * Math.PI / 180; m = Math.max(m, dk(b.x + Math.cos(aa) * d, b.y + Math.sin(aa) * d)); } t += m; n++; } return t / n; };
    const off = deg => { const a = deg * Math.PI / 180; let t = 0, n = 0; for (let d = b.r * 0.35; d <= b.r * 0.8; d += 0.12) { t += dk(b.x + Math.cos(a) * d, b.y + Math.sin(a) * d); n++; } return t / n; };
    const lineA = (ray(45) + ray(225)) / 2, lineB = (ray(135) + ray(315)) / 2;
    const base = (off(0) + off(90) + off(180) + off(270)) / 4;
    return lineA > base + 0.13 && lineB > base + 0.13 && Math.min(lineA, lineB) > 0.45;
  }

  function decide(ds, globalBase) {
    const sorted = ds.slice().sort((a, b) => a - b);
    let base = sorted[Math.floor((ds.length - 1) / 2)];
    if (base > 0.3) base = Math.min(base, globalBase);
    const c = ds.map(d => d - base), cmax = Math.max(...c);
    let marked = [];
    ds.forEach((d, i) => { if (c[i] >= 0.17 && d >= 0.25) marked.push(i); });
    if (marked.length > 1) marked = marked.filter(i => c[i] >= 0.55 * cmax);
    const rest = c.filter((_, i) => !marked.includes(i));
    const restMax = rest.length ? Math.max(...rest) : 0;
    const amb = (!marked.length && cmax >= 0.09) || (marked.length === 1 && restMax >= 0.14);
    return { marked, amb };
  }

  function readSheet(R, L) {
    const dv = new Map(); const all = [];
    for (const b of L.bubbles) { const d = readBubble(R, b); dv.set(b, d); all.push(d); }
    const gb = pct(all, 0.5);
    const answers = [], flags = [], ambItems = [];
    const crossedItems = [], rewrittenItems = [];
    L.items.forEach((row, qi) => {
      const ds = row.map(b => dv.get(b));
      const xs = row.map((b, i) => ds[i] > gb + 0.08 && (crossed(R, b) || crossedInside(R, b)));
      let r = decide(ds, gb);
      // a bubble with only a rewritten letter (thin strokes, often on correction fluid) is not an answer
      // when another bubble in the row is solidly shaded
      const maxCov = Math.max(...row.map((b, i) => ds[i] > gb + 0.17 ? b._cov : 0));
      const sparse = row.map((b, i) => ds[i] > gb + 0.08 && b._cov < 0.88 && b._cov <= maxCov - 0.1), solid = row.map((b, i) => ds[i] > gb + 0.17 && b._cov >= 0.93);
      if (sparse.some(Boolean) && solid.some(Boolean) && r.marked.length > 1) {
        const r3 = decide(ds.map((d, i) => sparse[i] ? gb : d), gb);
        if (r3.marked.length >= 1) { r = r3; rewrittenItems.push(qi + 1); }
      }
      if (xs.some(Boolean)) {
        // ignore crossed-out bubbles, but only when another real mark remains
        const r2 = decide(ds.map((d, i) => xs[i] ? gb : d), gb);
        if (r2.marked.length >= 1 && r2.marked.every(i => !xs[i])) { r = r2; crossedItems.push(qi + 1); }
        else if (r.marked.length === 1) r.amb = true; // a lone mark that may be crossed out: let the teacher check
      }
      answers[qi] = r.marked.map(i => LET[i]).join('');
      if (r.amb) ambItems.push(qi + 1);
    });
    const digits = L.idCols.map(col => decide(col.map(b => dv.get(b)), gb));
    let classNo = null, idNote = '';
    if (digits.every(d => d.marked.length === 1)) classNo = digits[0].marked[0] * 10 + digits[1].marked[0];
    else if (digits[0].marked.length === 0 && digits[1].marked.length === 1) { classNo = digits[1].marked[0]; idNote = 'Only one class-no. digit shaded'; }
    else idNote = digits.some(d => d.marked.length > 1) ? 'Class no. has extra marks' : 'Class no. not shaded';
    if (idNote) flags.push(idNote);
    const multi = answers.map((a, i) => a.length > 1 ? i + 1 : 0).filter(Boolean);
    if (multi.length) flags.push('Multiple marks: item ' + multi.join(', '));
    if (crossedItems.length) flags.push('Crossed-out mark ignored: item ' + crossedItems.join(', '));
    if (rewrittenItems.length) flags.push('Rewritten letter ignored: item ' + rewrittenItems.join(', '));
    if (ambItems.length) flags.push('Faint or erased marks: item ' + ambItems.join(', '));
    return { answers, classNo, flags, ambItems, multi, d: L.bubbles.map(b => +dv.get(b).toFixed(3)) };
  }

  // Main entry: ImageData of a photo or scan -> list of slips read (several slips per photo allowed)
  // Heavy image work, done once per photo and reused for every layout tried
  function prepare(imageData) {
    const G = grayFromImageData(imageData);
    const area = G.w * G.h;
    const bin = binarize(G);
    const cands = components(bin, G.w, G.h, Math.max(40, area * 0.00003), area * 0.02).sort((a, b) => b.a - a.a).slice(0, 34);
    return { G, area, cands };
  }
  // Cheap alignment check straight from the photo (no full rectification)
  function ringScoreH(G, H, L) {
    let tot = 0, n = 0;
    for (const b of L.bubbles) {
      for (let t = 0; t < 12; t++) {
        const an = t * Math.PI / 6, c = Math.cos(an), sn = Math.sin(an); let mn = 255;
        for (let dr = -0.5; dr <= 0.5; dr += 0.25) { const [u, v] = H(b.x + c * (b.r + dr), b.y + sn * (b.r + dr)); mn = Math.min(mn, bil(G, u, v)); }
        const [ou, ov] = H(b.x + c * (b.r + 1.2), b.y + sn * (b.r + 1.2));
        tot += 1 - mn / Math.max(bil(G, ou, ov), 1); n++;
      }
    }
    return tot / n;
  }
  function readCode(G, H, L) {
    const d = L.code.pos.map(([x, y]) => darkAt(G, H, x, y, 0.8));
    if (d[0] < 0.5) return null; // no code printed (older sheets) or not readable
    if (d.some(x => x > 0.2 && x < 0.5)) return null; // smudged or misaligned: do not trust
    let v = 0; for (let i = 1; i < 5; i++) v = v * 2 + (d[i] >= 0.5 ? 1 : 0);
    return v >= 1 && v <= 15 ? v : null;
  }
  function layoutFromCode(v) { if (v >= 13) return { n: 40, fmt: FMTS[v - 13] }; const f = FMTS[Math.floor((v - 1) / 4)], n = OLD[(v - 1) % 4]; return f && n ? { n, fmt: f } : null; }
  function scan(imageData, L, prep) {
    prep = prep || prepare(imageData);
    const { G, area } = prep, cands = prep.cands.slice();
    const quads = pickQuad(cands, L);
    const marks = cands.map(c => [Math.round(c.x), Math.round(c.y), c.a]);
    if (!quads.length) return { ok: false, marks, error: 'Could not find the four corner squares. Fit the whole slip in the photo, flat and well lit.' };
    const used = new Set(), slips = []; let sawWrong = false, foundCode = null;
    let tries = 0;
    for (const qd of quads) {
      if (slips.length >= 8 || tries > 30) break;
      if (qd.ids.some(i => used.has(i))) continue;
      tries++;
      const quad = qd.o, tpl = L.markers;
      let best = null;
      for (let k = 0; k < 4; k++) {
        const img = [0, 1, 2, 3].map(i => quad[(i + k) % 4]);
        const H = homography(tpl, img.map(p => [p.x, p.y]));
        const top = dist(img[0], img[1]) + dist(img[3], img[2]), left = dist(img[0], img[3]) + dist(img[1], img[2]);
        const pen = Math.abs(Math.log((top / left) / ((L.W - 2 * tpl[0][0]) / (L.H - 2 * tpl[0][1]))));
        const dk = darkAt(G, H, L.orient.x, L.orient.y, L.orient.s * 0.35);
        const score = dk - 0.6 * pen;
        if (!best || score > best.score) best = { H, score, dk, pen, img };
      }
      if (best.dk < 0.25 || best.pen > 0.3) { sawWrong = true; continue; }
      const code = readCode(G, best.H, L);
      if (code !== null && code !== L.code.id) { sawWrong = true; foundCode = code; continue; }
      if (ringScoreH(G, best.H, L) < (code === null ? 0.3 : 0.12)) { sawWrong = true; continue; }
      const R = rectify(G, best.H, L, L.small ? 8 : 6);
      qd.ids.forEach(i => used.add(i));
      const cx = quad.reduce((a, p) => a + p.x, 0) / 4, cy = quad.reduce((a, p) => a + p.y, 0) / 4;
      slips.push(Object.assign({ ok: true, rect: R, cx, cy, quad: best.img.map(p => [Math.round(p.x), Math.round(p.y)]) }, readSheet(R, L)));
    }
    if (!slips.length) return { ok: false, marks, detected: foundCode ? layoutFromCode(foundCode) : null, error: sawWrong ? 'Found corner squares, but not a ' + L.n + '-item sheet. Check that this slip matches the assessment.' : 'Could not find the four corner squares. Fit the whole slip in the photo, flat and well lit.' };
    // reading order: top to bottom, then left to right
    slips.sort((a, b) => Math.abs(a.cy - b.cy) > 0.25 * Math.sqrt(area) / 2 ? a.cy - b.cy : a.cx - b.cx);
    return { ok: true, slips, marks };
  }

  return { prepare, APP, FORMATS, FMTS, DEFAULT_FMT, SIZES, fit, LET, layout, slipSVG, drawPDF, scan, esc, _ring: ringScore };
})();
