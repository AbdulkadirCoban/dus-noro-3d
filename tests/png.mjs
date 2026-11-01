// Küçük yardımcı: PNG içinde sahnenin çizilip çizilmediğini ölçer (parlak piksel oranı)
import zlib from 'node:zlib';

export function PNG(buf) {
  let i = 8;
  let w = 0;
  let h = 0;
  let ct = 0;
  const idat = [];
  while (i < buf.length) {
    const len = buf.readUInt32BE(i);
    const type = buf.toString('latin1', i + 4, i + 8);
    const data = buf.subarray(i + 8, i + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); ct = data[9]; }
    if (type === 'IDAT') idat.push(data);
    i += 12 + len;
  }
  const bpp = ct === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = w * bpp;
  const prev = new Uint8Array(stride);
  const cur = new Uint8Array(stride);
  let pos = 0;
  let bright = 0;
  let total = 0;
  for (let y = 0; y < h; y++) {
    const f = raw[pos++];
    for (let x = 0; x < stride; x++) {
      const v = raw[pos++];
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev[x];
      const c = x >= bpp ? prev[x - bpp] : 0;
      let out = v;
      if (f === 1) out = v + a;
      else if (f === 2) out = v + b;
      else if (f === 3) out = v + ((a + b) >> 1);
      else if (f === 4) {
        const p = a + b - c;
        const pa = Math.abs(p - a);
        const pb = Math.abs(p - b);
        const pc = Math.abs(p - c);
        out = v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
      }
      cur[x] = out & 255;
    }
    // Üstteki düğme ve alttaki araç şeritleri sayılmaz
    if (y > h * 0.15 && y < h * 0.85) {
      for (let x = 0; x < stride; x += bpp) {
        total++;
        if (Math.max(cur[x], cur[x + 1], cur[x + 2]) > 90) bright++;
      }
    }
    prev.set(cur);
  }
  return +(bright / total).toFixed(4);
}
