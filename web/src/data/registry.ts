import { SEED_DRIVERS, SEED_VEHICLES } from './seed.ts';
import type { Driver, Profile, Vehicle } from './types.ts';

// Replacement boundary: a future approved CSDD provider implements this interface.
export interface DriverRegistry {
  getDriver(driverId: string): Promise<Driver | null>;
  getVehiclesByDriver(driverId: string): Promise<Vehicle[]>;
  getProfile(driverId: string): Promise<Profile | null>;
}

// CSDD-style mock: reads only local synthetic seed data, no network.
export function createCsddMockRegistry(
  drivers: Driver[] = SEED_DRIVERS,
  vehicles: Vehicle[] = SEED_VEHICLES,
): DriverRegistry {
  const getDriver = async (driverId: string) =>
    drivers.find((d) => d.id === driverId) ?? null;

  const getVehiclesByDriver = async (driverId: string) =>
    vehicles.filter((v) => v.ownerDriverId === driverId);

  return {
    getDriver,
    getVehiclesByDriver,
    async getProfile(driverId) {
      const driver = await getDriver(driverId);
      if (!driver) return null;
      return { driver, vehicles: await getVehiclesByDriver(driverId) };
    },
  };
}
