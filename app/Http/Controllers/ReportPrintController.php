<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class ReportPrintController extends Controller
{
    public function verifyPassword(Request $request): JsonResponse
    {
        $data = $request->validate(['password' => ['required', 'string', 'max:255']]);
        $user = $request->user();

        abort_unless($user, 401);

        if ($user->role !== 'Admin' && ! Hash::check($data['password'], $user->password)) {
            return response()->json(['message' => 'The password you entered is incorrect.'], 422);
        }

        return response()->json(['verified' => true]);
    }
}
