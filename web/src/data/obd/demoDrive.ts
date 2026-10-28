// A short scripted city drive read through the mock ELM327, end to end:
// dongle -> PID replies -> samples -> TripSummary. Used for the "connect your
// car" demo; clearly labelled as a mock.
import { aggregateTrip } from './aggregate.ts';
import type { SpeedSample } from './aggregate.ts';
import { createMockElm327, initAdapter, readSpeed } from './elm327.ts';
import type { VehicleState } from './elm327.ts';
import type { TripSummary } from '../trips/types.ts';

export const OBD_DEMO_LABEL = 'Demo OBD dongle (simulated, no car connected)';

// Speed in km/h per second: city 50 zone with a speeding stretch and one hard stop.
export function demoSpeedProfile(): number[] {
  const p: number[] = [];
  const ramp = (from: number, to: number, secs: number) => {
    for (let i = 1; i <= secs; i++) p.push(from + ((to - from) * i) / secs);
  };
  const hold = (v: number, secs: number) => {
    for (let i = 0; i < secs; i++) p.push(v);
  };
  hold(0, 5);
  ramp(0, 48, 12);
  hold(48, 90);
  ramp(48, 68, 10); // speeding in a 50 zone
  hold(68, 40);
  ramp(68, 0, 5); // hard stop: about -3.8 m/s²
  hold(0, 20);
  ramp(0, 45, 4); // hard start: about +3.1 m/s²
  hold(45, 120);
  ramp(45, 0, 15);
  hold(0, 3);
  return p;
}

export async function recordDemoDrive(opts: {
  driverId: string;
  vehicleId: string | null;
  startedAt: Date;
  profile?: number[];
}): Promise<TripSummary> {
  const profile = opts.profile ?? demoSpeedProfile();
  let second = 0;
  const state = (): VehicleState | null =>
    second < profile.length
      ? { speedKmh: profile[second], rpm: 800 + profile[second] * 40, throttlePct: 20 }
      : null;
  const dongle = createMockElm327(state);
  await initAdapter(dongle);

  const samples: SpeedSample[] = [];
  for (; second < profile.length; second++) {
    samples.push({ t: opts.startedAt.getTime() + second * 1000, speedKmh: await readSpeed(dongle) });
  }

  return aggregateTrip({
    id: `obd-${opts.driverId}-${opts.startedAt.getTime()}`,
    driverId: opts.driverId,
    vehicleId: opts.vehicleId,
    samples,
    limitKmh: () => 50, // OBD has no position; city default until GPS is approved
    speedLimitSource: 'road_type_default',
    source: 'obd_mock',
  });
}
