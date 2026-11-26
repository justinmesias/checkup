/* CheckUP scan worker: reads bubble sheets off the main thread */
importScripts('engine.js');
self.onmessage = e => {
  const { id, data, w, h, n, fmt } = e.data;
  let res;
  try { res = Tsek.scan({ data, width: w, height: h }, Tsek.layout(n, fmt)); }
  catch (err) { res = { ok: false, error: String(err && err.message || err) }; }
  const transfer = res.ok ? res.slips.map(s => s.rect.g.buffer) : [];
  self.postMessage({ id, res }, transfer);
};
