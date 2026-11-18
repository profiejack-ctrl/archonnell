# Phase 1: Core HRMS Frontend Integration & Local Execution Record

## 1. Overview
This document records all architectural discoveries, dependency adjustments, backend integrations, and data mapping fixes applied to **Phase 1: HRMS (`hrms-app`)** to make it run locally and connect seamlessly with the live production backend API (`https://api.archonnellincorporated.com`).

---

## 2. Backend Analysis & Endpoint Discovery
- **Swagger Documentation**: [https://api.archonnellincorporated.com/api/docs/](https://api.archonnellincorporated.com/api/docs/)
- **Production API Gateway**: `https://api.archonnellincorporated.com/api/v1`
- **Authentication**: JWT Bearer token authentication issued by `/api/v1/auth/login` or through the `/api/v1/hrms/bridge` action router.
- **Seeded Test Credentials**:
  - **Email**: `admin@archonnell.com`
  - **Password**: `Admin123!`
  - **Role**: `superadmin` / `Super Admin`

### Key HRMS Backend Endpoints
| HTTP Method | Route | Description |
|---|---|---|
| `POST` | `/auth/login` | Authenticates user and issues JWT bearer token |
| `GET` | `/auth/me` | Retrieves user profile, assigned role, and linked employee data |
| `POST` | `/auth/logout` | Terminates session and revokes authentication |
| `GET` / `POST` | `/hrms/departments` | Lists all departments with employee counts / creates a new department |
| `GET` / `POST` | `/hrms/positions` | Lists job positions (filterable by `department_id`) / creates new position |
| `GET` / `POST` | `/hrms/employees` | Search and list employees / registers new employee |
| `GET` | `/hrms/employees/next-no` | Computes next auto-incremented employee code (e.g., `EMP-0026`) |
| `GET` / `POST` | `/hrms/jobs` | Public career list / publishes new job opening |
| `GET` / `POST` | `/hrms/applicants` | Lists recruitment candidates / submits job application |
| `POST` | `/hrms/applicants/{id}/hire` | One-click converts applicant into employee record |
| `GET` / `POST` | `/hrms/bridge` | High-level action router (`action=state`, `action=me`, `action=page_hcm`, `action=page_dashboard`, `action=page_records`, etc.) |

---

## 3. Structural & Asset Dependency Resolution
`hrms-app` was previously coupled to an external parent folder (`archon_nell_react`) through relative imports escaping the application boundary (`../../styles.css`, `../../../css/login.css`, `../../../img/LOGO.png`, `../../../Homepage/...`). Because `archonnell-frontends` is an isolated multi-project repository, `hrms-app` failed during Vite build.

### Changes Applied:
1. **Migrated Styles & Assets into `hrms-app`**:
   - `styles.css` -> `hrms-app/src/styles/styles.css`
   - `css/` (`login.css`, `archon-alerts.css`, `system-responsive.css`) -> `hrms-app/src/styles/`
   - `img/LOGO.png` -> `hrms-app/src/assets/img/LOGO.png`
   - `Homepage/` -> `hrms-app/src/assets/Homepage/`
2. **Updated Import Paths**:
   - `hrms-app/src/main.tsx`: Updated imports to `./styles/styles.css`, `./styles/system-responsive.css`, and `./styles/archon-alerts.css`.
   - `hrms-app/src/pages/LoginPage.tsx`: Updated inline CSS import to `../styles/login.css?inline`.
   - `hrms-app/src/layouts/Header.tsx`: Updated logo import to `../assets/img/LOGO.png`.
   - `hrms-app/src/public/main.tsx`: Updated public portal stylesheets to `../assets/Homepage/css/...` and `../styles/archon-alerts.css`.
   - `hrms-app/src/public/layouts/SiteHeader.tsx` & `SiteFooter.tsx`: Updated logo imports to `../../assets/Homepage/assets/img/LOGO.png`.

Result: `hrms-app` is now completely self-contained and builds with **0 errors**.

---

## 4. Resolution of 502 Bad Gateway Errors

### Root Cause Analysis:
1. **Node.js IPv6 / Dual-Stack Bug on Windows**:
   - The production domain `api.archonnellincorporated.com` resolves to both IPv4 (`64.29.17.1`, `216.198.79.1`) and IPv6 (`64:ff9b::401d:1101`) addresses.
   - When Vite dev server proxy was mediating requests through Node.js (`http://localhost:5173/api/...`), Node's `http-proxy` attempted connecting via IPv6 first.
   - On Windows networks without an active IPv6 WAN gateway, the socket call failed with `ENETUNREACH` followed by `AggregateError [ETIMEDOUT]`.
   - When Node's proxy timed out, Vite returned **`502 Bad Gateway`** to the browser.
2. **Backend Native CORS Support**:
   - Verification confirmed the backend API at `https://api.archonnellincorporated.com` natively allows `Origin: http://localhost:5173` with full preflight headers (`Access-Control-Allow-Origin`, `Access-Control-Allow-Credentials: true`, `Access-Control-Allow-Headers`).

### Solution:
1. **Configured Direct Production URL in `.env`**:
   ```env
   VITE_API_URL=https://api.archonnellincorporated.com/api/v1/hrms
   VITE_AUTH_URL=https://api.archonnellincorporated.com/api/v1/auth
   VITE_GATEWAY_URL=https://api.archonnellincorporated.com
   ```
   The browser connects directly to the backend over HTTPS in ~100–300ms, completely avoiding the local proxy bottleneck and eliminating 502 errors.
2. **Enforced IPv4 in `vite.config.ts`**:
   Added `https.Agent({ family: 4, keepAlive: true })` to Vite's proxy configuration as a resilient fallback so any remaining proxied requests strictly force IPv4.

---

## 5. Sub-Module Data Normalization & Safe Mapping

The backend bridge actions return varied data formats (some return flat objects, others return arrays or `{ action, message, data }`). All services were fortified with safe normalization:

### 1. `WorkforceStats` & `Distribution` (`employeeService.ts`)
- Automatically maps flat workforce numbers (`total`, `active`, `regular`) into computed category structures (`Active`, `On Leave`, `Inactive`) with badge colors.
- Transforms dictionary-based `dept_distribution` into `{ items: [{ name, count, pct, color }], total }`.
- `toEmployeeView()` in `EmployeeModals.tsx` accepts both bridge and REST casing (`hire_date` / `date_hired`, `phone` / `mobile_number`, `position_title` / `position`).

### 2. Candidate Ranking (`applicantService.ts`)
- Mapped `ai_score` and `match_score` into `overall_score`, `role_fit`, `resume_score`, and `quality_of_hire`.
- Provided fallback values for `job_posting_no` and `job_posting_title` to prevent sorting/filtering exceptions.

### 3. Pre-Interview & Final Interview (`recruitmentService.ts`)
- Normalized `page_pre_interview` and `page_final_interview` responses so `applicants`, `rejected`, and `stats` are always structured even if the backend returns `{ data: [] }`.

### 4. Talent Pool, Rejected & Archived Applicants (`talentService.ts`)
- Normalized `page_rejected_applicants`, `page_archived_applicants`, and `page_talent_pool` to ensure `applicants` is always a valid array.

### 5. Vacancy Requests (`vacancyRequestService.ts`)
- Normalized `requests`, `positions`, and default `employment_types`.

### 6. Shifts & Attendance (`attendanceService.ts`)
- Normalized `page_time_attendance` and `page_shift_schedule` payloads with default `shifts: []`, `schedules: []`, `holidays: []`, and standard shift types.

### 7. Leave Management (`leaveService.ts`)
- Normalized `page_leave_management` with `today`, `requests`, `types`, `balances`, `employees`, and `departments`.

---

## 6. How to Run Locally

### Start Development Server:
```powershell
cd c:\Users\ProfieJack\Desktop\archonnell-frontends\hrms-app
npm run dev
```

- **Local URL**: `http://localhost:5173/`
- **Login Credentials**:
  - **Email**: `admin@archonnell.com`
  - **Password**: `Admin123!`

---

## 7. Roadmap for All Phases
- [x] **Phase 1: HRMS** (`hrms-app`) - **COMPLETED** (Zero 502s, all sub-modules mapped)
- [ ] **Phase 2: WFM** (`wfm-app` - Shifts, Attendance Kiosk & Timesheets)
- [ ] **Phase 3: Payroll** (`payroll-app` - Runs, Computation & Payslips)
- [ ] **Phase 4: Fleet** (`fleet-app` - Vehicles, Drivers & Dispatches)
- [ ] **Phase 5: Storefront** (`storefront-app` - Products, Cart & Order Tracking)
