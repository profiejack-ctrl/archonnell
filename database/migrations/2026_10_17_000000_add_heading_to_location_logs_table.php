<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('location_logs', function (Blueprint $table) {
            $table->decimal('heading', 6, 2)->nullable()->after('speed');
        });
    }

    public function down(): void
    {
        Schema::table('location_logs', function (Blueprint $table) {
            $table->dropColumn('heading');
        });
    }
};
