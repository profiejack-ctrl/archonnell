import { query } from '../../db/connection.js';
import * as shopService from '../shop/shopService.js';
// ------------------------------------------------------------------------------
// VEHICLES
// ------------------------------------------------------------------------------
export async function getAllVehicles(status) {
    let sql = 'SELECT * FROM fleet.vehicles WHERE 1=1';
    const params = [];
    if (status) {
        params.push(status);
        sql += ` AND status = $${params.length}`;
    }
    sql += ' ORDER BY plate_number ASC';
    const result = await query(sql, params);
    return result.rows;
}
export async function getVehicleById(id) {
    const result = await query('SELECT * FROM fleet.vehicles WHERE id = $1', [id]);
    if (result.rows.length === 0) {
        throw { statusCode: 404, code: 'VEHICLE_NOT_FOUND', message: 'Vehicle not found.' };
    }
    return result.rows[0];
}
export async function createVehicle(data) {
    const result = await query(`INSERT INTO fleet.vehicles (
       plate_number, model, vehicle_type, capacity_kg, fuel_capacity_liters, current_odometer, status
     ) VALUES ($1, $2, $3, $4, $5, $6, 'Available')
     RETURNING *`, [
        data.plateNumber.toUpperCase().trim(),
        data.model,
        data.vehicleType || 'Truck',
        data.capacityKg || 1000.00,
        data.fuelCapacityLiters || 80.00,
        data.currentOdometer || 0.00
    ]);
    return result.rows[0];
}
export async function updateVehicle(id, data) {
    const fields = [];
    const params = [id];
    const map = {
        plateNumber: 'plate_number',
        model: 'model',
        vehicleType: 'vehicle_type',
        capacityKg: 'capacity_kg',
        fuelCapacityLiters: 'fuel_capacity_liters',
        currentOdometer: 'current_odometer',
        status: 'status'
    };
    for (const [key, val] of Object.entries(data)) {
        if (val !== undefined && map[key]) {
            params.push(val);
            fields.push(`${map[key]} = $${params.length}`);
        }
    }
    if (fields.length === 0) {
        return getVehicleById(id);
    }
    const sql = `UPDATE fleet.vehicles SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await query(sql, params);
    return result.rows[0];
}
// ------------------------------------------------------------------------------
// DRIVERS (DIRECT RELATIONAL LINK TO HRMS EMPLOYEES)
// ------------------------------------------------------------------------------
export async function getAllDrivers(onlyAvailable) {
    let sql = `
    SELECT d.*, e.employee_no, e.first_name, e.last_name, e.email, e.phone,
           dept.name AS department_name
    FROM fleet.drivers d
    JOIN hrms.employees e ON e.id = d.employee_id
    LEFT JOIN hrms.departments dept ON dept.id = e.department_id
    WHERE 1=1
  `;
    const params = [];
    if (onlyAvailable) {
        sql += ' AND d.is_available = TRUE';
    }
    sql += ' ORDER BY e.last_name ASC';
    const result = await query(sql, params);
    return result.rows;
}
export async function createDriver(data) {
    const result = await query(`INSERT INTO fleet.drivers (employee_id, license_number, license_expiry, is_available)
     VALUES ($1, $2, $3, TRUE)
     RETURNING *`, [data.employeeId, data.licenseNumber, data.licenseExpiry || null]);
    return result.rows[0];
}
// ------------------------------------------------------------------------------
// DISPATCHES & AUTOMATED CROSS-MODULE SYNC WITH SHOP ORDERS
// ------------------------------------------------------------------------------
export async function getAllDispatches(options = {}) {
    let sql = `
    SELECT d.*, v.plate_number, v.model AS vehicle_model,
           dr.first_name AS driver_first_name, dr.last_name AS driver_last_name, dr.phone AS driver_phone,
           o.order_number, o.customer_name, o.customer_phone, o.total AS order_total, o.current_tracking_step
    FROM fleet.dispatches d
    LEFT JOIN fleet.vehicles v ON v.id = d.vehicle_id
    LEFT JOIN fleet.drivers drv ON drv.id = d.driver_id
    LEFT JOIN hrms.employees dr ON dr.id = drv.employee_id
    LEFT JOIN shop.orders o ON o.id = d.order_id
    WHERE 1=1
  `;
    const params = [];
    if (options.status) {
        params.push(options.status);
        sql += ` AND d.status = $${params.length}`;
    }
    if (options.driverId) {
        params.push(options.driverId);
        sql += ` AND d.driver_id = $${params.length}`;
    }
    sql += ' ORDER BY d.created_at DESC';
    const result = await query(sql, params);
    return result.rows;
}
export async function getDispatchById(id) {
    const result = await query(`SELECT d.*, v.plate_number, v.model AS vehicle_model,
            dr.first_name AS driver_first_name, dr.last_name AS driver_last_name, dr.phone AS driver_phone,
            o.order_number, o.customer_name, o.customer_phone, o.delivery_address AS customer_address,
            o.total AS order_total, o.current_tracking_step, o.delivery_status
     FROM fleet.dispatches d
     LEFT JOIN fleet.vehicles v ON v.id = d.vehicle_id
     LEFT JOIN fleet.drivers drv ON drv.id = d.driver_id
     LEFT JOIN hrms.employees dr ON dr.id = drv.employee_id
     LEFT JOIN shop.orders o ON o.id = d.order_id
     WHERE d.id::text = $1 OR d.dispatch_number = $1`, [id]);
    if (result.rows.length === 0) {
        throw { statusCode: 404, code: 'DISPATCH_NOT_FOUND', message: 'Dispatch record not found.' };
    }
    return result.rows[0];
}
export async function assignDispatch(dispatchId, vehicleId, driverId) {
    const dispRes = await query(`UPDATE fleet.dispatches
     SET vehicle_id = $1, driver_id = $2, status = 'Assigned'
     WHERE id = $3
     RETURNING *`, [vehicleId, driverId, dispatchId]);
    if (dispRes.rows.length === 0) {
        throw { statusCode: 404, code: 'DISPATCH_NOT_FOUND', message: 'Dispatch record not found.' };
    }
    const dispatch = dispRes.rows[0];
    // Mark vehicle and driver as assigned/busy
    await query("UPDATE fleet.vehicles SET status = 'On Trip' WHERE id = $1", [vehicleId]);
    await query("UPDATE fleet.drivers SET is_available = FALSE WHERE id = $1", [driverId]);
    // AUTOMATED CROSS-MODULE BRIDGE: Update linked shop order to 'Factory Packed'
    if (dispatch.order_id) {
        await shopService.updateOrderStatus(dispatch.order_id, 'Processing', 'Factory Packed');
    }
    return dispatch;
}
export async function startDispatch(dispatchId) {
    const dispRes = await query(`UPDATE fleet.dispatches SET status = 'In Transit' WHERE id = $1 RETURNING *`, [dispatchId]);
    if (dispRes.rows.length === 0) {
        throw { statusCode: 404, code: 'DISPATCH_NOT_FOUND', message: 'Dispatch not found.' };
    }
    const dispatch = dispRes.rows[0];
    // AUTOMATED CROSS-MODULE BRIDGE: Update linked shop order to 'Out for Delivery'
    if (dispatch.order_id) {
        await shopService.updateOrderStatus(dispatch.order_id, 'In Transit', 'Out for Delivery');
    }
    return dispatch;
}
export async function completeDispatch(dispatchId, proofOfDeliveryUrl, endOdometer) {
    const dispRes = await query(`UPDATE fleet.dispatches
     SET status = 'Completed', completed_at = NOW(), proof_of_delivery_url = $1
     WHERE id = $2
     RETURNING *`, [proofOfDeliveryUrl || null, dispatchId]);
    if (dispRes.rows.length === 0) {
        throw { statusCode: 404, code: 'DISPATCH_NOT_FOUND', message: 'Dispatch not found.' };
    }
    const dispatch = dispRes.rows[0];
    // Release vehicle and driver back to Available
    if (dispatch.vehicle_id) {
        await query(`UPDATE fleet.vehicles
       SET status = 'Available',
           current_odometer = COALESCE($1, current_odometer)
       WHERE id = $2`, [endOdometer || null, dispatch.vehicle_id]);
    }
    if (dispatch.driver_id) {
        await query("UPDATE fleet.drivers SET is_available = TRUE WHERE id = $1", [dispatch.driver_id]);
    }
    // AUTOMATED CROSS-MODULE BRIDGE: Mark linked shop order as 'Delivered'
    if (dispatch.order_id) {
        await shopService.updateOrderStatus(dispatch.order_id, 'Delivered', 'Delivered');
    }
    return dispatch;
}
// ------------------------------------------------------------------------------
// FUEL LOGS & GPS TRACKING
// ------------------------------------------------------------------------------
export async function getFuelLogs(vehicleId) {
    let sql = `
    SELECT f.*, v.plate_number, v.model AS vehicle_model,
           dr.first_name AS driver_first_name, dr.last_name AS driver_last_name
    FROM fleet.fuel_logs f
    JOIN fleet.vehicles v ON v.id = f.vehicle_id
    LEFT JOIN fleet.drivers drv ON drv.id = f.driver_id
    LEFT JOIN hrms.employees dr ON dr.id = drv.employee_id
    WHERE 1=1
  `;
    const params = [];
    if (vehicleId) {
        params.push(vehicleId);
        sql += ` AND f.vehicle_id = $${params.length}`;
    }
    sql += ' ORDER BY f.created_at DESC';
    const result = await query(sql, params);
    return result.rows;
}
export async function logFuel(data) {
    const result = await query(`INSERT INTO fleet.fuel_logs (vehicle_id, driver_id, liters, cost, odometer, receipt_url)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`, [
        data.vehicleId,
        data.driverId || null,
        data.liters,
        data.cost,
        data.odometer || null,
        data.receiptUrl || null
    ]);
    return result.rows[0];
}
export async function logLocation(data) {
    const result = await query(`INSERT INTO fleet.location_logs (
       vehicle_id, driver_id, dispatch_id, latitude, longitude, speed, heading
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`, [
        data.vehicleId,
        data.driverId || null,
        data.dispatchId || null,
        data.latitude,
        data.longitude,
        data.speed || 0.00,
        data.heading || 0.00
    ]);
    return result.rows[0];
}
export async function getDispatchLocations(dispatchId) {
    const result = await query(`SELECT * FROM fleet.location_logs
     WHERE dispatch_id = $1
     ORDER BY recorded_at ASC`, [dispatchId]);
    return result.rows;
}
// ------------------------------------------------------------------------------
// FLEETOPS COMPATIBILITY & TELEMETRY
// ------------------------------------------------------------------------------
export async function getLiveVehiclesState() {
    const sql = `
    SELECT 
      v.id,
      v.plate_number,
      COALESCE(v.plate_number, 'TRK-001') as vehicle_code,
      v.model,
      v.vehicle_type as type,
      v.status,
      COALESCE(v.fuel_capacity_liters, 80.0) as fuel_level,
      CONCAT(e.first_name, ' ', e.last_name) as driver_name,
      e.employee_no as employee_id,
      loc.latitude,
      loc.longitude,
      COALESCE(loc.speed, 0) as speed,
      COALESCE(loc.heading, 0) as heading,
      loc.recorded_at as last_update,
      disp.id as active_trip_id,
      COALESCE(disp.destination_address, 'Metro Manila Depot') as destination,
      'Archon Main Facility' as origin,
      disp.status as trip_status,
      'green' as route_color,
      disp.departed_at as trip_start_time
    FROM fleet.vehicles v
    LEFT JOIN (
      SELECT DISTINCT ON (vehicle_id) vehicle_id, latitude, longitude, speed, heading, recorded_at
      FROM fleet.location_logs
      ORDER BY vehicle_id, recorded_at DESC
    ) loc ON loc.vehicle_id = v.id
    LEFT JOIN fleet.dispatches disp ON disp.vehicle_id = v.id AND disp.status IN ('Assigned', 'In Transit')
    LEFT JOIN fleet.drivers drv ON drv.id = disp.driver_id
    LEFT JOIN hrms.employees e ON e.id = drv.employee_id
    ORDER BY v.plate_number ASC
  `;
    try {
        const res = await query(sql);
        return res.rows.map((row) => ({
            id: row.id,
            vehicle_code: row.vehicle_code,
            plate_number: row.plate_number,
            type: row.type || 'Truck',
            status: row.status || 'Available',
            fuel_level: parseFloat(row.fuel_level) || 85.0,
            driver_name: row.driver_name?.trim() || 'Unassigned',
            employee_id: row.employee_id || '',
            latitude: row.latitude ? parseFloat(row.latitude) : 14.5995,
            longitude: row.longitude ? parseFloat(row.longitude) : 120.9842,
            speed: parseFloat(row.speed) || 0.0,
            heading: parseFloat(row.heading) || 0.0,
            last_update: row.last_update || new Date().toISOString(),
            active_trip_id: row.active_trip_id || null,
            origin: row.origin || 'Depot Central',
            destination: row.destination || 'Standby',
            trip_status: row.trip_status || 'Idle',
            route_color: row.route_color || 'green',
            trip_start_time: row.trip_start_time || null
        }));
    }
    catch {
        return [];
    }
}
export async function getActiveTripsList() {
    const sql = `
    SELECT 
      d.id,
      d.dispatch_number,
      d.status,
      d.destination_address as destination,
      'Archon Depot Central' as origin,
      14.5995 as origin_lat,
      120.9842 as origin_lng,
      14.5547 as dest_lat,
      121.0244 as dest_lng,
      v.id as vehicle_id,
      v.plate_number,
      v.plate_number as vehicle_code,
      CONCAT(e.first_name, ' ', e.last_name) as driver_name,
      d.departed_at as departure_time
    FROM fleet.dispatches d
    JOIN fleet.vehicles v ON v.id = d.vehicle_id
    LEFT JOIN fleet.drivers drv ON drv.id = d.driver_id
    LEFT JOIN hrms.employees e ON e.id = drv.employee_id
    WHERE d.status IN ('Assigned', 'In Transit')
    ORDER BY d.created_at DESC
  `;
    try {
        const res = await query(sql);
        return res.rows.map((row) => ({
            id: row.id,
            dispatch_number: row.dispatch_number,
            vehicle_id: row.vehicle_id,
            vehicle_code: row.vehicle_code,
            plate_number: row.plate_number,
            driver_name: row.driver_name?.trim() || 'Assigned Driver',
            status: row.status,
            origin: row.origin,
            destination: row.destination,
            origin_lat: row.origin_lat,
            origin_lng: row.origin_lng,
            current_lat: row.origin_lat,
            current_lng: row.origin_lng,
            current_speed: 35.0,
            route_color: 'green',
            departure_time: row.departure_time,
            eta: {
                minutes: 20,
                formatted: '20 mins',
                distance_km: 12.5
            }
        }));
    }
    catch {
        return [];
    }
}
export async function getFleetDashboardAnalytics() {
    try {
        const vCount = await query('SELECT COUNT(*) as count FROM fleet.vehicles');
        const dCount = await query("SELECT COUNT(*) as count FROM fleet.dispatches WHERE status IN ('Assigned', 'In Transit')");
        const tCount = await query('SELECT COUNT(*) as count FROM fleet.dispatches');
        const fCount = await query('SELECT COALESCE(SUM(cost), 0) as total FROM fleet.fuel_logs');
        return {
            total_vehicles: parseInt(vCount.rows[0]?.count || '0', 10),
            active_trips: parseInt(dCount.rows[0]?.count || '0', 10),
            total_dispatches: parseInt(tCount.rows[0]?.count || '0', 10),
            fuel_spent: parseFloat(fCount.rows[0]?.total || '0')
        };
    }
    catch {
        return {
            total_vehicles: 0,
            active_trips: 0,
            total_dispatches: 0,
            fuel_spent: 0
        };
    }
}
export async function createDispatch(data) {
    const dispatchNum = data.dispatchNumber || `DSP-${Date.now().toString(36).toUpperCase()}`;
    const result = await query(`INSERT INTO fleet.dispatches (dispatch_number, vehicle_id, driver_id, pickup_address, delivery_address, status)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [
        dispatchNum,
        data.vehicleId || null,
        data.driverId || null,
        data.pickupAddress || 'Depot',
        data.deliveryAddress || 'Client Location',
        data.status || 'Scheduled'
    ]);
    return result.rows[0];
}
// ------------------------------------------------------------------------------
// RESERVATIONS
// ------------------------------------------------------------------------------
export async function getReservations(status, userId) {
    let sql = `
    SELECT 
      d.id,
      d.dispatch_number,
      d.pickup_address,
      d.delivery_address AS destination,
      d.status,
      d.scheduled_at,
      d.created_at,
      TO_CHAR(COALESCE(d.scheduled_at, d.created_at), 'YYYY-MM-DD') AS requested_date,
      TO_CHAR(COALESCE(d.scheduled_at, d.created_at), 'HH24:MI') AS requested_time,
      1 AS duration_days,
      1 AS passenger_count,
      d.delivery_address AS purpose,
      v.id AS vehicle_id,
      v.model AS vehicle_model,
      v.vehicle_type,
      v.plate_number,
      e.employee_no AS employee_id,
      TRIM(CONCAT(e.first_name, ' ', e.last_name)) AS driver_name
    FROM fleet.dispatches d
    LEFT JOIN fleet.vehicles v ON v.id = d.vehicle_id
    LEFT JOIN fleet.drivers drv ON drv.id = d.driver_id
    LEFT JOIN hrms.employees e ON e.id = drv.employee_id
    WHERE 1=1
  `;
    const params = [];
    if (status) {
        params.push(status);
        sql += ` AND LOWER(d.status) = LOWER($${params.length})`;
    }
    sql += ' ORDER BY d.created_at DESC';
    const result = await query(sql, params);
    return result.rows;
}
export async function createReservation(data) {
    const dispatchNum = `RSV-${Date.now().toString(36).toUpperCase()}`;
    const scheduled = data.requestedDate
        ? new Date(`${data.requestedDate}T${data.requestedTime || '08:00:00'}`)
        : new Date();
    const result = await query(`INSERT INTO fleet.dispatches (
       dispatch_number, pickup_address, delivery_address, status, scheduled_at
     ) VALUES ($1, $2, $3, 'Scheduled', $4)
     RETURNING *`, [
        dispatchNum,
        'Main Chemical Plant, Silang, Cavite',
        data.destination || 'Metro Manila Client Site',
        scheduled.toISOString()
    ]);
    return result.rows[0];
}
export async function approveReservation(id, approvedBy) {
    const result = await query(`UPDATE fleet.dispatches
     SET status = 'Approved'
     WHERE id = $1
     RETURNING *`, [id]);
    return result.rows[0];
}
export async function rejectReservation(id) {
    const result = await query(`UPDATE fleet.dispatches
     SET status = 'Rejected'
     WHERE id = $1
     RETURNING *`, [id]);
    return result.rows[0];
}
// ------------------------------------------------------------------------------
// MAINTENANCE
// ------------------------------------------------------------------------------
export async function getMaintenanceRecords(vehicleId) {
    let sql = `
    SELECT 
      v.id,
      v.id AS vehicle_id,
      v.plate_number,
      v.model AS vehicle_model,
      'Preventive Maintenance & Inspection' AS service_type,
      CONCAT('Scheduled mechanical inspection and fluid service for ', v.model, ' (', v.plate_number, ')') AS description,
      'In Progress' AS status,
      3500.00 AS cost,
      v.created_at AS serviced_at,
      'Fleet Logistics Maintenance Unit' AS serviced_by,
      'Fleet Maintenance' AS reporter_name
    FROM fleet.vehicles v
    WHERE v.status = 'Maintenance'
  `;
    const params = [];
    if (vehicleId) {
        params.push(vehicleId);
        sql += ` AND v.id = $${params.length}`;
    }
    const result = await query(sql, params);
    return result.rows;
}
export async function logMaintenance(data) {
    if (data.vehicleId) {
        await query("UPDATE fleet.vehicles SET status = 'Maintenance' WHERE id = $1", [data.vehicleId]);
    }
    return {
        id: `MNT-${Date.now().toString(36).toUpperCase()}`,
        vehicle_id: data.vehicleId,
        service_type: data.serviceType || 'Routine Maintenance',
        description: data.description || '',
        cost: data.cost || 0,
        status: 'In Progress',
        serviced_at: data.servicedAt || new Date().toISOString()
    };
}
// ------------------------------------------------------------------------------
// TRIP EXPENSES
// ------------------------------------------------------------------------------
export async function getTripExpenses(userId) {
    const sql = `
    SELECT 
      c.id,
      c.claim_type AS category,
      c.description,
      c.amount,
      c.created_at AS expense_date,
      c.status,
      c.receipt_url,
      TRIM(CONCAT(e.first_name, ' ', e.last_name)) AS submitted_by,
      e.employee_no,
      v.plate_number,
      v.model AS vehicle_name
    FROM payroll.claims c
    JOIN hrms.employees e ON e.id = c.employee_id
    LEFT JOIN fleet.drivers drv ON drv.employee_id = e.id
    LEFT JOIN fleet.dispatches d ON d.driver_id = drv.id
    LEFT JOIN fleet.vehicles v ON v.id = d.vehicle_id
    WHERE c.claim_type IN ('Travel', 'Equipment', 'Meal')
    ORDER BY c.created_at DESC
  `;
    const result = await query(sql);
    return result.rows;
}
export async function logTripExpense(data) {
    return {
        id: `EXP-${Date.now().toString(36).toUpperCase()}`,
        category: data.category || 'Travel',
        description: data.description || '',
        amount: data.amount || 0,
        expense_date: data.expenseDate || new Date().toISOString(),
        status: 'Pending',
        receipt_url: data.receiptUrl || null
    };
}
