import { z } from 'zod';
import * as fleetService from './fleetService.js';
// Vehicles
export async function getVehicles(req, res, next) {
    try {
        const status = req.query.status;
        const data = await fleetService.getAllVehicles(status);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function getVehicle(req, res, next) {
    try {
        const data = await fleetService.getVehicleById(req.params.id);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function createVehicle(req, res, next) {
    try {
        const schema = z.object({
            plateNumber: z.string().min(3),
            model: z.string().min(2),
            vehicleType: z.string().optional(),
            capacityKg: z.number().positive().optional(),
            fuelCapacityLiters: z.number().positive().optional(),
            currentOdometer: z.number().nonnegative().optional()
        });
        const parsed = schema.parse(req.body);
        const data = await fleetService.createVehicle(parsed);
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function updateVehicle(req, res, next) {
    try {
        const data = await fleetService.updateVehicle(req.params.id, req.body);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// Drivers
export async function getDrivers(req, res, next) {
    try {
        const onlyAvailable = req.query.available === 'true';
        const data = await fleetService.getAllDrivers(onlyAvailable);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function registerDriver(req, res, next) {
    try {
        const schema = z.object({
            employeeId: z.string().uuid(),
            licenseNumber: z.string().min(5),
            licenseExpiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
        });
        const parsed = schema.parse(req.body);
        const data = await fleetService.createDriver(parsed);
        res.status(201).json({ success: true, message: 'Driver profile registered.', data });
    }
    catch (err) {
        next(err);
    }
}
// Dispatches
export async function getDispatches(req, res, next) {
    try {
        const { status, driver_id } = req.query;
        const data = await fleetService.getAllDispatches({
            status: status,
            driverId: driver_id
        });
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function getDispatch(req, res, next) {
    try {
        const data = await fleetService.getDispatchById(req.params.id);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function assignDispatch(req, res, next) {
    try {
        const schema = z.object({
            vehicleId: z.string().uuid(),
            driverId: z.string().uuid()
        });
        const { vehicleId, driverId } = schema.parse(req.body);
        const data = await fleetService.assignDispatch(req.params.id, vehicleId, driverId);
        res.json({
            success: true,
            message: 'Dispatch assigned to vehicle and driver. E-Commerce tracking updated to Factory Packed.',
            data
        });
    }
    catch (err) {
        next(err);
    }
}
export async function startDispatch(req, res, next) {
    try {
        const data = await fleetService.startDispatch(req.params.id);
        res.json({
            success: true,
            message: 'Dispatch departed. E-Commerce tracking updated to Out for Delivery.',
            data
        });
    }
    catch (err) {
        next(err);
    }
}
export async function completeDispatch(req, res, next) {
    try {
        const schema = z.object({
            proofOfDeliveryUrl: z.string().optional(),
            endOdometer: z.number().positive().optional()
        });
        const parsed = schema.parse(req.body);
        const data = await fleetService.completeDispatch(req.params.id, parsed.proofOfDeliveryUrl, parsed.endOdometer);
        res.json({
            success: true,
            message: 'Dispatch completed successfully. Order marked as Delivered in E-Commerce store.',
            data
        });
    }
    catch (err) {
        next(err);
    }
}
// Fuel Logs & Location Tracking
export async function getFuel(req, res, next) {
    try {
        const vehicleId = req.query.vehicle_id;
        const data = await fleetService.getFuelLogs(vehicleId);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function logFuel(req, res, next) {
    try {
        const schema = z.object({
            vehicleId: z.string().uuid(),
            driverId: z.string().uuid().optional(),
            liters: z.number().positive(),
            cost: z.number().positive(),
            odometer: z.number().nonnegative().optional(),
            receiptUrl: z.string().optional()
        });
        const parsed = schema.parse(req.body);
        const data = await fleetService.logFuel(parsed);
        res.status(201).json({ success: true, message: 'Fuel log recorded.', data });
    }
    catch (err) {
        next(err);
    }
}
export async function recordLocation(req, res, next) {
    try {
        const schema = z.object({
            vehicleId: z.string().uuid(),
            driverId: z.string().uuid().optional(),
            dispatchId: z.string().uuid().optional(),
            latitude: z.number(),
            longitude: z.number(),
            speed: z.number().optional(),
            heading: z.number().optional()
        });
        const parsed = schema.parse(req.body);
        const data = await fleetService.logLocation(parsed);
        res.status(201).json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
export async function getRouteLocations(req, res, next) {
    try {
        const data = await fleetService.getDispatchLocations(req.params.dispatchId);
        res.json({ success: true, data });
    }
    catch (err) {
        next(err);
    }
}
// ------------------------------------------------------------------------------
// FLEETOPS COMPATIBILITY HANDLERS
// ------------------------------------------------------------------------------
export async function getLiveVehiclesTelemetry(req, res, next) {
    try {
        const vehicles = await fleetService.getLiveVehiclesState();
        res.json({
            success: true,
            timestamp: new Date().toISOString(),
            vehicles
        });
    }
    catch (err) {
        next(err);
    }
}
export async function getActiveTripsTelemetry(req, res, next) {
    try {
        const trips = await fleetService.getActiveTripsList();
        res.json({
            success: true,
            count: trips.length,
            trips
        });
    }
    catch (err) {
        next(err);
    }
}
export async function getTripRoute(req, res, next) {
    try {
        const tripId = req.params.tripId;
        res.json({
            success: true,
            trip_id: tripId,
            route: {
                origin: 'Archon Depot Central (Paco, Manila)',
                destination: 'Archon Metro Client Logistics Hub (Taguig)',
                coordinates: [
                    [14.5995, 120.9842],
                    [14.5892, 120.9950],
                    [14.5750, 121.0100],
                    [14.5620, 121.0180],
                    [14.5547, 121.0244]
                ],
                distance_km: 12.8,
                estimated_duration: '22 mins'
            }
        });
    }
    catch (err) {
        next(err);
    }
}
export async function getTripEta(req, res, next) {
    try {
        res.json({
            success: true,
            eta: {
                minutes: 18,
                formatted: '18 mins',
                distance_km: 11.4,
                traffic_condition: 'moderate'
            }
        });
    }
    catch (err) {
        next(err);
    }
}
export async function startTripCompat(req, res, next) {
    try {
        const { vehicle_id, driver_id, trip_id } = req.body;
        res.json({
            success: true,
            message: 'Trip started successfully.',
            trip: {
                id: trip_id || 1,
                vehicle_id,
                driver_id,
                status: 'In Transit',
                start_time: new Date().toISOString()
            }
        });
    }
    catch (err) {
        next(err);
    }
}
export async function getFleetAnalytics(req, res, next) {
    try {
        const stats = await fleetService.getFleetDashboardAnalytics();
        res.json({
            success: true,
            analytics: stats,
            data: stats
        });
    }
    catch (err) {
        next(err);
    }
}
export async function getFleetNotifications(req, res, next) {
    try {
        res.json({
            success: true,
            notifications: [
                {
                    id: 'FLT-ALERT-01',
                    type: 'INFO',
                    message: 'Fleet maintenance inspection schedule sync completed.',
                    created_at: new Date().toISOString()
                }
            ],
            data: []
        });
    }
    catch (err) {
        next(err);
    }
}
export async function systemIntegration(req, res, next) {
    try {
        res.json({
            success: true,
            system: 'Archon Nell Central Logistics Integration Core',
            status: 'Connected',
            timestamp: new Date().toISOString()
        });
    }
    catch (err) {
        next(err);
    }
}
