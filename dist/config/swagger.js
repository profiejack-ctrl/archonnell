export const swaggerDocument = {
    openapi: '3.0.0',
    info: {
        title: 'Archon Nell Incorporated - Centralized Backend API',
        version: '1.0.0',
        description: `
**Archon Nell Integrated E-Commerce & Enterprise Management Gateway**

This centralized API integrates all capstone subsystems into a unified platform:
- **Auth & SSO**: Centralized Single Sign-On and Role-Based Access Control
- **HRMS**: Core Human Capital, Employee Records, Job Postings, and Applicant Hiring
- **WFM**: Workforce Scheduling, Kiosk Clock-in/out, Attendance, and Cutoff Timesheets
- **Payroll**: Automated Calculation Engine, Payslips, Claims, and HMO Benefits
- **Shop**: E-Commerce Storefront, Products, Vouchers, Cart Checkout, Cancellation & Return Requests, and Tracking
- **Fleet**: Logistics Fleet Management, Vehicles, Drivers, Dispatches, and GPS Tracking
- **SmartChain**: External Supply Chain Integration (Logistics Callbacks, Delivery Requests, Financial Events, Purchase Orders & Disbursements)
- **PDMS**: Performance & Development Management System (Competencies, Goals, KPIs, Reviews, Learning, Succession, Recognition & HR2/WFM Workforce Sync)
- **ESFA**: E-Commerce Support, Finance & Administration (Support Tickets, Knowledge Base, Centavo Payments/Refunds, Shipping Quotes/Shipments & Webhooks)
- **Stubs**: Finance Ledger and Supply Chain Warehousing integration endpoints
    `,
        contact: {
            name: 'Archon Nell Engineering Team',
            email: 'admin@archonnell.com'
        }
    },
    servers: [
        {
            url: '/api/v1',
            description: 'Central Gateway API v1'
        },
        {
            url: 'https://api.archonnell.com/api/v1',
            description: 'Production Subdomain Gateway'
        }
    ],
    components: {
        securitySchemes: {
            BearerAuth: {
                type: 'http',
                scheme: 'bearer',
                bearerFormat: 'JWT',
                description: 'Enter your JWT token obtained from `/auth/login` or `/auth/register`'
            }
        }
    },
    tags: [
        { name: 'Auth', description: 'Centralized SSO, Login, Registration, and Session Profile' },
        { name: 'HRMS', description: 'Core Human Capital, Departments, Positions, Employees, Jobs & Applicants' },
        { name: 'WFM', description: 'Workforce Shifts, Schedules, Kiosk Attendance, Timesheets & Leaves' },
        { name: 'Payroll', description: 'Payroll Runs, Automatic Calculation Engine, Payslips & HMO' },
        { name: 'Shop', description: 'E-Commerce Catalog, Vouchers, Checkout, Order Tracking, Cancellations, Returns & Reviews' },
        { name: 'Fleet', description: 'Vehicles, Drivers, Delivery Dispatches, Fuel Logs & GPS Tracking' },
        { name: 'SmartChain', description: 'SmartChain External Integration (Logistics Status Events, Delivery Requests, Finance Events, POs & Disbursements)' },
        { name: 'PDMS', description: 'Performance & Development Management System (Competencies, Goals, KPIs, Reviews, Learning, Succession, Recognition & HR2 Workforce Records)' },
        { name: 'ESFA', description: 'E-Commerce Support, Finance & Administration (Tickets, Knowledge Base, Payments, Refunds, Shipping Quotes, Shipments & Webhooks)' },
        { name: 'Stubs', description: 'Mock Endpoints for External Capstone Subsystems (Finance & SCM)' }
    ],
    paths: {
        '/auth/login': {
            post: {
                tags: ['Auth'],
                summary: 'Authenticate user and issue JWT token',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'password'],
                                properties: {
                                    email: { type: 'string', example: 'admin@archonnell.com' },
                                    password: { type: 'string', example: 'Admin123!' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Login successful. Returns token and user profile.' },
                    401: { description: 'Invalid credentials.' }
                }
            }
        },
        '/auth/register': {
            post: {
                tags: ['Auth'],
                summary: 'Register new customer account',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'password', 'fullName'],
                                properties: {
                                    email: { type: 'string', example: 'customer@gmail.com' },
                                    password: { type: 'string', example: 'SecurePassword123!' },
                                    fullName: { type: 'string', example: 'Juan Dela Cruz' },
                                    role: { type: 'string', default: 'customer' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    201: { description: 'User account created.' },
                    409: { description: 'Email already exists.' }
                }
            }
        },
        '/auth/me': {
            get: {
                tags: ['Auth'],
                summary: 'Retrieve authenticated user session profile and linked employee data',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: { description: 'Profile details returned.' },
                    401: { description: 'Unauthorized.' }
                }
            }
        },
        '/auth/logout': {
            post: {
                tags: ['Auth'],
                summary: 'Clear authentication cookie and terminate session',
                responses: {
                    200: { description: 'Logged out successfully.' }
                }
            }
        },
        '/auth/otp/send': {
            post: {
                tags: ['Auth'],
                summary: 'Generate and send a single-use 6-digit OTP code to an email address for any subsystem',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email'],
                                properties: {
                                    email: { type: 'string', example: 'user@example.com' },
                                    purpose: {
                                        type: 'string',
                                        example: 'CHECKOUT',
                                        description: 'Reason for OTP: LOGIN, CHECKOUT, PASSWORD_RESET, APPLICANT, DRIVER, WFM_CLOCK, PAYROLL_ACCESS'
                                    },
                                    module: {
                                        type: 'string',
                                        example: 'shop',
                                        description: 'Subsystem: auth, shop, hrms, wfm, payroll, fleet'
                                    }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'OTP generated and dispatched successfully.' },
                    400: { description: 'Invalid email or validation error.' }
                }
            }
        },
        '/auth/otp/verify': {
            post: {
                tags: ['Auth'],
                summary: 'Validate a 6-digit OTP code for a given email and purpose',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['email', 'code'],
                                properties: {
                                    email: { type: 'string', example: 'user@example.com' },
                                    code: { type: 'string', example: '123456' },
                                    purpose: { type: 'string', example: 'CHECKOUT' },
                                    module: { type: 'string', example: 'shop' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'OTP validated successfully.' },
                    400: { description: 'Invalid or expired OTP.' }
                }
            }
        },
        // HRMS
        '/hrms/departments': {
            get: {
                tags: ['HRMS'],
                summary: 'List all company departments with employee counts',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Department list.' } }
            },
            post: {
                tags: ['HRMS'],
                summary: 'Create a new organizational department (Admin)',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['code', 'name'],
                                properties: {
                                    code: { type: 'string', example: 'TECH' },
                                    name: { type: 'string', example: 'Technology & Systems' },
                                    description: { type: 'string', example: 'Software development & IT' }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Department created.' } }
            }
        },
        '/hrms/positions': {
            get: {
                tags: ['HRMS'],
                summary: 'List job positions',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'department_id', in: 'query', schema: { type: 'string' } }
                ],
                responses: { 200: { description: 'Positions list.' } }
            },
            post: {
                tags: ['HRMS'],
                summary: 'Create job position with salary grade',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['departmentId', 'title'],
                                properties: {
                                    departmentId: { type: 'string', format: 'uuid' },
                                    title: { type: 'string', example: 'Full Stack Engineer' },
                                    salaryGrade: { type: 'string', example: 'P3' },
                                    baseSalary: { type: 'number', example: 45000.00 }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Position created.' } }
            }
        },
        '/hrms/employees': {
            get: {
                tags: ['HRMS'],
                summary: 'Search & list employees in directory',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'department_id', in: 'query', schema: { type: 'string' } },
                    { name: 'status', in: 'query', schema: { type: 'string' } },
                    { name: 'search', in: 'query', schema: { type: 'string' } }
                ],
                responses: { 200: { description: 'Employee directory.' } }
            },
            post: {
                tags: ['HRMS'],
                summary: 'Add employee to company registry',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['firstName', 'lastName', 'email'],
                                properties: {
                                    firstName: { type: 'string', example: 'Ana' },
                                    lastName: { type: 'string', example: 'Lim' },
                                    email: { type: 'string', example: 'ana.lim@archonnell.com' },
                                    departmentId: { type: 'string', format: 'uuid' },
                                    positionId: { type: 'string', format: 'uuid' },
                                    employmentStatus: { type: 'string', default: 'Regular' }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Employee record created with onboarding checklist.' } }
            }
        },
        '/hrms/employees/next-no': {
            get: {
                tags: ['HRMS'],
                summary: 'Get next auto-incremented employee number (e.g. EMP-0005)',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Next employee number.' } }
            }
        },
        '/hrms/jobs': {
            get: {
                tags: ['HRMS'],
                summary: 'Public list of open careers/job postings',
                responses: { 200: { description: 'List of active job vacancies.' } }
            },
            post: {
                tags: ['HRMS'],
                summary: 'Publish a new job vacancy (Admin)',
                security: [{ BearerAuth: [] }],
                responses: { 201: { description: 'Job posted.' } }
            }
        },
        '/hrms/applicants': {
            get: {
                tags: ['HRMS'],
                summary: 'List recruitment applicants (Admin)',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Applicant list.' } }
            },
            post: {
                tags: ['HRMS'],
                summary: 'Submit candidate job application from career portal',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['jobPostingId', 'firstName', 'lastName', 'email', 'phone'],
                                properties: {
                                    jobPostingId: { type: 'string', format: 'uuid' },
                                    firstName: { type: 'string', example: 'Mark' },
                                    lastName: { type: 'string', example: 'Rivera' },
                                    email: { type: 'string', example: 'mark.rivera@gmail.com' },
                                    phone: { type: 'string', example: '0922-333-4444' }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Application submitted.' } }
            }
        },
        '/hrms/applicants/{id}/hire': {
            post: {
                tags: ['HRMS'],
                summary: 'One-click convert hired candidate into full employee record',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: { 201: { description: 'Candidate hired and converted to employee.' } }
            }
        },
        // WFM
        '/wfm/shifts': {
            get: {
                tags: ['WFM'],
                summary: 'List configured work shifts',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Shifts list.' } }
            },
            post: {
                tags: ['WFM'],
                summary: 'Create a new shift schedule (Admin)',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name', 'startTime', 'endTime'],
                                properties: {
                                    name: { type: 'string', example: 'Day Logistics Shift' },
                                    startTime: { type: 'string', example: '08:00' },
                                    endTime: { type: 'string', example: '17:00' },
                                    breakMinutes: { type: 'number', default: 60 }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Shift created.' } }
            }
        },
        '/wfm/attendance/clock-in': {
            post: {
                tags: ['WFM'],
                summary: 'Kiosk / Web Clock-in endpoint with automated tardiness computation',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['employeeId'],
                                properties: {
                                    employeeId: { type: 'string', format: 'uuid' },
                                    verificationMethod: { type: 'string', default: 'kiosk' }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'Clock-in recorded.' } }
            }
        },
        '/wfm/attendance/clock-out': {
            post: {
                tags: ['WFM'],
                summary: 'Kiosk / Web Clock-out endpoint computing worked hours, overtime, and undertime',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['employeeId'],
                                properties: {
                                    employeeId: { type: 'string', format: 'uuid' }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'Clock-out recorded.' } }
            }
        },
        '/wfm/timesheets': {
            get: {
                tags: ['WFM'],
                summary: 'List cutoff timesheets for payroll reconciliation',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Timesheets list.' } }
            }
        },
        '/wfm/timesheets/generate': {
            post: {
                tags: ['WFM'],
                summary: 'Auto-aggregate attendance logs into submitted timesheet for a cutoff',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['employeeId', 'periodFrom', 'periodTo'],
                                properties: {
                                    employeeId: { type: 'string', format: 'uuid' },
                                    periodFrom: { type: 'string', example: '2026-10-01' },
                                    periodTo: { type: 'string', example: '2026-10-15' }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Timesheet generated.' } }
            }
        },
        '/wfm/intelligence/alerts': {
            get: {
                tags: ['WFM'],
                summary: 'AI Decision Support: Anomaly alerts for frequent tardiness and pending items',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Anomaly detection alerts.' } }
            }
        },
        // PAYROLL
        '/payroll/runs': {
            get: {
                tags: ['Payroll'],
                summary: 'List payroll runs with totals and statuses',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Payroll runs.' } }
            }
        },
        '/payroll/runs/compute': {
            post: {
                tags: ['Payroll'],
                summary: 'Execute Automated Payroll Computation Engine reading WFM timesheets & HR salaries',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['periodFrom', 'periodTo', 'payDate'],
                                properties: {
                                    periodFrom: { type: 'string', example: '2026-10-01' },
                                    periodTo: { type: 'string', example: '2026-10-15' },
                                    payDate: { type: 'string', example: '2026-10-15' },
                                    runType: { type: 'string', enum: ['regular', 'thirteenth-month'], default: 'regular' }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Payroll calculated and payslips generated.' } }
            }
        },
        '/payroll/runs/{id}': {
            get: {
                tags: ['Payroll'],
                summary: 'Get payroll run details with itemized payslips list',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: { 200: { description: 'Run details with employee payslips.' } }
            }
        },
        '/payroll/payslips/{id}': {
            get: {
                tags: ['Payroll'],
                summary: 'Get single payslip with itemized breakdown lines (SSS, PhilHealth, Tax, OT)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: { 200: { description: 'Payslip breakdown.' } }
            }
        },
        '/payroll/integrations/finance/payroll-runs': {
            get: {
                tags: ['Payroll'],
                summary: 'Finance Subsystem Integration: Read funded payroll amounts and funding receipts',
                responses: { 200: { description: 'Finance ledger payroll export.' } }
            }
        },
        // SHOP
        '/shop/categories': {
            get: {
                tags: ['Shop'],
                summary: 'Public list of chemical product categories',
                responses: { 200: { description: 'Categories list.' } }
            }
        },
        '/shop/products': {
            get: {
                tags: ['Shop'],
                summary: 'Public product catalog with search, filter, and ratings',
                parameters: [
                    { name: 'category', in: 'query', schema: { type: 'string' } },
                    { name: 'search', in: 'query', schema: { type: 'string' } }
                ],
                responses: { 200: { description: 'Product list.' } }
            }
        },
        '/shop/vouchers/validate': {
            post: {
                tags: ['Shop'],
                summary: 'Validate coupon/voucher discount against cart total',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['code', 'subtotal'],
                                properties: {
                                    code: { type: 'string', example: 'ARCHON10' },
                                    subtotal: { type: 'number', example: 5000.00 }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'Voucher valid.' } }
            }
        },
        '/shop/orders': {
            post: {
                tags: ['Shop'],
                summary: 'Cart checkout: Creates order and triggers automated Fleetops delivery dispatch',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['customerName', 'customerEmail', 'customerPhone', 'deliveryAddress', 'paymentMethod', 'subtotal', 'total', 'items'],
                                properties: {
                                    customerName: { type: 'string', example: 'Megaworld Construction' },
                                    customerEmail: { type: 'string', example: 'purchasing@megaworld.com' },
                                    customerPhone: { type: 'string', example: '0917-888-9999' },
                                    deliveryAddress: { type: 'string', example: 'BGC Tower 4 Site, Taguig City' },
                                    paymentMethod: { type: 'string', enum: ['GCash', 'Maya', 'Bank', 'COD'] },
                                    subtotal: { type: 'number', example: 12500.00 },
                                    total: { type: 'number', example: 12500.00 },
                                    items: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            properties: {
                                                title: { type: 'string', example: 'Waterproofing Membrane 20L' },
                                                price: { type: 'number', example: 2500.00 },
                                                quantity: { type: 'number', example: 5 },
                                                total: { type: 'number', example: 12500.00 }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Order created and logistics dispatch scheduled.' } }
            }
        },
        '/shop/orders/track/{identifier}': {
            get: {
                tags: ['Shop'],
                summary: 'Public order tracking returning live 5-stage shipment progression',
                parameters: [{ name: 'identifier', in: 'path', required: true, schema: { type: 'string' } }],
                responses: { 200: { description: 'Live tracking steps.' } }
            }
        },
        // FLEET
        '/fleet/vehicles': {
            get: {
                tags: ['Fleet'],
                summary: 'List fleet logistics vehicles and statuses (Available, On Trip)',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Vehicle inventory.' } }
            }
        },
        '/fleet/drivers': {
            get: {
                tags: ['Fleet'],
                summary: 'List drivers joined with HR employee data',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Driver list.' } }
            }
        },
        '/fleet/dispatches': {
            get: {
                tags: ['Fleet'],
                summary: 'Delivery dispatch board linking orders, vehicles, and assigned drivers',
                security: [{ BearerAuth: [] }],
                responses: { 200: { description: 'Dispatch list.' } }
            }
        },
        '/fleet/dispatches/{id}/assign': {
            patch: {
                tags: ['Fleet'],
                summary: 'Assign vehicle & driver. Cascades status to E-Commerce store tracking (Factory Packed)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['vehicleId', 'driverId'],
                                properties: {
                                    vehicleId: { type: 'string', format: 'uuid' },
                                    driverId: { type: 'string', format: 'uuid' }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'Dispatch assigned.' } }
            }
        },
        '/fleet/dispatches/{id}/start': {
            post: {
                tags: ['Fleet'],
                summary: 'Driver departs. Cascades status to E-Commerce store tracking (Out for Delivery)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                responses: { 200: { description: 'Delivery in transit.' } }
            }
        },
        '/fleet/dispatches/{id}/complete': {
            post: {
                tags: ['Fleet'],
                summary: 'Driver completes delivery with proof image. Cascades status to E-Commerce (Delivered)',
                security: [{ BearerAuth: [] }],
                parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }],
                requestBody: {
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                properties: {
                                    proofOfDeliveryUrl: { type: 'string' },
                                    endOdometer: { type: 'number' }
                                }
                            }
                        }
                    }
                },
                responses: { 200: { description: 'Delivery completed.' } }
            }
        },
        '/fleet/location': {
            post: {
                tags: ['Fleet'],
                summary: 'Driver mobile app transmits live GPS coordinates and speed',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['vehicleId', 'latitude', 'longitude'],
                                properties: {
                                    vehicleId: { type: 'string', format: 'uuid' },
                                    dispatchId: { type: 'string', format: 'uuid' },
                                    latitude: { type: 'number', example: 14.5995 },
                                    longitude: { type: 'number', example: 120.9842 },
                                    speed: { type: 'number', example: 45.2 }
                                }
                            }
                        }
                    }
                },
                responses: { 201: { description: 'GPS location breadcrumb saved.' } }
            }
        },
        // SHOP (SmartChain-compatible extensions)
        '/shop/orders/{identifier}/cancellation-requests': {
            post: {
                tags: ['Shop'],
                summary: 'Request early order cancellation (SmartChain-compatible)',
                parameters: [
                    { name: 'identifier', in: 'path', required: true, schema: { type: 'string' }, description: 'Order UUID, order_number, or external_order_id' }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['external_request_id', 'reason'],
                                properties: {
                                    external_request_id: { type: 'string', example: 'CANCEL-DEMO' },
                                    reason: { type: 'string', example: 'Customer requested early cancellation' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Identical replay returns original acknowledgment.' },
                    201: { description: 'Early-stage cancellation applied.' },
                    404: { description: 'Order not found.' },
                    422: { description: 'Order already dispatched or delivered.' }
                }
            }
        },
        '/shop/return-requests': {
            post: {
                tags: ['Shop'],
                summary: 'Submit one return line for review (SmartChain-compatible)',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['external_request_id', 'external_order_id', 'external_line_id', 'quantity', 'reason'],
                                properties: {
                                    external_request_id: { type: 'string', example: 'RET-DEMO' },
                                    external_order_id: { type: 'string', example: 'ORDER-DEMO' },
                                    external_line_id: { type: 'string', example: 'LINE-1' },
                                    quantity: { type: 'integer', example: 1 },
                                    reason: { type: 'string', example: 'DAMAGED' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Identical replay returns original acknowledgment.' },
                    201: { description: 'Return request reserved for Admin review.' }
                }
            }
        },
        // SMARTCHAIN INTEGRATION
        '/smartchain/logistics/status-events': {
            post: {
                tags: ['SmartChain'],
                summary: 'Report a shipment status event (IN_TRANSIT or DELIVERED)',
                description: 'Logistics callback signed via HMAC-SHA256 (`X-SmartChain-Partner`, `X-SmartChain-Timestamp`, `X-SmartChain-Signature`).',
                parameters: [
                    { name: 'X-SmartChain-Partner', in: 'header', required: true, schema: { type: 'string' }, example: 'DEMO_LOGISTICS' },
                    { name: 'X-SmartChain-Timestamp', in: 'header', required: true, schema: { type: 'string' }, example: '1700000000' },
                    { name: 'X-SmartChain-Signature', in: 'header', required: true, schema: { type: 'string' }, example: '0000000000000000000000000000000000000000000000000000000000000000' }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['schema_version', 'event_id', 'delivery_request_id', 'partner_delivery_request_id', 'status', 'occurred_at'],
                                properties: {
                                    schema_version: { type: 'string', example: '1.0' },
                                    event_id: { type: 'string', example: 'evt-demo-001' },
                                    delivery_request_id: { type: 'string', format: 'uuid', example: 'd290f1ee-6c54-4b01-90e6-d701748f0851' },
                                    partner_delivery_request_id: { type: 'string', example: 'LSP-DEMO-001' },
                                    status: { type: 'string', enum: ['IN_TRANSIT', 'DELIVERED'], example: 'IN_TRANSIT' },
                                    occurred_at: { type: 'string', format: 'date-time', example: '2026-01-15T09:30:00+08:00' },
                                    note: { type: 'string', nullable: true, example: 'Shipment departed the warehouse.' },
                                    proof_reference: { type: 'string', nullable: true }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Event applied, duplicate, or ignored out of order.' },
                    401: { description: 'Invalid or stale signature headers.' },
                    403: { description: 'Partner does not own the delivery request.' },
                    404: { description: 'Delivery request UUID not found.' },
                    409: { description: 'Event ID conflict or partner reference mismatch.' },
                    422: { description: 'Validation error or unknown fields.' }
                }
            }
        },
        '/smartchain/logistics/delivery-requests': {
            get: {
                tags: ['SmartChain'],
                summary: 'List SmartChain delivery requests',
                responses: { 200: { description: 'Delivery requests returned.' } }
            },
            post: {
                tags: ['SmartChain'],
                summary: 'Submit delivery request (SmartChain to Logistics)',
                parameters: [
                    { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string', format: 'uuid' } },
                    { name: 'X-Correlation-ID', in: 'header', required: false, schema: { type: 'string', format: 'uuid' } }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['delivery_request_id', 'order_reference', 'shipment_reference', 'partner_code', 'items'],
                                properties: {
                                    schema_version: { type: 'string', example: '1.0' },
                                    source_system: { type: 'string', example: 'SMARTCHAIN' },
                                    delivery_request_id: { type: 'string', format: 'uuid', example: 'd290f1ee-6c54-4b01-90e6-d701748f0851' },
                                    order_reference: { type: 'string', example: 'ORD-DEMO' },
                                    shipment_reference: { type: 'string', example: 'PKG-DEMO' },
                                    partner_code: { type: 'string', example: 'DEMO_LOGISTICS' },
                                    pickup: { type: 'object' },
                                    recipient: { type: 'object' },
                                    required_delivery_at: { type: 'string', format: 'date-time' },
                                    items: { type: 'array', items: { type: 'object' } },
                                    callback: { type: 'object' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Replayed delivery request acknowledgment.' },
                    201: { description: 'Delivery request accepted and mirrored to Fleetops.' }
                }
            }
        },
        '/smartchain/financial/events': {
            post: {
                tags: ['SmartChain'],
                summary: 'Record a pending financial event (Finance to SmartChain)',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['schema_version', 'event_id', 'event_type', 'occurred_at', 'reference', 'status'],
                                properties: {
                                    schema_version: { type: 'string', example: '1.0' },
                                    event_id: { type: 'string', example: 'FIN-EVT-DEMO' },
                                    event_type: { type: 'string', example: 'AP_PAYMENT_UPDATE' },
                                    occurred_at: { type: 'string', example: '2026-12-02T14:00:00+08:00' },
                                    reference: { type: 'string', example: 'AP-DEMO' },
                                    status: { type: 'string', example: 'PAID' },
                                    amount: { type: 'string', example: '20.00' },
                                    currency: { type: 'string', example: 'PHP' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Identical replay returns original acknowledgment.' },
                    201: { description: 'Correlated event recorded for review.' },
                    409: { description: 'Identity reused with different data.' }
                }
            }
        },
        '/smartchain/finance/purchase-orders': {
            post: {
                tags: ['SmartChain'],
                summary: 'Submit purchase order (SmartChain to Finance)',
                parameters: [
                    { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string', format: 'uuid' } },
                    { name: 'X-Correlation-ID', in: 'header', required: false, schema: { type: 'string', format: 'uuid' } }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['message_id', 'external_reference_id', 'category_type', 'total_amount', 'supplier', 'items'],
                                properties: {
                                    schema_version: { type: 'string', example: '1.0' },
                                    source_system: { type: 'string', example: 'SMARTCHAIN' },
                                    message_id: { type: 'string', format: 'uuid', example: '899e4394-655b-49ea-8074-d4687382e565' },
                                    external_reference_id: { type: 'string', example: 'PO-DEMO' },
                                    category_type: { type: 'string', example: 'INVENTORY_PURCHASE' },
                                    currency: { type: 'string', example: 'PHP' },
                                    total_amount: { type: 'string', example: '20.00' },
                                    supplier: { type: 'object' },
                                    items: { type: 'array', items: { type: 'object' } }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Existing PO intake acknowledged.' },
                    201: { description: 'New PO intake recorded.' }
                }
            }
        },
        '/smartchain/finance/request-disbursement': {
            post: {
                tags: ['SmartChain'],
                summary: 'Submit AP obligation / disbursement request (SmartChain to Finance)',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['external_module', 'external_reference_id', 'category_type', 'amount', 'payee_info'],
                                properties: {
                                    external_module: { type: 'string', example: 'SUPPLY_CHAIN' },
                                    external_reference_id: { type: 'string', example: 'AP-DEMO' },
                                    category_type: { type: 'string', example: 'INVENTORY_PURCHASE' },
                                    amount: { type: 'number', example: 20 },
                                    payee_info: { type: 'object' },
                                    description: { type: 'string', example: 'QA-accepted inventory for PO-DEMO' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    200: { description: 'Bill created with bill_number, transaction_code, and status UNPAID.' }
                }
            }
        },
        '/smartchain/finance/events': {
            get: {
                tags: ['SmartChain'],
                summary: 'List recorded SmartChain financial events, purchase orders, and disbursements',
                responses: { 200: { description: 'Finance records returned.' } }
            }
        },
        // PDMS INTEGRATION
        '/pdms/workforce-records': {
            get: {
                tags: ['PDMS'],
                summary: 'List HR2/WFM workforce records synced to PDMS',
                security: [{ BearerAuth: [] }],
                parameters: [
                    { name: 'employee_code', in: 'query', schema: { type: 'string' }, example: 'EMP-0001' }
                ],
                responses: {
                    200: {
                        description: 'Workforce records returned.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    data: [
                                        {
                                            id: '7d1f2e3a-4b5c-6d7e-8f9a-0b1c2d3e4f5a',
                                            employee_code: 'EMP-0001',
                                            first_name: 'Gabriel',
                                            last_name: 'Dela Cruz',
                                            period_start: '2026-11-01',
                                            period_end: '2026-11-30',
                                            scheduled_days: 22,
                                            days_present: 21,
                                            days_absent: 1,
                                            late_count: 2,
                                            total_late_minutes: 35,
                                            overtime_hours: '4.50',
                                            leave_days: 1,
                                            unexcused_absences: 0,
                                            disciplinary_actions: 0,
                                            attendance_rate: '95.45',
                                            external_ref: 'HR2-2026-11-EMP-0001',
                                            source: 'hr2_api'
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            post: {
                tags: ['PDMS'],
                summary: 'Ingest HR2/WFM workforce records batch (up to 500 rows)',
                description: 'Accepts attendance, lateness, leave, and overtime figures per employee period, computes attendance_rate, and upserts idempotently.',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['records'],
                                properties: {
                                    records: {
                                        type: 'array',
                                        items: {
                                            type: 'object',
                                            required: ['employee_code', 'period_start', 'period_end', 'scheduled_days'],
                                            properties: {
                                                employee_code: { type: 'string', example: 'EMP-0001' },
                                                period_start: { type: 'string', format: 'date', example: '2026-11-01' },
                                                period_end: { type: 'string', format: 'date', example: '2026-11-30' },
                                                scheduled_days: { type: 'integer', example: 22 },
                                                days_present: { type: 'integer', example: 21 },
                                                days_absent: { type: 'integer', example: 1 },
                                                late_count: { type: 'integer', example: 2 },
                                                total_late_minutes: { type: 'integer', example: 35 },
                                                overtime_hours: { type: 'number', example: 4.5 },
                                                leave_days: { type: 'integer', example: 1 },
                                                unexcused_absences: { type: 'integer', example: 0 },
                                                disciplinary_actions: { type: 'integer', example: 0 },
                                                external_ref: { type: 'string', example: 'HR2-2026-11-EMP-0001' }
                                            }
                                        }
                                    }
                                }
                            },
                            example: {
                                records: [
                                    {
                                        employee_code: 'EMP-0001',
                                        period_start: '2026-11-01',
                                        period_end: '2026-11-30',
                                        scheduled_days: 22,
                                        days_present: 21,
                                        days_absent: 1,
                                        late_count: 2,
                                        total_late_minutes: 35,
                                        overtime_hours: 4.5,
                                        leave_days: 1,
                                        unexcused_absences: 0,
                                        disciplinary_actions: 0,
                                        external_ref: 'HR2-2026-11-EMP-0001'
                                    }
                                ]
                            }
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'Returns { accepted, rejected } batch summary.',
                        content: {
                            'application/json': {
                                example: { accepted: 1, rejected: [] }
                            }
                        }
                    },
                    422: { description: 'records missing or exceeds 500 rows.' }
                }
            }
        },
        '/pdms/workforce-records/sync-from-wfm': {
            post: {
                tags: ['PDMS'],
                summary: 'Aggregate live WFM attendance, schedules, leaves & overtime into PDMS workforce records',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['period_start', 'period_end'],
                                properties: {
                                    period_start: { type: 'string', format: 'date', example: '2026-11-01' },
                                    period_end: { type: 'string', format: 'date', example: '2026-11-30' }
                                }
                            },
                            example: { period_start: '2026-11-01', period_end: '2026-11-30' }
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'WFM metrics synced into PDMS.',
                        content: {
                            'application/json': {
                                example: { success: true, accepted: 25, rejected: [] }
                            }
                        }
                    }
                }
            }
        },
        '/pdms/dashboard': {
            get: {
                tags: ['PDMS'],
                summary: 'Get PDMS dashboard counts and average performance health score',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Dashboard summary returned.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    data: {
                                        counts: {
                                            employees: 25,
                                            active_goals: 12,
                                            reviews: 22,
                                            courses: 12,
                                            trainings: 13,
                                            recognitions: 26,
                                            vacant_positions: 2
                                        },
                                        performance_health: {
                                            average_score: 84.9,
                                            completed: 12,
                                            pending: 3,
                                            total: 22
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/pdms/competencies': {
            get: {
                tags: ['PDMS'],
                summary: 'List active competencies',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Competencies list.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    data: [
                                        {
                                            id: '11111111-2222-3333-4444-555555555555',
                                            code: 'COMP-001',
                                            name: 'Chemical Quality Assurance',
                                            category: 'Technical',
                                            description: 'Ability to inspect raw materials and batch outputs against ISO standards.',
                                            is_active: true,
                                            created_at: '2026-11-25T12:00:00.000Z'
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            post: {
                tags: ['PDMS'],
                summary: 'Create a competency',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name'],
                                properties: {
                                    code: { type: 'string', example: 'COMP-001' },
                                    name: { type: 'string', example: 'Chemical Quality Assurance' },
                                    category: { type: 'string', example: 'Technical' },
                                    description: { type: 'string', example: 'Ability to inspect raw materials and batch outputs.' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    201: {
                        description: 'Competency created.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    data: {
                                        id: '11111111-2222-3333-4444-555555555555',
                                        code: 'COMP-001',
                                        name: 'Chemical Quality Assurance',
                                        category: 'Technical',
                                        is_active: true
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/pdms/goals': {
            get: {
                tags: ['PDMS'],
                summary: 'List employee & organizational goals',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Goals list.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    data: [
                                        {
                                            id: '22222222-3333-4444-5555-666666666666',
                                            employee_id: 'fc84931c-ffd2-451f-a7d1-005f3dafe08b',
                                            employee_code: 'EMP-0001',
                                            first_name: 'Gabriel',
                                            last_name: 'Dela Cruz',
                                            title: 'Reduce Batch Defect Rate Below 1.5%',
                                            description: 'Implement automated lab sampling checks on every production shift.',
                                            progress: '75.00',
                                            weight: 75,
                                            status: 'In Progress',
                                            due_date: '2026-12-31'
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            post: {
                tags: ['PDMS'],
                summary: 'Create a goal',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['title'],
                                properties: {
                                    employee_id: { type: 'string', format: 'uuid', example: 'fc84931c-ffd2-451f-a7d1-005f3dafe08b' },
                                    title: { type: 'string', example: 'Reduce Batch Defect Rate Below 1.5%' },
                                    description: { type: 'string', example: 'Implement automated lab sampling checks.' },
                                    progress: { type: 'number', example: 25 },
                                    weight: { type: 'integer', example: 75 },
                                    status: { type: 'string', example: 'In Progress' },
                                    due_date: { type: 'string', format: 'date', example: '2026-12-31' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    201: {
                        description: 'Goal created.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    data: {
                                        id: '22222222-3333-4444-5555-666666666666',
                                        title: 'Reduce Batch Defect Rate Below 1.5%',
                                        progress: '25.00',
                                        weight: 75,
                                        status: 'In Progress'
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/pdms/kpis': {
            get: {
                tags: ['PDMS'],
                summary: 'List KPIs',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'KPIs list.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    data: [
                                        {
                                            id: '33333333-4444-5555-6666-777777777777',
                                            name: 'On-Time Delivery & Attendance Rate',
                                            source: 'goals.progress',
                                            unit: '%',
                                            target_value: '95.00',
                                            direction: 'higher',
                                            frequency: 'monthly',
                                            is_active: true
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            post: {
                tags: ['PDMS'],
                summary: 'Create a KPI',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['name'],
                                properties: {
                                    name: { type: 'string', example: 'On-Time Delivery & Attendance Rate' },
                                    source: { type: 'string', example: 'manual' },
                                    unit: { type: 'string', example: '%' },
                                    target_value: { type: 'number', example: 95 },
                                    direction: { type: 'string', enum: ['higher', 'lower'], example: 'higher' },
                                    frequency: { type: 'string', example: 'monthly' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    201: {
                        description: 'KPI created.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    data: {
                                        id: '33333333-4444-5555-6666-777777777777',
                                        name: 'On-Time Delivery & Attendance Rate',
                                        unit: '%',
                                        target_value: '95.00',
                                        direction: 'higher'
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/pdms/performance-reviews': {
            get: {
                tags: ['PDMS'],
                summary: 'List performance reviews',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Performance reviews list.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    data: [
                                        {
                                            id: '44444444-5555-6666-7777-888888888888',
                                            employee_id: 'fc84931c-ffd2-451f-a7d1-005f3dafe08b',
                                            employee_code: 'EMP-0001',
                                            first_name: 'Gabriel',
                                            last_name: 'Dela Cruz',
                                            cycle_name: 'Q4 2026 Annual Review',
                                            score: '88.50',
                                            status: 'Completed',
                                            comments: 'Consistent quality assurance output and zero safety incidents.'
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            post: {
                tags: ['PDMS'],
                summary: 'Create a performance review',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['cycle_name'],
                                properties: {
                                    employee_id: { type: 'string', format: 'uuid', example: 'fc84931c-ffd2-451f-a7d1-005f3dafe08b' },
                                    cycle_name: { type: 'string', example: 'Q4 2026 Annual Review' },
                                    score: { type: 'number', example: 88.5 },
                                    status: { type: 'string', example: 'Completed' },
                                    comments: { type: 'string', example: 'Consistent quality assurance output.' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    201: {
                        description: 'Performance review created.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    data: {
                                        id: '44444444-5555-6666-7777-888888888888',
                                        cycle_name: 'Q4 2026 Annual Review',
                                        score: '88.50',
                                        status: 'Completed'
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/pdms/courses': {
            get: {
                tags: ['PDMS'],
                summary: 'List learning courses',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Courses list.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    data: [
                                        {
                                            id: '55555555-6666-7777-8888-999999999999',
                                            title: 'ISO 9001 & Chemical Handling Safety',
                                            category: 'Compliance',
                                            duration_minutes: 120,
                                            is_published: true
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        },
        '/pdms/trainings': {
            get: {
                tags: ['PDMS'],
                summary: 'List training programs',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Trainings list.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    data: [
                                        {
                                            id: '66666666-7777-8888-9999-aaaaaaaaaaaa',
                                            title: 'Batching Plant Operations Bootcamp',
                                            trainer_name: 'Engr. Marco Santos',
                                            start_date: '2026-12-01',
                                            end_date: '2026-12-03',
                                            status: 'Scheduled'
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        },
        '/pdms/succession-positions': {
            get: {
                tags: ['PDMS'],
                summary: 'List succession planning positions',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Succession positions list.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    data: [
                                        {
                                            id: '77777777-8888-9999-aaaa-bbbbbbbbbbbb',
                                            title: 'Senior Plant Operations Supervisor',
                                            urgency: 'High',
                                            readiness_target: 'Ready in 6 Months',
                                            vacant_since: '2026-10-15'
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        },
        '/pdms/recognitions': {
            get: {
                tags: ['PDMS'],
                summary: 'List social recognitions',
                security: [{ BearerAuth: [] }],
                responses: {
                    200: {
                        description: 'Recognitions list.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    data: [
                                        {
                                            id: '88888888-9999-aaaa-bbbb-cccccccccccc',
                                            recipient_first_name: 'Gabriel',
                                            recipient_last_name: 'Dela Cruz',
                                            sender_first_name: 'Vincent',
                                            sender_last_name: 'De Leon',
                                            category: 'Safety Excellence',
                                            message: 'Zero-defect batch testing across 30 consecutive shifts.',
                                            status: 'Approved'
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            post: {
                tags: ['PDMS'],
                summary: 'Create a social recognition',
                security: [{ BearerAuth: [] }],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            schema: {
                                type: 'object',
                                required: ['message'],
                                properties: {
                                    recipient_employee_id: { type: 'string', format: 'uuid', example: 'fc84931c-ffd2-451f-a7d1-005f3dafe08b' },
                                    sender_employee_id: { type: 'string', format: 'uuid' },
                                    category: { type: 'string', example: 'Safety Excellence' },
                                    message: { type: 'string', example: 'Zero-defect batch testing across 30 consecutive shifts.' }
                                }
                            }
                        }
                    }
                },
                responses: {
                    201: {
                        description: 'Recognition created.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    data: {
                                        id: '88888888-9999-aaaa-bbbb-cccccccccccc',
                                        category: 'Safety Excellence',
                                        message: 'Zero-defect batch testing across 30 consecutive shifts.',
                                        status: 'Approved'
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        // ESFA INTEGRATION (Support, Finance & Administration)
        '/esfa/tickets': {
            get: {
                tags: ['ESFA'],
                summary: 'List support tickets',
                responses: {
                    200: {
                        description: 'Tickets returned.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    data: [
                                        {
                                            reference: 'TCK-000045',
                                            requester_type: 'customer',
                                            requester_external_id: 'cus-1001',
                                            order_external_id: 'ord-5001',
                                            subject: 'Item arrived damaged',
                                            category: 'refund_return',
                                            priority: 'high',
                                            status: 'open'
                                        }
                                    ]
                                }
                            }
                        }
                    }
                }
            },
            post: {
                tags: ['ESFA'],
                summary: 'Create a customer support ticket',
                parameters: [
                    { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' }, example: '6f1c2a3e-0004' }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            example: {
                                requester_type: 'customer',
                                requester_external_id: 'cus-1001',
                                order_external_id: 'ord-5001',
                                payment_reference: 'PAY-2026-000123',
                                subject: 'Item arrived damaged',
                                description: 'The box was crushed.',
                                channel: 'marketplace_app',
                                category: 'refund_return',
                                priority: 'high'
                            }
                        }
                    }
                },
                responses: {
                    201: {
                        description: 'Ticket created.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    ticket: { reference: 'TCK-000045', status: 'open', priority: 'high' }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/esfa/tickets/{reference}': {
            get: {
                tags: ['ESFA'],
                summary: 'Get ticket conversation by reference',
                parameters: [{ name: 'reference', in: 'path', required: true, schema: { type: 'string' }, example: 'TCK-000045' }],
                responses: {
                    200: {
                        description: 'Ticket details and messages.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    ticket: { reference: 'TCK-000045', subject: 'Item arrived damaged', status: 'in_progress', messages: [] }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/esfa/tickets/{reference}/messages': {
            post: {
                tags: ['ESFA'],
                summary: 'Reply to a support ticket',
                parameters: [{ name: 'reference', in: 'path', required: true, schema: { type: 'string' }, example: 'TCK-000045' }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { example: { body: 'Here is a photo of the damaged item.', author_type: 'customer' } } }
                },
                responses: { 201: { description: 'Message added.' } }
            }
        },
        '/esfa/tickets/{reference}/csat': {
            post: {
                tags: ['ESFA'],
                summary: 'Submit CSAT rating (1-5) for a ticket',
                parameters: [{ name: 'reference', in: 'path', required: true, schema: { type: 'string' }, example: 'TCK-000045' }],
                requestBody: {
                    required: true,
                    content: { 'application/json': { example: { score: 5, comment: 'Quick help.' } } }
                },
                responses: { 200: { description: 'CSAT recorded.' } }
            }
        },
        '/esfa/kb/articles': {
            get: {
                tags: ['ESFA'],
                summary: 'List published Knowledge Base articles',
                responses: {
                    200: {
                        description: 'Knowledge Base articles.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    data: [{ slug: 'return-policy', title: 'How to Request a Return or Refund', category: 'Returns' }]
                                }
                            }
                        }
                    }
                }
            }
        },
        '/esfa/payments': {
            post: {
                tags: ['ESFA'],
                summary: 'Create a payment (amounts in centavos, PHP)',
                parameters: [
                    { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' }, example: '6f1c2a3e-0001' }
                ],
                requestBody: {
                    required: true,
                    content: { 'application/json': { example: { order_external_id: 'ord-5001', method: 'gcash', amount: 158000 } } }
                },
                responses: {
                    201: {
                        description: 'Payment processed.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    payment: { reference: 'PAY-2026-000123', status: 'captured', amount: 158000, currency: 'PHP' },
                                    next_action: null
                                }
                            }
                        }
                    }
                }
            }
        },
        '/esfa/payments/{reference}': {
            get: {
                tags: ['ESFA'],
                summary: 'Get payment by reference',
                parameters: [{ name: 'reference', in: 'path', required: true, schema: { type: 'string' }, example: 'PAY-2026-000123' }],
                responses: { 200: { description: 'Payment returned.' } }
            }
        },
        '/esfa/refunds': {
            post: {
                tags: ['ESFA'],
                summary: 'Request a refund (centavos)',
                parameters: [
                    { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' }, example: '6f1c2a3e-0002' }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            example: { payment_reference: 'PAY-2026-000123', amount: 75000, reason: 'damaged', notes: 'One item arrived broken.' }
                        }
                    }
                },
                responses: {
                    201: {
                        description: 'Refund request created.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    refund: { reference: 'REF-2026-000012', payment_reference: 'PAY-2026-000123', amount: 75000, status: 'pending_review' }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/esfa/refunds/{reference}': {
            get: {
                tags: ['ESFA'],
                summary: 'Get refund by reference',
                parameters: [{ name: 'reference', in: 'path', required: true, schema: { type: 'string' }, example: 'REF-2026-000012' }],
                responses: { 200: { description: 'Refund returned.' } }
            }
        },
        '/esfa/quotes': {
            post: {
                tags: ['ESFA'],
                summary: 'Calculate shipping quotes',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            example: {
                                origin_code: '1380200000',
                                destination_code: '1380300000',
                                weight_grams: 1200,
                                dimensions: { length_cm: '30', width_cm: '20', height_cm: '10' },
                                cod_amount: 0
                            }
                        }
                    }
                },
                responses: {
                    200: {
                        description: 'Sorted courier quotes.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    quotes: [
                                        { courier_id: 1, courier_name: 'Archon Nell Fleet Express', service_type: 'standard', fee_amount: 9000, currency: 'PHP', estimated_days: 2, recommended: true }
                                    ]
                                }
                            }
                        }
                    }
                }
            }
        },
        '/esfa/shipments': {
            post: {
                tags: ['ESFA'],
                summary: 'Book a shipment',
                parameters: [
                    { name: 'Idempotency-Key', in: 'header', required: false, schema: { type: 'string' }, example: '6f1c2a3e-0003' }
                ],
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            example: {
                                order_external_id: 'ord-5001',
                                seller_external_id: 'sel-77',
                                courier_id: 1,
                                service_type: 'standard',
                                destination: { line1: '12 Sample Street', postal_code: '1740', contact_name: 'Juan Dela Cruz', contact_phone: '09170000000' },
                                weight_grams: 1200,
                                tracking_number: 'TRK-0001'
                            }
                        }
                    }
                },
                responses: { 201: { description: 'Shipment booked.' } }
            }
        },
        '/esfa/shipments/{reference}': {
            get: {
                tags: ['ESFA'],
                summary: 'Get shipment by reference or tracking number',
                parameters: [{ name: 'reference', in: 'path', required: true, schema: { type: 'string' }, example: 'TRK-0001' }],
                responses: { 200: { description: 'Shipment returned.' } }
            }
        },
        '/esfa/analytics/summary': {
            get: {
                tags: ['ESFA'],
                summary: 'Get ESFA support, payments, refunds, and shipments summary',
                responses: {
                    200: {
                        description: 'Analytics summary.',
                        content: {
                            'application/json': {
                                example: {
                                    success: true,
                                    data: {
                                        tickets: { total: 14, open: 3 },
                                        payments: { total: 28, total_amount: 4520000 },
                                        refunds: { total: 2, total_amount: 150000 },
                                        shipments: { total: 25 }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        '/esfa/webhook-endpoints': {
            get: {
                tags: ['ESFA'],
                summary: 'List registered ESFA outbound webhook endpoints',
                responses: { 200: { description: 'Webhook endpoints returned.' } }
            },
            post: {
                tags: ['ESFA'],
                summary: 'Register an ESFA outbound webhook endpoint',
                requestBody: {
                    required: true,
                    content: {
                        'application/json': {
                            example: { url: 'https://api.archonnellincorporated.com/api/v1/smartchain/logistics/status-events', events: ['payment.captured', 'shipment.status_changed'] }
                        }
                    }
                },
                responses: { 201: { description: 'Webhook endpoint registered.' } }
            }
        },
        // STUBS
        '/stubs/finance/accounts': {
            get: {
                tags: ['Stubs'],
                summary: 'Finance general ledger account balances stub',
                responses: { 200: { description: 'Account balances.' } }
            }
        },
        '/stubs/scm/warehouses': {
            get: {
                tags: ['Stubs'],
                summary: 'Supply chain warehouse capacity and utilization stub',
                responses: { 200: { description: 'Warehouses list.' } }
            }
        }
    }
};
