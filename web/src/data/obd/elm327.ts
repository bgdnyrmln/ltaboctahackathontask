// ELM327-style OBD-II adapter: a mock dongle for the demo and a tiny client.
// Only standard mode 01 PIDs; no VIN or fault codes are read (data minimisation).

export interface ObdTransport {
  send(command: string): Promise<string>; // raw reply, ends with '>' prompt
}

export interface VehicleState {
  speedKmh: number;
  rpm: number;
  throttlePct: number;
}

const hex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).toUpperCase().padStart(2, '0');

// Answers like a real ELM327 (echo off) from a scripted vehicle state.
export function createMockElm327(stateAt: () => VehicleState | null): ObdTransport {
  return {
    async send(raw) {
      const cmd = raw.replace(/\s+/g, '').toUpperCase();
      const reply = (body: string) => `${body}\r\r>`;
      if (cmd === 'ATZ') return reply('ELM327 v1.5 (DEMO MOCK)');
      if (cmd.startsWith('AT')) return reply('OK');
      const s = stateAt();
      if (!s) return reply('NO DATA');
      switch (cmd) {
        case '010D':
          return reply(`41 0D ${hex(s.speedKmh)}`);
        case '010C': {
          const v = Math.round(s.rpm * 4);
          return reply(`41 0C ${hex(v >> 8)} ${hex(v & 0xff)}`);
        }
        case '0111':
          return reply(`41 11 ${hex((s.throttlePct * 255) / 100)}`);
        default:
          return reply('NO DATA');
      }
    },
  };
}

export type PidValue =
  | { pid: 'speed'; value: number } // km/h
  | { pid: 'rpm'; value: number }
  | { pid: 'throttle'; value: number }; // %

// Parses a mode 01 reply; null for NO DATA, errors or unsupported PIDs.
export function parseObdReply(reply: string): PidValue | null {
  const bytes = reply
    .replace(/[\r>]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((b) => /^[0-9A-Fa-f]{2}$/.test(b))
    .map((b) => parseInt(b, 16));
  if (bytes.length < 3 || bytes[0] !== 0x41) return null;
  const [, pid, a, b] = bytes;
  if (pid === 0x0d) return { pid: 'speed', value: a };
  if (pid === 0x0c && b !== undefined) return { pid: 'rpm', value: (256 * a + b) / 4 };
  if (pid === 0x11) return { pid: 'throttle', value: Math.round((a * 100) / 255) };
  return null;
}

export async function initAdapter(t: ObdTransport): Promise<void> {
  for (const cmd of ['ATZ', 'ATE0', 'ATL0', 'ATSP0']) await t.send(cmd);
}

export async function readSpeed(t: ObdTransport): Promise<number | null> {
  const v = parseObdReply(await t.send('010D'));
  return v?.pid === 'speed' ? v.value : null;
}
