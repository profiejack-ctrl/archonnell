# Phase 3: Payroll & Benefits Management Frontend Integration & Local Execution Record

## 1. Overview
This document records all architectural discoveries, structural dependency resolutions, backend integrations, and data mapping fixes applied to **Phase 3: Payroll (`payroll-app`)** to make it run locally on port `5175` and connect seamlessly with the live production backend API (`https://api.archonnellincorporated.com`).

---

## 2. Backend Analysis & Endpoints Discovered
- **Swagger Documentation**: [https://api.archonnellincorporated.com/api/docs/](https://api.archonnellincorporated.com/api/docs/)
- **Payroll Service Gateway**: `https://api.archonnellincorporated.com/api/v1/payroll`
- **Auth Gateway**: `https://api.archonnellincorporated.com/api/v1/auth`
- **Authentication**: JWT Bearer token authentication interoperable across all sub-modules via `localStorage.getItem('archon_token')`.
- **Seeded Test Credentials**:
  - **Email**: `admin@archonnell.com`
  - **Password**: `Admin123!`
  - **Role**: `superadmin` / `admin` (mapped to `Admin`)

### Key Payroll Backend Endpoints
| HTTP Method | Route | Description |
|---|---|---|
| `POST` | `/auth/login` | Authenticates user and issues JWT bearer token |
| `GET` | `/auth/me` | Fetches active profile, role, and linked employee data |
| `GET` | `/payroll/runs` | Returns live list of payroll runs with status, gross, net, and totals |
| `POST` | `/payroll/runs/compute` | Automated payroll computation engine reading WFM timesheets & salaries |
| `GET` | `/payroll/runs/{id}` | Run details containing itemized employee payslips |
| `GET` | `/payroll/payslips/{id}` | Single payslip breakdown (Basic Pay, SSS, PhilHealth, Pag-IBIG, Tax, OT) |
| `GET` | `/payroll/integrations/finance/payroll-runs` | Finance ledger integration for funded payroll amounts |
| `GET` | `/payroll/employees` | Active employee roster with departments, positions, and base salaries |
| `GET` / `POST` | `/payroll/app-data` | Synchronized application state storage and snapshot hydration |

---

## 3. Structural & Dependency Resolutions

### 1. `backend-render/` Business Rules Restoration
- **Problem**: `payroll-app` source code features multiple imports from `../../../backend-render/payrollFlow.js`, `gradeStructure.js`, `payslipLines.js`, `dashboardRules.js`, and `permissions.json`. This shared business logic library was missing from `archonnell-frontends/payroll-app`.
- **Fix**: Migrated and restored the full `backend-render/` module from `Capstone-Payroll` into `c:\Users\ProfieJack\Desktop\archonnell-frontends\payroll-app\backend-render\`.

### 2. Node Type Declarations & Build Tooling
- Installed missing dev dependency `@types/node` in `payroll-app` to resolve `process` and `node:https` compilation errors in `vite.config.ts`.
- Executed `npm.cmd install --prefix payroll-app` (142 packages installed cleanly).

---

## 4. Configuration & Port Allocation

### Port Strategy Across Completed Phases
- **HRMS (`hrms-app`)**: `http://localhost:5173/`
- **WFM (`wfm-app`)**: `http://localhost:5174/`
- **Payroll (`payroll-app`)**: `http://localhost:5175/`

### File: `payroll-app/.env`
```env
VITE_API_BASE=https://api.archonnellincorporated.com/api/v1/payroll
VITE_AUTH_URL=https://api.archonnellincorporated.com/api/v1/auth
VITE_GATEWAY_URL=https://api.archonnellincorporated.com
```

### File: `payroll-app/vite.config.ts`
- Assigned server port to `5175`.
- Configured IPv4 agent (`family: 4`) on the `/api` reverse proxy to prevent Windows IPv6 dual-stack DNS timeouts (502 Bad Gateway).

---

## 5. HTTP Client, Authentication & Data Mapping Fixes

### 1. Authentication & Single Sign-On (`payroll-app/src/features/auth/authService.ts`)
- Updated `login()` to post directly to `${AUTH_URL}/login` (`https://api.archonnellincorporated.com/api/v1/auth/login`).
- Added automatic role normalization: `superadmin` / `admin` maps to `'Admin'`; `finance` maps to `'Finance'`; `hr_staff` maps to `'HR Staff'`.
- Enhanced `getCurrentUser()` to read existing `archon_token` from `localStorage`, allowing instant Single Sign-On without needing to log in again if already authenticated in HRMS or WFM.
- Connected `refreshCurrentUser()` to `${AUTH_URL}/me` to dynamically sync profile names and roles.

### 2. Live Payroll Runs Hydration (`payroll-app/src/services/sync/serverSync.ts`)
- Added `syncLivePayrollRuns()` inside `hydrateFromServer()`:
  - Fetches live payroll runs from `GET /runs`.
  - Normalizes backend statuses (`approved` -> `'Approved'`, `paid` -> `'Paid'`, `pending` -> `'Pending Approval'`).
  - Fetches itemized payslip details via `GET /runs/{id}` and maps them into `RunRow` objects with inputs and earnings/deductions breakdown.
  - Automatically populates `payroll:runs` in storage so that Dashboard, Review Payroll, and Payslips panels display real company runs immediately.

### 3. Employee Roster Normalization (`payroll-app/src/features/employees/employeeService.ts`)
- Updated `fromServer()` to accept and map backend fields:
  - `employee_no` mapped to `employeeNo`
  - `position_title` mapped to `position`
  - `department_name` mapped to `department`
  - `hire_date` mapped to `dateHired`
  - Daily position rates calculated from base salary (`basic_salary / 26`).
- Updated `serverEmployees()` to safely handle response payloads whether returned as an array or wrapped under `{ data: [...] }`.

---

## 6. Verification & Local Execution

### TypeScript Check
```powershell
npm.cmd run typecheck --prefix payroll-app
```
- **Result**: Passed with **0 errors**.

### Production Build
```powershell
npm.cmd run build --prefix payroll-app
```
- **Result**: Successfully transformed 2085 modules and built in **32.40s** with 0 errors.

### Dev Server Execution
```powershell
npm.cmd run dev --prefix payroll-app
```
- **Local URL**: `http://localhost:5175/`
- **HTTP Status Check**: `200 OK` (Vite ready in 1671ms).

---

## 7. How to Run Locally
1. In the terminal:
   ```powershell
   cd payroll-app
   npm.cmd install
   npm.cmd run dev
   ```
2. Open [http://localhost:5175/](http://localhost:5175/) in your browser.
3. Sign in with:
   - **Email**: `admin@archonnell.com`
   - **Password**: `Admin123!`
   *(Or navigate directly if already logged in via HRMS or WFM, as SSO token `archon_token` will authenticate automatically).*
4. Explore **Payroll Runs**, **Payslips**, **Compensation**, **Deductions**, and **Reports** populated with live backend data.
