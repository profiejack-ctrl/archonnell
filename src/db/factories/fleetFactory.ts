// ==============================================================================
// ARCHON NELL INCORPORATED - FLEET & LOGISTICS FACTORY & SEEDER
// Populates fleet.vehicles, drivers, dispatches, trip_records, location_logs, fuel_logs
// Direct Relational Integration with HRMS Employees & Shop Customer Orders
// ==============================================================================

import { query } from '../connection.js';
import { PHILIPPINE_VEHICLES, DELIVERY_ROUTE_WAYPOINTS } from './dataSets.js';
import { EmployeeRecord } from './hrmsFactory.js';
import { ShopOrderRecord } from './shopFactory.js';

export interface VehicleRecord {
  id: string;
  plateNumber: string;
  model: string;
  status: string;
  capacityKg: number;
}

export interface DriverRecord {
  id: string;
  employeeId: string;
  licenseNumber: string;
  isAvailable: boolean;
}

export async function seedFleet(
  employees: EmployeeRecord[],
  shopOrders: ShopOrderRecord[]
): Promise<{
  vehicles: VehicleRecord[];
  drivers: DriverRecord[];
}> {
  console.log('   ↳ [FleetFactory] Seeding commercial delivery vehicles...');
  const vehicles: VehicleRecord[] = [];

  for (const v of PHILIPPINE_VEHICLES) {
    const res = await query(
      `INSERT INTO fleet.vehicles (
         plate_number, model, vehicle_type, capacity_kg, fuel_capacity_liters,
         current_odometer, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (plate_number) DO UPDATE
       SET model = EXCLUDED.model,
           capacity_kg = EXCLUDED.capacity_kg,
           status = EXCLUDED.status
       RETURNING id, plate_number, model, status, capacity_kg`,
      [v.plateNumber, v.model, v.vehicleType, v.capacityKg, v.fuelCapacityLiters, v.currentOdometer, v.status]
    );

    vehicles.push({
      id: res.rows[0].id,
      plateNumber: res.rows[0].plate_number,
      model: res.rows[0].model,
      status: res.rows[0].status,
      capacityKg: Number(res.rows[0].capacity_kg)
    });
  }

  console.log('   ↳ [FleetFactory] Linking HRMS logistics drivers with commercial license records...');
  // Find drivers from HRMS employees list
  const driverEmployees = employees.filter(
    (e) => e.departmentCode === 'LOG' && (e.positionTitle.includes('Driver') || e.employeeNo.includes('0004'))
  );

  const drivers: DriverRecord[] = [];
  const licenseCodes = ['N02-05-998811', 'N03-12-445522', 'N01-18-774433', 'N04-20-112233'];
  const expiryDates = ['2029-05-15', '2028-11-20', '2029-02-28', '2028-08-10'];

  for (let i = 0; i < driverEmployees.length; i++) {
    const emp = driverEmployees[i];
    const licNo = licenseCodes[i % licenseCodes.length];
    const expDate = expiryDates[i % expiryDates.length];

    // Check if driver entry already exists
    const existing = await query('SELECT id FROM fleet.drivers WHERE employee_id = $1', [emp.id]);

    let driverId: string;
    if (existing.rows.length > 0) {
      driverId = existing.rows[0].id;
      await query(
        `UPDATE fleet.drivers SET license_number = $1, license_expiry = $2, is_available = TRUE WHERE id = $3`,
        [licNo, expDate, driverId]
      );
    } else {
      const res = await query(
        `INSERT INTO fleet.drivers (employee_id, license_number, license_expiry, is_available)
         VALUES ($1, $2, $3, TRUE)
         RETURNING id`,
        [emp.id, licNo, expDate]
      );
      driverId = res.rows[0].id;
    }

    drivers.push({
      id: driverId,
      employeeId: emp.id,
      licenseNumber: licNo,
      isAvailable: true
    });
  }

  console.log('   ↳ [FleetFactory] Seeding dispatches linked to customer shop orders...');
  const pickupAddress = "Archon Nell Main Chemical Plant, Governor's Drive, Silang, Cavite";
  const dispatches: Array<{ id: string; vehicleId: string; driverId: string; status: string }> = [];

  for (let i = 0; i < shopOrders.length; i++) {
    const order = shopOrders[i];
    const dispatchNo = `DSP-2026-${String(1001 + i).padStart(4, '0')}`;
    const vehicle = vehicles[i % vehicles.length];
    const driver = drivers[i % drivers.length];

    let dispatchStatus = 'Scheduled';
    if (order.deliveryStatus === 'Delivered') {
      dispatchStatus = 'Completed';
    } else if (order.deliveryStatus === 'Dispatched') {
      dispatchStatus = 'In Transit';
    } else if (order.deliveryStatus === 'Processing') {
      dispatchStatus = 'Assigned';
    }

    const scheduledAt = new Date('2026-10-15T08:00:00.000Z');
    scheduledAt.setHours(scheduledAt.getHours() + i * 4);

    const completedAt = dispatchStatus === 'Completed' ? new Date(scheduledAt.getTime() + 6 * 3600 * 1000).toISOString() : null;

    const res = await query(
      `INSERT INTO fleet.dispatches (
         dispatch_number, order_id, driver_id, vehicle_id, pickup_address,
         delivery_address, status, scheduled_at, completed_at, proof_of_delivery_url
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (dispatch_number) DO UPDATE
       SET order_id = EXCLUDED.order_id,
           driver_id = EXCLUDED.driver_id,
           vehicle_id = EXCLUDED.vehicle_id,
           status = EXCLUDED.status,
           completed_at = EXCLUDED.completed_at
       RETURNING id, vehicle_id, driver_id, status`,
      [
        dispatchNo,
        order.id,
        driver?.id || null,
        vehicle?.id || null,
        pickupAddress,
        order.deliveryAddress,
        dispatchStatus,
        scheduledAt.toISOString(),
        completedAt,
        dispatchStatus === 'Completed' ? 'https://cdn.archonnell.com/pod/receipt_sig_4482.png' : null
      ]
    );

    dispatches.push({
      id: res.rows[0].id,
      vehicleId: res.rows[0].vehicle_id,
      driverId: res.rows[0].driver_id,
      status: res.rows[0].status
    });
  }

  console.log('   ↳ [FleetFactory] Seeding trip records and odometer logs...');
  for (let i = 0; i < dispatches.length; i++) {
    const d = dispatches[i];
    if (['Completed', 'In Transit'].includes(d.status)) {
      const startOdo = 42000 + i * 250;
      const endOdo = d.status === 'Completed' ? startOdo + 78.5 : null;

      await query(
        `INSERT INTO fleet.trip_records (
           dispatch_id, vehicle_id, driver_id, start_odometer, end_odometer,
           start_time, end_time, notes
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          d.id,
          d.vehicleId,
          d.driverId,
          startOdo,
          endOdo,
          '2026-10-16T08:30:00.000Z',
          d.status === 'Completed' ? '2026-10-16T14:45:00.000Z' : null,
          'Delivery of palletized polymer mortars and 20L liquid waterproofing containers. Traffic normal on SLEX.'
        ]
      );
    }
  }

  console.log('   ↳ [FleetFactory] Seeding real-time GPS telemetry breadcrumbs along SLEX corridor...');
  const activeDispatch = dispatches.find((d) => d.status === 'In Transit') || dispatches[0];

  for (let idx = 0; idx < DELIVERY_ROUTE_WAYPOINTS.length; idx++) {
    const wp = DELIVERY_ROUTE_WAYPOINTS[idx];
    const timestamp = new Date('2026-10-16T09:00:00.000Z');
    timestamp.setMinutes(timestamp.getMinutes() + idx * 25);

    await query(
      `INSERT INTO fleet.location_logs (
         vehicle_id, driver_id, dispatch_id, latitude, longitude, speed, heading, recorded_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        activeDispatch.vehicleId,
        activeDispatch.driverId,
        activeDispatch.id,
        wp.lat,
        wp.lng,
        idx === 0 || idx === DELIVERY_ROUTE_WAYPOINTS.length - 1 ? 0.0 : 62.5,
        35.0,
        timestamp.toISOString()
      ]
    );
  }

  console.log('   ↳ [FleetFactory] Seeding commercial vehicle fuel logs...');
  const fuelLogsData = [
    {
      vehicleIdx: 0,
      driverIdx: 0,
      liters: 75.00,
      cost: 4725.00,
      odometer: 42100.00,
      receiptUrl: 'https://cdn.archonnell.com/fuel/shell_slex_mamplasan_receipt.pdf'
    },
    {
      vehicleIdx: 1,
      driverIdx: 1,
      liters: 85.00,
      cost: 5355.00,
      odometer: 58850.00,
      receiptUrl: 'https://cdn.archonnell.com/fuel/petron_cavitex_receipt.pdf'
    },
    {
      vehicleIdx: 2,
      driverIdx: 2,
      liters: 50.00,
      cost: 3150.00,
      odometer: 31400.00,
      receiptUrl: 'https://cdn.archonnell.com/fuel/caltex_c5_receipt.pdf'
    }
  ];

  for (const f of fuelLogsData) {
    const veh = vehicles[f.vehicleIdx] || vehicles[0];
    const drv = drivers[f.driverIdx] || drivers[0];

    await query(
      `INSERT INTO fleet.fuel_logs (vehicle_id, driver_id, liters, cost, odometer, receipt_url)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [veh.id, drv?.id || null, f.liters, f.cost, f.odometer, f.receiptUrl]
    );
  }

  console.log(`   ✅ [FleetFactory] Seeded ${vehicles.length} commercial vehicles, ${drivers.length} drivers, ${dispatches.length} dispatches, and ${DELIVERY_ROUTE_WAYPOINTS.length} GPS breadcrumb waypoints.`);
  return { vehicles, drivers };
}
