import { Router } from 'express';
import * as fleetController from './fleetController.js';
import { authenticate } from '../../middleware/authenticate.js';
import { authorize } from '../../middleware/authorize.js';

const router = Router();

// ------------------------------------------------------------------------------
// FLEETOPS REAL-TIME TELEMETRY & COMPATIBILITY ENDPOINTS (No blocking auth required)
// ------------------------------------------------------------------------------
router.get('/vehicles/live', fleetController.getLiveVehiclesTelemetry);
router.get('/trips/active', fleetController.getActiveTripsTelemetry);
router.get('/trip/:tripId/route', fleetController.getTripRoute);
router.get('/trip/:tripId/eta', fleetController.getTripEta);
router.post('/trip/start', fleetController.startTripCompat);
router.post('/location/update', fleetController.recordLocation);
router.get('/dispatches/active', fleetController.getActiveTripsTelemetry);
router.get('/analytics/dashboard', fleetController.getFleetAnalytics);
router.get('/notifications', fleetController.getFleetNotifications);
router.post('/integration/system', fleetController.systemIntegration);

// ------------------------------------------------------------------------------
// AUTHENTICATED MANAGEMENT ENDPOINTS
// ------------------------------------------------------------------------------
router.use(authenticate);

// Vehicles
router.get('/vehicles', fleetController.getVehicles);
router.get('/vehicles/:id', fleetController.getVehicle);
router.post('/vehicles', authorize(['superadmin', 'fleet_manager']), fleetController.createVehicle);
router.put('/vehicles/:id', authorize(['superadmin', 'fleet_manager']), fleetController.updateVehicle);

// Drivers
router.get('/drivers', fleetController.getDrivers);
router.post('/drivers', authorize(['superadmin', 'fleet_manager', 'hr_admin']), fleetController.registerDriver);

// Dispatches
router.get('/dispatches', fleetController.getDispatches);
router.get('/dispatches/:id', fleetController.getDispatch);
router.patch('/dispatches/:id/assign', authorize(['superadmin', 'fleet_manager']), fleetController.assignDispatch);
router.post('/dispatches/:id/start', authorize(['superadmin', 'fleet_manager', 'driver']), fleetController.startDispatch);
router.post('/dispatches/:id/complete', authorize(['superadmin', 'fleet_manager', 'driver']), fleetController.completeDispatch);

// Fuel & Trip Expenses
router.get('/fuel', fleetController.getFuel);
router.post('/fuel', authorize(['superadmin', 'fleet_manager', 'driver']), fleetController.logFuel);

// Live GPS Location Tracking
router.post('/location', authorize(['superadmin', 'fleet_manager', 'driver']), fleetController.recordLocation);
router.get('/dispatches/:dispatchId/locations', fleetController.getRouteLocations);

export default router;
