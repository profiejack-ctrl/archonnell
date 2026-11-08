<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('vehicles') && ! Schema::hasColumn('vehicles', 'odometer_auto_since')) {
            Schema::table('vehicles', function (Blueprint $table): void {
                $table->date('odometer_auto_since')->nullable()->after('odometer');
            });

            DB::table('vehicles')->whereNull('odometer_auto_since')->update(['odometer_auto_since' => now()->toDateString()]);
        }

        if (! Schema::hasTable('maintenance_issues')) {
            Schema::create('maintenance_issues', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('vehicle_id')->constrained()->cascadeOnDelete();
                $table->foreignId('reported_by')->nullable()->constrained('users')->nullOnDelete();
                $table->text('details');
                $table->string('photo_path')->nullable();
                $table->string('status', 40)->default('Reported');
                $table->timestamp('resolved_at')->nullable();
                $table->timestamps();
                $table->index(['vehicle_id', 'status']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('maintenance_issues');

        if (Schema::hasTable('vehicles') && Schema::hasColumn('vehicles', 'odometer_auto_since')) {
            Schema::table('vehicles', function (Blueprint $table): void {
                $table->dropColumn('odometer_auto_since');
            });
        }
    }
};
