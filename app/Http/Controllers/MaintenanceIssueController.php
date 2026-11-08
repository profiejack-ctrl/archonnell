<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\MaintenanceIssue;
use App\Models\Vehicle;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class MaintenanceIssueController extends Controller
{
    private const STATUSES = ['Reported', 'In Progress', 'Waiting for Parts', 'Resolved'];

    public function store(Request $request, Vehicle $vehicle): RedirectResponse
    {
        abort_unless($request->user()?->role === 'Admin', 403);

        $data = $request->validate([
            'details' => ['required', 'string', 'max:5000'],
            'photo' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $issue = MaintenanceIssue::create([
            'vehicle_id' => $vehicle->id,
            'reported_by' => $request->user()->id,
            'details' => $data['details'],
            'photo_path' => $request->file('photo')?->store('maintenance-issues', 'local'),
            'status' => 'Reported',
        ]);

        AuditLog::record($request, 'Maintenance issue reported', 'Fleet', "Reported damage for {$vehicle->vehicle_code}: {$issue->details}");

        return back()->with('success', 'Maintenance issue reported for '.$vehicle->vehicle_code.'.');
    }

    public function update(Request $request, MaintenanceIssue $maintenanceIssue): RedirectResponse
    {
        abort_unless($request->user()?->role === 'Admin', 403);

        $data = $request->validate(['status' => ['required', Rule::in(self::STATUSES)]]);
        $previousStatus = $maintenanceIssue->status;
        $maintenanceIssue->status = $data['status'];
        $maintenanceIssue->resolved_at = $data['status'] === 'Resolved' ? now() : null;
        $maintenanceIssue->save();

        AuditLog::record($request, 'Maintenance status updated', 'Fleet', "Changed {$maintenanceIssue->vehicle?->vehicle_code} maintenance status from {$previousStatus} to {$maintenanceIssue->status}.");

        return back()->with('success', 'Maintenance status updated.');
    }

    public function photo(Request $request, MaintenanceIssue $maintenanceIssue): BinaryFileResponse
    {
        abort_unless($request->user(), 401);
        abort_unless($maintenanceIssue->photo_path && Storage::disk('local')->exists($maintenanceIssue->photo_path), 404);

        return response()->file(Storage::disk('local')->path($maintenanceIssue->photo_path), [
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
