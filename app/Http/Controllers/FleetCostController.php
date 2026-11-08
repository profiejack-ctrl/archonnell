<?php

namespace App\Http\Controllers;

use App\Models\Alert;
use App\Models\AuditLog;
use App\Models\Driver;
use App\Models\FuelLog;
use App\Models\MaintenanceRecord;
use App\Models\Vehicle;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class FleetCostController extends Controller
{
    public function storeFuelLog(Request $request): RedirectResponse
    {
        if ($request->user()->role !== 'Admin') {
            // Regular users act as the driver for their own fuel log. The user_id
            // records their account; do not let the browser assign another driver.
            $request->merge(['driver_id' => null]);
        }

        $data = $request->validate([
            'vehicle_id' => ['required', Rule::exists('vehicles', 'id')],
            'driver_id' => ['nullable', Rule::exists('drivers', 'id')],
            'liters' => ['required', 'numeric', 'min:0.1', 'max:2000'],
            'cost' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'fuel_level_before' => ['required', 'numeric', 'between:0,100'],
            'fuel_level_after' => ['required', 'numeric', 'between:0,100', 'gte:fuel_level_before'],
            'fuel_level_before_image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'fuel_level_after_image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'receipt_image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
            'logged_at' => ['required', 'date', 'before_or_equal:today'],
        ]);

        [$log, $vehicle, $fuelBeforeMismatch, $savedFuelLevel] = DB::transaction(function () use ($data, $request): array {
            $vehicle = Vehicle::whereKey($data['vehicle_id'])->lockForUpdate()->firstOrFail();
            $savedFuelLevel = (float) $vehicle->fuel_level;
            $fuelBefore = (float) $data['fuel_level_before'];

            $fuelBeforeMismatch = abs($fuelBefore - $savedFuelLevel) > 0.5;

            $data['fuel_level_before_image'] = $request->file('fuel_level_before_image')->store('fuel-logs/proofs', 'local');
            $data['fuel_level_after_image'] = $request->file('fuel_level_after_image')->store('fuel-logs/proofs', 'local');
            $data['receipt_image'] = $request->file('receipt_image')->store('fuel-logs/proofs', 'local');
            $data['user_id'] = $request->user()->id;

            $log = FuelLog::create($data);
            $vehicle->update(['fuel_level' => $data['fuel_level_after']]);

            return [$log, $vehicle, $fuelBeforeMismatch, $savedFuelLevel];
        });

        if ($fuelBeforeMismatch) {
            Alert::log('!', 'Fuel Reading Mismatch', sprintf(
                '%s before reading was entered as %.1f; the saved vehicle reading was %.1f. Please review the proof photos.',
                $vehicle->name ?? 'Vehicle',
                $log->fuel_level_before,
                $savedFuelLevel,
            ), 'warning');
        }

        $driver = isset($data['driver_id']) ? Driver::with('user')->find($data['driver_id']) : null;
        $driverName = $driver?->user?->name
            ?? $driver?->name
            ?? ($request->user()->role !== 'Admin' ? $request->user()->name : 'No driver assigned');

        Alert::log("\u{26FD}", 'Fuel Logged', sprintf(
            '%s: %.1fL logged for PHP %s by %s (driver: %s).',
            $vehicle->name ?? 'Vehicle',
            $log->liters,
            number_format($log->cost, 2),
            $request->user()->name,
            $driverName
        ));
        AuditLog::record($request, 'Fuel logged', 'Fuel & Costs', sprintf('Logged %.1fL for %s at PHP %s.', $log->liters, $vehicle->name ?? 'vehicle', number_format($log->cost, 2)));

        return back()->with('status', 'Fuel log recorded.');
    }

    public function showFuelProof(Request $request, FuelLog $fuelLog): BinaryFileResponse
    {
        $user = $request->user();
        abort_unless($user && ($user->role === 'Admin' || (int) $fuelLog->user_id === (int) $user->id), 404);
        $imagePath = match ($request->query('type', 'receipt')) {
            'before' => $fuelLog->fuel_level_before_image,
            'after' => $fuelLog->fuel_level_after_image,
            'receipt' => $fuelLog->receipt_image,
            default => null,
        };
        abort_unless($imagePath && Storage::disk('local')->exists($imagePath), 404);

        return response()->file(Storage::disk('local')->path($imagePath), [
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function storeMaintenance(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'vehicle_id' => ['required', Rule::exists('vehicles', 'id')],
            'description' => ['required', 'string', 'max:150'],
            'cost' => ['required', 'numeric', 'min:0', 'max:1000000'],
            'serviced_at' => ['required', 'date', 'before_or_equal:today'],
        ]);

        $record = MaintenanceRecord::create($data);
        $vehicle = Vehicle::find($data['vehicle_id']);

        Alert::log("\u{1F527}", 'Maintenance Logged', sprintf(
            '%s: %s (â‚±%s) logged by %s.',
            $vehicle->name ?? 'Vehicle',
            $record->description,
            number_format($record->cost, 2),
            $request->user()->name
        ), 'warning');
        AuditLog::record($request, 'Maintenance logged', 'Fuel & Costs', sprintf('Recorded %s maintenance for %s at PHP %s.', $record->description, $vehicle->name ?? 'vehicle', number_format($record->cost, 2)));

        return back()->with('status', 'Maintenance cost recorded.');
    }
}
