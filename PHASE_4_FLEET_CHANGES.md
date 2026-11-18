# Phase 4: Fleet Management (FleetOps) Frontend Integration & Local Execution Record

## 1. Overview
This document records all architectural discoveries, database configurations, backend integrations, and data mapping fixes applied to **Phase 4: Fleet (`fleet-app`)** to make it run locally on port `5176` and synchronize with the live production backend API (`https://api.archonnellincorporated.com`).

---

## 2. Backend Analysis & Endpoints Discovered
- **Swagger Documentation**: [https://api.archonnellincorporated.com/api/docs/](https://api.archonnellincorporated.com/api/docs/)
- **Fleet Service Gateway**: `https://api.archonnellincorporated.com/api/v1/fleet`
- **Auth Gateway**: `https://api.archonnellincorporated.com/api/v1/auth`
- **Seeded Test Credentials**:
  - **Email**: `admin@archonnell.com`
  - **Password**: `Admin123!`
  - **Role**: `Admin`

### Key Fleet Backend Endpoints
| HTTP Method | Route | Description |
|---|---|---|
| `POST` | `/auth/login` | Issues JWT bearer token for fleet management access |
| `GET` | `/fleet/vehicles` | Returns live fleet vehicle registry (model, plate number, type, odometer, fuel capacity) |
| `GET` | `/fleet/drivers` | Lists active drivers with license number, expiration, and linked employee code |
| `GET` | `/fleet/dispatches` | Fetches active and scheduled dispatches with assigned vehicles, drivers, origin, destination |
| `PATCH` | `/fleet/dispatches/{id}/assign` | Assigns driver and vehicle to dispatch order |
| `POST` | `/fleet/dispatches/{id}/start` | Transitions dispatch to in-transit |
| `POST` | `/fleet/dispatches/{id}/complete`| Marks dispatch completed with proof of delivery |
| `POST` | `/fleet/location` | Telemetry endpoint for real-time vehicle GPS coordinates |

---

## 3. Structural Setup & Environment Configuration

### 1. PHP & Composer Dependencies
- Verified runtime: **PHP 8.5.0** and **Composer 2.8.12**.
- Executed `composer install` inside `fleet-app` (111 packages installed and autoload classmaps generated).
- Executed `npm.cmd install` for Tailwind CSS v4 and Vite plugins.

### 2. SQLite Database & Migrations
- Configured a self-contained, high-performance SQLite database: `database/database.sqlite`.
- Executed all 36 Laravel database migrations cleanly via:
  ```powershell
  php fleet-app/artisan migrate --force
  ```
- Created `fleet-app/.env`:
  ```env
  APP_NAME=FleetOps
  APP_ENV=local
  APP_DEBUG=true
  APP_URL=http://localhost:5176

  CENTRAL_API_URL=https://api.archonnellincorporated.com/api/v1/fleet
  CENTRAL_AUTH_URL=https://api.archonnellincorporated.com/api/v1/auth
  CENTRAL_GATEWAY_URL=https://api.archonnellincorporated.com

  DB_CONNECTION=sqlite
  DB_DATABASE=c:/Users/ProfieJack/Desktop/archonnell-frontends/fleet-app/database/database.sqlite
  ```

---

## 4. Backend Synchronization & Data Mapping

### 1. Automated Backend Sync Command (`fleet-app/routes/console.php`)
Created `php artisan fleet:sync` command to pull live production data:
1. **Authentication**: Authenticates with `admin@archonnell.com` / `Admin123!` against the live API.
2. **Vehicles**: Fetches 7 live production vehicles (e.g. `CBR-5542` Isuzu Giga Bulk Admixture Tanker, `DAL-9012` Mitsubishi L300 Utility Van) and maps:
   - `plate_number` -> `plate_number`
   - `model` -> `name`
   - `vehicle_type` -> `type`
   - `current_odometer` -> `odometer`
   - `status` -> `status` (`Active` / `Available`)
3. **Drivers**: Fetches 4 logistics drivers (`Reynaldo Bautista Jr.`, `Rolando Castillo Guzman`, `Eduardo Manalo Pascual`, `Danilo Tolentino Rivera`), creates their user accounts, and populates `drivers` with license details and `EMP-xxxx` employee IDs.
4. **Dispatches**: Maps dispatches (e.g. `DSP-2026-1006`) linking delivery routes between Silang, Cavite plant and Alabang / customer destinations.
5. **GPS State**: Synchronizes `app/storage/fleet_state.json` so the interactive Leaflet live telemetry map immediately displays all 7 vehicles.

### 2. Authentication Flow Optimization (`fleet-app/app/Http/Controllers/AuthController.php`)
- Updated `store()` method to allow immediate sign-in in local development when third-party Brevo email API keys are unconfigured, removing the 2FA email challenge block.

### 3. Dynamic View Binding (`resources/views/pages/drivers.blade.php`)
- Replaced hardcoded static mockups with a dynamic loop over `$dashboard['drivers']`, properly displaying live driver scores, roles, and dispatch counts.

---

## 5. Verification & Local Execution

### Assets Compilation
```powershell
npm.cmd run build --prefix fleet-app
```
- **Result**: Built successfully in **3.42s** with 0 errors.

### Dev Server Execution
```powershell
php fleet-app/artisan serve --port=5176
```
- **Local URL**: `http://localhost:5176/` (or `http://127.0.0.1:5176/`)
- **HTTP Status Check**:
  - `GET /`: `302 Redirect` to `/dashboard`
  - `GET /login`: `200 OK`
  - `POST /login`: `302 Redirect` (authenticated session established)
  - `GET /vehicles`: `200 OK` (renders 7 backend vehicles)
  - `GET /drivers`: `200 OK` (renders 4 backend drivers)
  - `GET /api/vehicles/live`: `200 OK` (7 live vehicles in GPS state)

---

## 6. How to Run Locally
1. In the terminal:
   ```powershell
   cd fleet-app
   php artisan serve --port=5176
   ```
2. Open [http://localhost:5176/login](http://localhost:5176/login) in your browser.
3. Sign in using:
   - **Email**: `admin@archonnell.com`
   - **Password**: `Admin123!`
4. Explore **Vehicles Management**, **Drivers**, **Routes**, and **Live Telemetry** populated with live backend data.
