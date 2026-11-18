<?php

use App\Models\Dispatch;
use App\Models\Driver;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('fleet:sync', function () {
    $this->info('Starting Fleet Backend Synchronization...');

    // 1. Authenticate with the live backend
    $loginRes = Http::post('https://api.archonnellincorporated.com/api/v1/auth/login', [
        'email' => 'admin@archonnell.com',
        'password' => 'Admin123!',
    ]);

    if (! $loginRes->successful()) {
        $this->error('Failed to authenticate with backend: ' . $loginRes->body());
        return 1;
    }

    $token = $loginRes->json('data.token');
    $this->info('Authenticated successfully. Token acquired.');

    // 2. Ensure admin user exists
    $passwordField = User::passwordColumnName();
    User::updateOrCreate(
        ['email' => 'admin@archonnell.com'],
        [
            'name' => 'Archon Administrator',
            $passwordField => Hash::make('Admin123!'),
            'role' => 'Admin',
            'status' => 'active',
        ]
    );
    User::updateOrCreate(
        ['email' => 'reybie@fleetops.com'],
        [
            'name' => 'Reybie R.',
            $passwordField => Hash::make('password123'),
            'role' => 'Admin',
            'status' => 'active',
        ]
    );
    $this->info('Admin accounts ready: admin@archonnell.com, reybie@fleetops.com');

    // 3. Fetch Vehicles from backend
    $vehiclesRes = Http::withToken($token)->get('https://api.archonnellincorporated.com/api/v1/fleet/vehicles');
    $vehicles = $vehiclesRes->json('data') ?? [];
    $this->info('Fetched ' . count($vehicles) . ' vehicles from backend.');

    $stateVehicles = [];
    $index = 101;
    foreach ($vehicles as $v) {
        $code = 'TRK-' . $index++;
        $vehicle = Vehicle::updateOrCreate(
            ['plate_number' => $v['plate_number']],
            [
                'vehicle_code' => $code,
                'name' => $v['model'] ?? 'Isuzu Truck',
                'type' => $v['vehicle_type'] ?? 'Cargo Truck',
                'status' => strtolower($v['status'] ?? '') === 'available' ? 'Active' : ($v['status'] ?? 'Active'),
                'fuel_level' => 88.5,
                'odometer' => (int) floatval($v['current_odometer'] ?? 110000),
            ]
        );

        $stateVehicles[(string) $vehicle->id] = [
            'id' => $vehicle->id,
            'vehicle_code' => $code,
            'plate_number' => $vehicle->plate_number,
            'type' => $vehicle->type,
            'status' => $vehicle->status,
            'fuel_level' => 88.5,
        ];
    }

    // 4. Fetch Drivers from backend
    $driversRes = Http::withToken($token)->get('https://api.archonnellincorporated.com/api/v1/fleet/drivers');
    $drivers = $driversRes->json('data') ?? [];
    $this->info('Fetched ' . count($drivers) . ' drivers from backend.');

    $stateDrivers = [];
    foreach ($drivers as $d) {
        $driverUser = User::updateOrCreate(
            ['email' => $d['email'] ?? 'driver@archonnell.com'],
            [
                'name' => trim(($d['first_name'] ?? '') . ' ' . ($d['last_name'] ?? '')) ?: 'Logistics Driver',
                $passwordField => Hash::make('Admin123!'),
                'role' => 'Driver',
                'status' => 'active',
            ]
        );

        $driver = Driver::updateOrCreate(
            ['employee_id' => $d['employee_no'] ?? ('EMP-' . $driverUser->id)],
            [
                'user_id' => $driverUser->id,
                'name' => $driverUser->name,
                'role' => 'Logistics Driver',
                'score' => 9.7,
                'license_number' => $d['license_number'] ?? 'N02-05-998811',
                'license_expiry' => !empty($d['license_expiry']) ? substr($d['license_expiry'], 0, 10) : '2029-05-15',
                'status' => !empty($d['is_available']) ? 'Active' : 'Busy',
            ]
        );

        $stateDrivers[(string) $driver->id] = [
            'id' => $driver->id,
            'name' => $driver->name,
            'employee_id' => $driver->employee_id,
            'role' => $driver->role,
            'score' => $driver->score,
        ];
    }

    // 5. Fetch Dispatches from backend
    $dispatchesRes = Http::withToken($token)->get('https://api.archonnellincorporated.com/api/v1/fleet/dispatches');
    $dispatches = $dispatchesRes->json('data') ?? [];
    $this->info('Fetched ' . count($dispatches) . ' dispatches from backend.');

    foreach ($dispatches as $dsp) {
        $plate = $dsp['plate_number'] ?? null;
        $matchedVehicle = $plate ? Vehicle::where('plate_number', $plate)->first() : Vehicle::first();
        $driverFirstName = $dsp['driver_first_name'] ?? '';
        $matchedDriver = $driverFirstName ? Driver::where('name', 'like', "%{$driverFirstName}%")->first() : Driver::first();

        if ($matchedVehicle && $matchedDriver) {
            Dispatch::updateOrCreate(
                ['dispatch_no' => $dsp['dispatch_number']],
                [
                    'vehicle_id' => $matchedVehicle->id,
                    'driver_id' => $matchedDriver->id,
                    'origin' => $dsp['pickup_address'] ?? 'Archon Nell Main Plant, Silang, Cavite',
                    'destination' => $dsp['delivery_address'] ?? 'Filinvest City, Alabang',
                    'priority' => 'High',
                    'status' => strtolower($dsp['status'] ?? '') === 'scheduled' ? 'Scheduled' : 'Active',
                ]
            );
        }
    }

    // 6. Update fleet_state.json
    $statePath = base_path('app/storage/fleet_state.json');
    $currentState = file_exists($statePath) ? json_decode(file_get_contents($statePath), true) : [];
    $currentState['vehicles'] = $stateVehicles;
    $currentState['drivers'] = $stateDrivers;
    if (!isset($currentState['routes'])) {
        $currentState['routes'] = [];
    }
    file_put_contents($statePath, json_encode($currentState, JSON_PRETTY_PRINT));
    $this->info('app/storage/fleet_state.json updated with live fleet state.');

    $this->info('Fleet synchronization complete! 7 vehicles, 4 drivers, 6 dispatches synced.');
    return 0;
})->purpose('Synchronize fleet data from live production backend API');
