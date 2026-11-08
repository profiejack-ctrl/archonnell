<?php

namespace App\Http\Controllers;

use App\Models\Alert;
use App\Models\AuditLog;
use App\Models\Driver;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;

class UserManagementController extends Controller
{
    private const ROLES = ['User', 'Driver', 'Admin'];

    public function store(Request $request): RedirectResponse
    {
        $this->authorizeAdmin($request);

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'string', 'email', 'max:100', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'role' => ['required', Rule::in(self::ROLES)],
            'status' => ['required', Rule::in(['active', 'inactive'])],
        ]);

        $user = DB::transaction(function () use ($data) {
            $passwordField = User::passwordColumnName();

            $user = User::create([
                'name' => $data['name'],
                'email' => strtolower($data['email']),
                $passwordField => Hash::make($data['password']),
                'role' => $data['role'],
                'status' => $data['status'],
            ]);

            $this->syncDriverRecord($user);

            return $user;
        });

        Alert::log('👤', 'User Added', "{$user->name} was added as {$user->role} by {$request->user()->name}.");

        AuditLog::record($request, 'User created', 'User Management', "Created {$user->name} ({$user->email}) with the {$user->role} role and {$user->status} status.");

        return back()->with('status', 'User created successfully.');
    }

    public function update(Request $request, User $user): RedirectResponse
    {
        $this->authorizeAdmin($request);

        if ($request->boolean('status_toggle')) {
            if ($user->id === $request->user()->id) {
                return back()->withErrors(['user' => 'You cannot change your own account status.']);
            }

            $data = $request->validate([
                'status' => ['required', Rule::in(['active', 'inactive'])],
            ]);

            DB::transaction(function () use ($user, $data) {
                $user->status = $data['status'];
                $user->save();
                $this->syncDriverRecord($user);
            });

            $status = $user->status;
            Alert::log(
                $status === 'inactive' ? 'OFF' : 'ON',
                $status === 'inactive' ? 'User Deactivated' : 'User Reactivated',
                "{$user->name}'s account was marked {$status} by {$request->user()->name}.",
                $status === 'inactive' ? 'warning' : 'info',
            );

            AuditLog::record($request, $status === 'inactive' ? 'Account deactivated' : 'Account reactivated', 'User Management', "Changed {$user->name}'s account status to {$status}.");

            return back()->with('status', "User account {$status} successfully.");
        }

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'string', 'email', 'max:100', Rule::unique('users', 'email')->ignore($user->id)],
            'password' => ['nullable', 'string', 'min:8', 'confirmed'],
            'role' => ['required', Rule::in(self::ROLES)],
            'status' => ['required', Rule::in(['active', 'inactive'])],
        ]);

        $before = ['name' => $user->name, 'email' => $user->email, 'role' => $user->role, 'status' => $user->status];
        DB::transaction(function () use ($user, $data) {
            $user->name = $data['name'];
            $user->email = strtolower($data['email']);
            $user->role = $data['role'];
            $user->status = $data['status'];

            if (! empty($data['password'])) {
                $user->{User::passwordColumnName()} = Hash::make($data['password']);
            }

            $user->save();
            $this->syncDriverRecord($user);
        });

        Alert::log('✏️', 'User Updated', "{$user->name}'s account was updated by {$request->user()->name}.");

        $changes = [];
        foreach (['name', 'email', 'role', 'status'] as $field) {
            if ($before[$field] !== $user->{$field}) {
                $changes[] = ucfirst($field)." changed from {$before[$field]} to {$user->{$field}}";
            }
        }
        if (! empty($data['password'])) {
            $changes[] = 'password reset';
        }
        AuditLog::record($request, 'User updated', 'User Management', "Updated {$user->name}'s account: ".(count($changes) ? implode('; ', $changes) : 'no profile fields changed').'.');

        return back()->with('status', 'User updated successfully.');
    }

    /**
     * Keep the drivers table aligned with accounts assigned the Driver role.
     * Existing driver rows are deactivated rather than deleted so dispatch and trip
     * history that references them is preserved.
     */
    private function syncDriverRecord(User $user): void
    {
        $driver = Driver::query()->where('user_id', $user->id)->first();

        if ($user->role !== 'Driver') {
            if ($driver && $driver->status !== 'Inactive') {
                $driver->status = 'Inactive';
                $driver->save();
            }

            return;
        }

        $status = $user->status === 'active' ? 'Active' : 'Inactive';

        if ($driver) {
            $driver->name = $user->name;
            $driver->role = 'Driver';
            $driver->status = $status;
            $driver->save();

            return;
        }

        $baseEmployeeId = 'DRV-' . str_pad((string) $user->id, 6, '0', STR_PAD_LEFT);
        $employeeId = $baseEmployeeId;
        $suffix = 1;

        while (Driver::query()->where('employee_id', $employeeId)->exists()) {
            $employeeId = $baseEmployeeId . '-' . $suffix++;
        }

        Driver::create([
            'user_id' => $user->id,
            'name' => $user->name,
            'employee_id' => $employeeId,
            'role' => 'Driver',
            'status' => $status,
        ]);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user()?->role === 'Admin', 403, 'Only administrators can manage users.');
    }
}
