# Phase 2: Workforce Management (WFM) Frontend Integration & Local Execution Record

## 1. Overview
This document records all architectural discoveries, configuration updates, backend integrations, and data mapping fixes applied to **Phase 2: WFM (`wfm-app`)** to run locally on port `5174` and communicate with the live production backend API (`https://api.archonnellincorporated.com`).

---

## 2. Backend Analysis & Endpoints Discovered
- **Swagger Documentation**: [https://api.archonnellincorporated.com/api/docs/](https://api.archonnellincorporated.com/api/docs/)
- **WFM Service Gateway**: `https://api.archonnellincorporated.com/api/v1/wfm`
- **Auth Gateway**: `https://api.archonnellincorporated.com/api/v1/auth`
- **Authentication**: Bearer JWT token persisted in `localStorage.getItem('archon_token')`, interoperable with HRMS (`hrms-app`).
- **Seeded Test Credentials**:
  - **Email**: `admin@archonnell.com`
  - **Password**: `Admin123!`
  - **Role**: `superadmin` / `admin`

### Key WFM Backend Endpoints
| HTTP Method | Route | Description |
|---|---|---|
| `GET` / `POST` | `/wfm/shifts` | List shift definitions / create a shift template |
| `PUT` / `DELETE` | `/wfm/shifts/{id}` | Update or delete a shift definition |
| `GET` / `POST` | `/wfm/shifts/schedules` | Fetch employee shift schedules / assign schedule |
| `PUT` / `DELETE` | `/wfm/shifts/schedules/{id}` | Update or delete a scheduled shift |
| `GET` | `/wfm/shifts/holidays` | List company/statutory holidays (handled with safe fallback) |
| `GET` / `POST` | `/wfm/timesheets` | Query timesheets / submit timesheet batch |
| `PUT` | `/wfm/timesheets/{id}` | Update timesheet entry / approval |
| `GET` | `/wfm/timesheets/summary` | Query aggregated timesheet metrics |
| `GET` / `POST` | `/wfm/attendance` | Fetch attendance logs / log clock-in & clock-out |
| `GET` | `/wfm/attendance/summary` | Query daily attendance KPIs |
| `GET` | `/wfm/employees` | List active employees for schedule/timesheet assignment |
| `GET` / `POST` | `/wfm/leave/requests` | List leave requests / submit leave |
| `GET` | `/wfm/leave/balances` | Query employee leave balances |
| `GET` | `/wfm/overtime/requests` | List and approve/reject overtime requests |
| `GET` | `/wfm/forecast` | Workload forecasting metrics |
| `GET` / `POST` | `/wfm/swaps` | Shift swap requests and approvals |

---

## 3. Configuration & Port Allocation
To allow all 5 frontends to run simultaneously without port contention or Windows IPv6 DNS timeouts:
- **HRMS (`hrms-app`)**: `http://localhost:5173/`
- **WFM (`wfm-app`)**: `http://localhost:5174/`

### File: `wfm-app/.env`
```env
VITE_API_URL=https://api.archonnellincorporated.com/api/v1/wfm
VITE_AUTH_URL=https://api.archonnellincorporated.com/api/v1/auth
```

### File: `wfm-app/vite.config.js`
- Set `server.port = 5174`
- Added fallback target `https://api.archonnellincorporated.com`
- Configured proxy agent with `family: 4` (enforcing IPv4 resolution on Windows to avoid dual-stack `ENETUNREACH` 502 errors).

---

## 4. HTTP Client & Data Mapping Fixes

### 1. Response Interceptor Unwrapping (`wfm-app/src/services/http.js`)
- **Problem**: The backend returns payloads in `{ success: true, data: [...] }`. The original interceptor returned `{ ...body, data: body.data }`. When React components performed:
  ```js
  const shifts = await shiftService.getAllShifts();
  // shifts was an Object instead of Array, causing shifts.map() or shifts.sort() to throw a TypeError
  ```
- **Fix**: Updated response interceptor to unwrap `body.data` directly when it is an array or object containing the primary resource:
  ```js
  if (body && typeof body === 'object' && 'data' in body) {
    if (Array.isArray(body.data)) return body.data;
    if (body.data && typeof body.data === 'object') return body.data;
  }
  ```

### 2. Shifts & Schedules Data Normalization (`wfm-app/src/services/api.js`)
- **Shifts**:
  - Mapped backend snake_case fields `start_time` and `end_time` (e.g., `"08:00:00"`) to frontend `startTime` (e.g., `"08:00"`) and `endTime`.
  - Mapped `break_minutes` to `breakMinutes`.
  - Ensured ID field supports both `shift_id` and `id`.
- **Schedules**:
  - Mapped `schedule_date` to `s.date` (guaranteeing strings like `"2026-11-12"` are present, resolving the `s.date.localeCompare is not a function` error in `Shifts.jsx`).
  - Mapped `employee_id` to `employeeId` and `shift_id` to `shiftId`.
  - Synthesized `employeeName` from `first_name` and `last_name`.
- **Holidays**:
  - Added safe error catch returning `[]` if the `/shifts/holidays` route returns 404.

### 3. Timesheets Data Normalization (`wfm-app/src/services/api.js`)
- Mapped `period_from` / `period_to` to `weekStart` / `weekEnd`.
- Computed `employeeName` from `first_name` and `last_name`.
- Mapped `total_regular_hours`, `total_ot_hours`, and calculated `regularHours`, `overtimeHours`, and `totalHours`.

### 4. Employees & Attendance Normalization (`wfm-app/src/services/api.js`)
- Mapped `first_name` + `last_name` to `name` and `fullName`.
- Mapped `department_name` to `department` and `position_title` to `position` / `role`.
- Attendance: normalized `date` / `work_date`, `time_in` / `time_out` to `timeIn` / `timeOut`, and `worked_hours`.

---

## 5. Verification & Local Execution

### Build Verification
```powershell
npm.cmd run build --prefix wfm-app
```
- **Result**: Successfully built in 4.57s with 0 errors.

### Dev Server Execution
```powershell
npm.cmd run dev --prefix wfm-app
```
- **Local URL**: `http://localhost:5174/`
- **HTTP Status Check**: `200 OK` (Vite client ready, bundling completed).

---

## 6. How to Run Locally
1. Open terminal in the workspace root:
   ```powershell
   cd wfm-app
   npm.cmd install
   npm.cmd run dev
   ```
2. Open [http://localhost:5174/](http://localhost:5174/) in your browser.
3. Sign in using:
   - **Email**: `admin@archonnell.com`
   - **Password**: `Admin123!`
4. Explore the **Shifts & Scheduling**, **Attendance**, and **Timesheets** modules populated with live backend data.
