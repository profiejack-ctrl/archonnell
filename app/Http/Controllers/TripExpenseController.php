<?php

namespace App\Http\Controllers;

use App\Models\AuditLog;
use App\Models\TripExpense;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class TripExpenseController extends Controller
{
    private const CATEGORIES = ['Meals', 'Parking', 'Other'];

    public function store(Request $request): RedirectResponse
    {
        $data = $request->validate([
            'vehicle_id' => ['required', Rule::exists('vehicles', 'id')],
            'category' => ['required', Rule::in(self::CATEGORIES)],
            'description' => ['required', 'string', 'max:255'],
            'amount' => ['required', 'numeric', 'min:0.01', 'max:1000000'],
            'expense_date' => ['required', 'date', 'before_or_equal:today'],
            'receipt' => ['required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:5120'],
        ]);

        $expense = TripExpense::create([
            'user_id' => $request->user()->id,
            'vehicle_id' => $data['vehicle_id'],
            'category' => $data['category'],
            'description' => $data['description'],
            'amount' => $data['amount'],
            'expense_date' => $data['expense_date'],
            'receipt_path' => $request->file('receipt')->store('trip-expenses/receipts', 'local'),
        ]);

        AuditLog::record($request, 'Trip expense submitted', 'Fuel & Costs', sprintf('Submitted %s expense for PHP %s: %s.', $expense->category, number_format($expense->amount, 2), $expense->description));

        return back()->with('status', 'Trip expense saved with receipt proof.');
    }

    public function receipt(Request $request, TripExpense $tripExpense): BinaryFileResponse
    {
        abort_unless($request->user() && ($request->user()->role === 'Admin' || (int) $tripExpense->user_id === (int) $request->user()->id), 404);
        abort_unless(Storage::disk('local')->exists($tripExpense->receipt_path), 404);

        return response()->file(Storage::disk('local')->path($tripExpense->receipt_path), [
            'Cache-Control' => 'private, no-store',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
