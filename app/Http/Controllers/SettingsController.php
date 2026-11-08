<?php

namespace App\Http\Controllers;

use App\Models\Alert;
use App\Models\AuditLog;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class SettingsController extends Controller
{
    private const THEMES = ['light', 'dark'];
    private const DATE_FORMATS = ['M d, Y', 'd/m/Y', 'Y-m-d'];
    private const LOCALES = ['en', 'fil'];

    public function updateProfile(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'email' => ['required', 'string', 'email', 'max:100', Rule::unique('users', 'email')->ignore($user->id)],
        ]);

        $user->name = $data['name'];
        $user->email = strtolower($data['email']);
        $user->save();

        Alert::log('⚙️', 'Profile Updated', "{$user->name} updated their profile.");

        AuditLog::record($request, 'Profile updated', 'Settings', 'Updated profile name and email address.');

        return back()->with('status', 'Profile updated successfully.');
    }

    public function updateProfilePhoto(Request $request): RedirectResponse
    {
        if (! Schema::hasColumn('users', 'profile_photo_path')) {
            return back()->withErrors(['profile_photo' => 'Profile photo uploads are not enabled on the server yet. Run the pending database migrations and try again.']);
        }

        $data = $request->validate([
            'profile_photo' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $user = $request->user();
        $oldPath = $user->profile_photo_path;
        $newPath = $request->file('profile_photo')->store('profile-photos', 'local');
        if (! is_string($newPath) || $newPath === '') {
            return back()->withErrors(['profile_photo' => 'The photo could not be saved. Check that the server storage directory is writable.']);
        }

        $user->profile_photo_path = $newPath;
        $user->save();

        if ($oldPath && $oldPath !== $newPath) {
            Storage::disk('local')->delete($oldPath);
        }

        if (Schema::hasTable('audit_logs')) {
            AuditLog::record($request, 'Profile photo changed', 'Settings', 'Updated profile picture.');
        }

        return back()->with('status', 'Profile picture updated.');
    }

    public function showProfilePhoto(Request $request): BinaryFileResponse
    {
        $path = $request->user()?->profile_photo_path;
        abort_unless($path && Storage::disk('local')->exists($path), 404);

        return response()->file(Storage::disk('local')->path($path), [
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function updatePassword(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', Password::min(8), 'confirmed'],
        ]);

        if (! Hash::check($data['current_password'], $user->password)) {
            return back()->withErrors(['current_password' => 'Your current password is incorrect.']);
        }

        $user->password = Hash::make($data['password']);
        $user->save();

        Alert::log('🔒', 'Password Changed', "{$user->name} changed their password.");

        AuditLog::record($request, 'Password changed', 'Settings', 'Changed account password.');

        return back()->with('status', 'Password changed successfully.');
    }

    public function updatePreferences(Request $request): RedirectResponse
    {
        $user = $request->user();

        $data = $request->validate([
            'theme' => ['required', Rule::in(self::THEMES)],
            'date_format' => ['required', Rule::in(self::DATE_FORMATS)],
            'locale' => ['required', Rule::in(self::LOCALES)],
        ]);

        $user->preferences = array_merge($user->preferences ?? [], $data);
        $user->save();

        return back()->with('status', 'Preferences saved.');
    }
}
