// Encoded polyline (the common Google format), precision 5 = about 1 m.

export type PolylinePoint = [lat: number, lon: number];

const PRECISION = 1e5;

function encodeValue(v: number): string {
  let n = v < 0 ? ~(v << 1) : v << 1;
  let out = '';
  while (n >= 0x20) {
    out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>= 5;
  }
  return out + String.fromCharCode(n + 63);
}

export function encodePolyline(points: PolylinePoint[]): string {
  let lat = 0;
  let lon = 0;
  let out = '';
  for (const [a, b] of points) {
    const la = Math.round(a * PRECISION);
    const lo = Math.round(b * PRECISION);
    out += encodeValue(la - lat) + encodeValue(lo - lon);
    lat = la;
    lon = lo;
  }
  return out;
}

// Throws on malformed input, so validation can reject a corrupt route.
export function decodePolyline(encoded: string): PolylinePoint[] {
  const points: PolylinePoint[] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  const next = () => {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      if (i >= encoded.length) throw new Error('truncated polyline');
      byte = encoded.charCodeAt(i++) - 63;
      if (byte < 0 || byte > 63) throw new Error('invalid polyline character');
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < encoded.length) {
    lat += next();
    lon += next();
    points.push([lat / PRECISION, lon / PRECISION]);
  }
  return points;
}
