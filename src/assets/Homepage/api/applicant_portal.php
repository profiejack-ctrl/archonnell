<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

/**
 * Applicant Portal JSON API (frontend/src/public/pages/portal).
 *
 * An applicant signs in with their Application ID, e-mail address and date of
 * birth. While outgoing mail is configured (the same rule the HRMS login
 * follows) a one-time code is also e-mailed to the address on file.
 *
 * The status shown is read live from the HRMS Applicant Management record
 * (archon_nell.applicants, bridged by application number), so every change HR
 * makes appears here; the updates list comes from the audit log entries the
 * HR actions already write. The applicant writes only their own answers
 * (future opportunity preference, job opportunity response, recruitment
 * feedback - config/talent_pool.php). No database id is sent to the browser:
 * the application is taken from the signed-in session only.
 *
 *   GET  session      is this browser signed in / waiting for a code
 *   POST login        application_number, email, date_of_birth
 *   POST verify       code
 *   POST resend       send a new code
 *   POST cancel       drop the pending code step
 *   POST logout
 *   GET  dashboard    the signed-in application (passive=1: background refresh)
 *   POST future_preference    choice=yes|no   (Talent Pool consent of this application)
 *   POST opportunity_respond  opportunity_no, choice=accept|decline (own invitations only)
 *   POST submit_feedback      ratings + comments (this application, after rejection)
 *   POST offer_respond        choice=accept|decline, reason (this application's own job offer; until the expiration date)
 *   POST interview_respond    round=Pre-Interview|Final Interview, choice=confirm|decline, reason
 *                             (attendance confirmation of this application's interview; 3-day deadline)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/hrms_bridge.php';
require_once __DIR__ . '/applicant_portal_auth.php';
require_once dirname(__DIR__, 2) . '/config/mailer.php';
require_once dirname(__DIR__, 2) . '/config/talent_pool.php';
require_once dirname(__DIR__, 2) . '/config/interview_confirmation.php';
require_once dirname(__DIR__, 2) . '/config/job_offer_response.php';

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

const AP_MAX_CODE_ATTEMPTS = 5;
const AP_RESEND_COOLDOWN   = 60;
const AP_MAX_RESENDS       = 5;
const AP_MAIN_OFFICE       = 'Main Office (Cainta, Rizal)';

/** HR actions (api.php) whose audit entries become applicant updates. */
const AP_EVENT_ACTIONS = [
    'Applicant Scheduled', 'Applicant Advanced', 'Final Interview Scheduled',
    'Final Interview Rescheduled', 'Job Offer Extended', 'Applicant Hired', 'Applicant Rejected',
    // Talent Pool / future opportunities (config/talent_pool.php).
    'Future Opportunity Invitation Sent', 'Applicant Accepted Future Opportunities', 'Applicant Declined Future Opportunities',
    'Talent Pool Applicant Contacted', 'Future Opportunity Accepted', 'Future Opportunity Declined', 'Applicant Feedback Submitted',
    // Interview attendance confirmation (config/interview_confirmation.php).
    'Pre-Interview Rescheduled', 'Applicant Confirmed Interview Attendance', 'Applicant Declined Interview Attendance', 'Interview Confirmation Expired',
    // Job offer answered by the applicant (config/job_offer_response.php).
    'Applicant Accepted Job Offer', 'Applicant Declined Job Offer', 'Applicant Job Offer Expired',
];

/** Codes live as long as the HRMS login codes (OTP_EXPIRATION_SECONDS, default 2 minutes). */
function ap_code_ttl(): int
{
    $seconds = (int)(env_get('OTP_EXPIRATION_SECONDS') ?? 0);
    return $seconds >= 60 ? $seconds : 120;
}

/** The HRMS mailer; false when it cannot be loaded. */
function ap_mailer_ready(): bool
{
    $path = dirname(__DIR__, 2) . '/config/mailer.php';
    if (!is_file($path)) {
        return false;
    }
    require_once $path;
    return function_exists('send_applicant_portal_code_email') && function_exists('mail_is_configured') && mail_is_configured();
}

function ap_mask_email(string $email): string
{
    [$local, $domain] = array_pad(explode('@', $email, 2), 2, '');
    $shown = mb_substr($local, 0, mb_strlen($local) > 2 ? 2 : 1);
    return $shown . str_repeat('*', max(3, mb_strlen($local) - mb_strlen($shown))) . '@' . $domain;
}

function ap_require_post(): void
{
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        json_response(['success' => false, 'message' => 'Method not allowed'], 405);
    }
    $token = $_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '');
    if (!verify_csrf_token($token)) {
        json_response([
            'success'    => false,
            'csrf_token' => generate_csrf_token(),
            'message'    => 'Invalid security token. Please refresh the page.',
        ], 403);
    }
}

/** The portal application row (with the applicant's contact details), or null. */
function ap_find_application(string $applicationNumber): ?array
{
    $applicationNumber = trim($applicationNumber);
    if ($applicationNumber === '') {
        return null;
    }
    $row = db()->fetchOne(
        "SELECT a.application_number, a.applicant_id, a.job_position_id, a.submitted_at, a.created_at,
                jp.job_title, ap.applicant_number, ap.first_name, ap.middle_name, ap.last_name,
                ap.email, ap.mobile_number, ap.date_of_birth, ap.address, ap.city, ap.province
         FROM applications a
         JOIN applicants ap ON ap.id = a.applicant_id
         LEFT JOIN job_positions jp ON jp.id = a.job_position_id
         WHERE UPPER(a.application_number) = UPPER(?) OR UPPER(ap.applicant_number) = UPPER(?)
         ORDER BY a.id DESC
         LIMIT 1",
        [$applicationNumber, $applicationNumber]
    );
    if ($row) {
        return $row;
    }

    // Direct HRMS applicant lookup fallback (for applicants created directly in HRMS)
    try {
        $hr = ap_hrms();
        $stmt = $hr->prepare(
            "SELECT id, applicant_no, source_application_no, first_name, middle_name, last_name,
                    email, mobile_number, date_of_birth, address, position, job_posting_id,
                    applied_at, created_at, resume_path
             FROM applicants
             WHERE UPPER(source_application_no) = UPPER(:q) OR UPPER(applicant_no) = UPPER(:q)
             ORDER BY id DESC LIMIT 1"
        );
        $stmt->execute(['q' => $applicationNumber]);
        $hrRow = $stmt->fetch();
        if ($hrRow) {
            return [
                'application_number' => $hrRow['source_application_no'] ?: $hrRow['applicant_no'],
                'applicant_id'      => -(int)$hrRow['id'],
                'job_position_id'   => null,
                'submitted_at'      => $hrRow['applied_at'] ?: $hrRow['created_at'],
                'created_at'        => $hrRow['created_at'],
                'job_title'         => $hrRow['position'],
                'applicant_number'  => $hrRow['applicant_no'],
                'first_name'        => $hrRow['first_name'],
                'middle_name'       => $hrRow['middle_name'],
                'last_name'         => $hrRow['last_name'],
                'email'             => $hrRow['email'],
                'mobile_number'     => $hrRow['mobile_number'],
                'date_of_birth'     => $hrRow['date_of_birth'],
                'address'           => $hrRow['address'],
                'city'              => '',
                'province'          => '',
                '_hr_record'        => $hrRow,
            ];
        }
    } catch (Throwable $e) {
        error_log('ap_find_application HRMS fallback: ' . $e->getMessage());
    }

    return null;
}

function ap_full_name(array $app): string
{
    return trim(preg_replace('/\s+/', ' ', ($app['first_name'] ?? '') . ' ' . ($app['middle_name'] ?? '') . ' ' . ($app['last_name'] ?? '')));
}

/** E-mail a new code and store its hash for this browser session. */
function ap_issue_code(array $app, int $resends): array
{
    $code = (string)random_int(100000, 999999);
    $ttl  = ap_code_ttl();
    $sent = send_applicant_portal_code_email((string)$app['email'], [
        'name'    => ap_full_name($app),
        'code'    => $code,
        'minutes' => max(1, (int)round($ttl / 60)),
    ]);
    if (empty($sent['success'])) {
        error_log('applicant portal code e-mail failed: ' . ($sent['error'] ?? 'unknown error'));
        return ['success' => false];
    }
    $_SESSION['applicant_portal_pending'] = [
        'application_number' => (string)$app['application_number'],
        'hash'               => password_hash($code, PASSWORD_DEFAULT),
        'expires'            => time() + $ttl,
        'attempts'           => 0,
        'resends'            => $resends,
        'last_sent'          => time(),
        'email'              => ap_mask_email((string)$app['email']),
    ];
    return ['success' => true, 'expires_in' => $ttl, 'resend_in' => AP_RESEND_COOLDOWN];
}

/** The pending code step for the browser (masked e-mail + timers), or null. */
function ap_pending_state(): ?array
{
    $p = $_SESSION['applicant_portal_pending'] ?? null;
    if (!is_array($p)) {
        return null;
    }
    return [
        'email'      => $p['email'],
        'expires_in' => max(0, (int)$p['expires'] - time()),
        'resend_in'  => max(0, AP_RESEND_COOLDOWN - (time() - (int)$p['last_sent'])),
    ];
}

/* =====================================================================
 * Dashboard data
 * ===================================================================== */

/** The HRMS database (throws when it cannot be reached, so no stale status is shown). */
function ap_hrms(): PDO
{
    $pdo = hrms_bridge_pdo();
    if (!$pdo) {
        throw new RuntimeException('HRMS database unavailable');
    }
    return $pdo;
}

/** The Applicant Management record behind a portal application, or null before HR has it. */
function ap_hr_record(PDO $hr, string $applicationNumber, string $applicantNumber): ?array
{
    $cols = "id, applicant_no, source_application_no, stage, status, position, updated_at,
             pre_interview_at, interview_type, interview_location, interviewer,
             final_interview_at, final_interview_type, final_interview_location, final_interviewer,
             rejection_stage, rejection_reason, rejected_at, resume_path, job_posting_id,
             (pre_interview_at > LOCALTIMESTAMP) AS pre_upcoming,
             (final_interview_at > LOCALTIMESTAMP) AS final_upcoming";

    if ($applicationNumber !== '') {
        $stmt = $hr->prepare("SELECT {$cols} FROM applicants WHERE UPPER(source_application_no) = UPPER(:no) ORDER BY id DESC LIMIT 1");
        $stmt->execute(['no' => $applicationNumber]);
        $row = $stmt->fetch();
        if ($row) {
            return $row;
        }
    }
    $appNo = $applicantNumber !== '' ? $applicantNumber : $applicationNumber;
    if ($appNo !== '') {
        $stmt = $hr->prepare("SELECT {$cols} FROM applicants WHERE UPPER(applicant_no) = UPPER(:no) ORDER BY id DESC LIMIT 1");
        $stmt->execute(['no' => $appNo]);
        $row = $stmt->fetch();
        if ($row) {
            return $row;
        }
    }
    return null;
}

/** Department: the employee record once hired, else the position lookup HR's hire uses. */
function ap_department(PDO $hr, ?int $hrId, string $position, ?int $jobPostingId = null): string
{
    if ($hrId) {
        $stmt = $hr->prepare("SELECT department FROM employees WHERE applicant_id = :id AND department IS NOT NULL AND department <> '' ORDER BY id DESC LIMIT 1");
        $stmt->execute(['id' => $hrId]);
        if ($dept = $stmt->fetchColumn()) {
            return (string)$dept;
        }
    }
    if ($jobPostingId) {
        $stmt = $hr->prepare("SELECT department FROM job_postings WHERE id = :id AND department IS NOT NULL AND department <> '' LIMIT 1");
        $stmt->execute(['id' => $jobPostingId]);
        if ($dept = $stmt->fetchColumn()) {
            return (string)$dept;
        }
    }
    if ($position === '') {
        return '';
    }
    $stmt = $hr->prepare(
        "SELECT d.name FROM positions p JOIN departments d ON d.id = p.department_id
         WHERE p.title = :t AND p.status = 'Active' AND d.status = 'Active' LIMIT 1"
    );
    $stmt->execute(['t' => $position]);
    if ($dept = $stmt->fetchColumn()) {
        return (string)$dept;
    }
    $stmt = $hr->prepare(
        "SELECT d.name FROM job_postings jp JOIN departments d ON d.name = jp.department AND d.status = 'Active'
         WHERE jp.title = :t LIMIT 1"
    );
    $stmt->execute(['t' => $position]);
    return (string)($stmt->fetchColumn() ?: '');
}

/** One interview card; Face-to-Face interviews are held at the main office. */
function ap_interview(string $round, string $at, ?string $type, ?string $location, ?string $interviewer, string $status): array
{
    $type     = trim((string)$type);
    $location = trim((string)$location);
    $online   = strcasecmp($type, 'Online') === 0;
    $link     = null;
    if ($online && filter_var($location, FILTER_VALIDATE_URL)
        && in_array(strtolower((string)parse_url($location, PHP_URL_SCHEME)), ['http', 'https'], true)) {
        $link = $location;
    }
    return [
        'round'        => $round,
        'scheduled_at' => $at,
        'type'         => $type === '' ? null : ($online ? 'Online' : 'Face to Face'),
        'location'     => ($type === '' || $online) ? null : ($location !== '' ? $location : AP_MAIN_OFFICE),
        'meeting_link' => $link,
        'interviewer'  => trim((string)$interviewer) ?: null,
        'status'       => $status,
    ];
}

function ap_dashboard(array $app): array
{
    $applicantId = (int)$app['applicant_id'];
    $submittedAt = $app['submitted_at'] ?: $app['created_at'];
    $jobTitle    = (string)($app['job_title'] ?? '');

    $resume        = $applicantId > 0
        ? db()->fetchOne('SELECT original_filename, file_size, uploaded_at FROM resumes WHERE applicant_id = ? ORDER BY id DESC LIMIT 1', [$applicantId])
        : null;
    $screenedAt    = $applicantId > 0
        ? (db()->fetchOne('SELECT MAX(screened_at) AS at FROM resume_screenings WHERE applicant_id = ?', [$applicantId])['at'] ?? null)
        : null;
    $recommendedAt = $applicantId > 0
        ? (db()->fetchOne('SELECT MIN(created_at) AS at FROM job_recommendations WHERE applicant_id = ?', [$applicantId])['at'] ?? null)
        : null;

    $hrPdo = ap_hrms();
    if ($hrPdo) {
        ic_tick($hrPdo); // interview confirmation deadlines are current before they are shown
    }
    $hr    = ap_hr_record($hrPdo, (string)$app['application_number'], (string)$app['applicant_number']);
    $hrId  = $hr ? (int)$hr['id'] : null;
    $position   = $hr && trim((string)$hr['position']) !== '' ? (string)$hr['position'] : $jobTitle;

    // Fallback for resume if not in recruitment DB
    if (!$resume && $hr && !empty($hr['resume_path'])) {
        $root = dirname(__DIR__, 2);
        $fullResumePath = realpath($root . '/' . ltrim(str_replace('\\', '/', (string)$hr['resume_path']), '/'));
        if ($fullResumePath && is_file($fullResumePath)) {
            $resume = [
                'original_filename' => basename($fullResumePath),
                'file_size'         => filesize($fullResumePath),
                'uploaded_at'       => date('Y-m-d H:i:s', filemtime($fullResumePath)),
            ];
        }
    }

    // The Job Posting applied through (Recruitment Management > Job Posting).
    $posting = jp_get_by_portal_id($hrPdo, (int)($app['job_position_id'] ?? 0));
    if (!$posting && $hr && !empty($hr['job_posting_id'])) {
        $posting = jp_get($hrPdo, (int)$hr['job_posting_id']);
    }

    $department = ap_department($hrPdo, $hrId, $position, $posting ? (int)$posting['id'] : null);
    if ($posting && jp_department_of($posting) !== '' && jp_department_of($posting) !== 'Unassigned'
        && !($hrId && $hr['stage'] === 'Hired' && $department !== '')) {
        $department = jp_department_of($posting);
    }

    // HR events, oldest first; the first of each kind dates a step, the last one the latest change.
    $events = [];
    $onboarding = null;
    if ($hrId) {
        $placeholders = implode(', ', array_fill(0, count(AP_EVENT_ACTIONS), '?'));
        $stmt = $hrPdo->prepare(
            "SELECT action, created_at FROM audit_logs
             WHERE action IN ({$placeholders}) AND description ~ ?
             ORDER BY created_at, id"
        );
        $stmt->execute([...AP_EVENT_ACTIONS, 'Applicant #' . $hrId . '([^0-9]|$)']);
        $events = $stmt->fetchAll();

        $stmt = $hrPdo->prepare(
            'SELECT e.date_hired, o.status AS onboarding_status
             FROM employees e LEFT JOIN onboarding o ON o.employee_id = e.id
             WHERE e.applicant_id = :id ORDER BY o.id DESC NULLS LAST LIMIT 1'
        );
        $stmt->execute(['id' => $hrId]);
        $onboarding = $stmt->fetch() ?: null;
    }
    $firstEvent = [];
    foreach ($events as $ev) {
        $firstEvent[$ev['action']] ??= $ev['created_at'];
    }

    // Until HR has the record the application is waiting for validation.
    $stage    = $hr['stage'] ?? 'Validation';
    $status   = $hr['status'] ?? 'New';
    $rejected = $stage === 'Rejected';
    $preAt    = $hr['pre_interview_at'] ?? null;
    $finalAt  = $hr['final_interview_at'] ?? null;
    $preUpcoming   = !empty($hr['pre_upcoming']);
    $finalUpcoming = !empty($hr['final_upcoming']);
    $reachedPre    = $preAt !== null || isset($firstEvent['Applicant Scheduled']);
    $reachedFinal  = $finalAt !== null || isset($firstEvent['Applicant Advanced']);
    $onboardingStatus = $onboarding['onboarding_status'] ?? null;
    $hiredAt = $firstEvent['Applicant Hired'] ?? ($onboarding['date_hired'] ?? null);
    $rejectedAt = $hr['rejected_at'] ?? ($firstEvent['Applicant Rejected'] ?? ($rejected ? $hr['updated_at'] : null));
    // Where the application stopped, in the words this portal uses for its stages.
    $rejectionStage = $rejected ? ([
        'Applicant Validation' => 'Applicant Validation',
        'Pre-Interview'        => 'Initial Interview (Pre-Interview)',
        'Final Interview'      => 'Final Interview',
        'Job Offer'            => 'Job Offer',
    ][$hr['rejection_stage'] ?? ''] ?? ($hr['rejection_stage'] ?: 'Review')) : null;

    /* ---- progress tracker: follows recruitment workflow ---- */
    $steps = [
        ['key' => 'submitted', 'label' => 'Application Submitted', 'date' => $submittedAt,
         'description' => 'Your application was received.'],
        ['key' => 'validation', 'label' => 'Applicant Validation', 'date' => $firstEvent['Applicant Scheduled'] ?? null,
         'description' => 'HR reviews your application, qualifications and candidate ranking.'],
    ];
    if ($screenedAt || $stage !== 'Validation') {
        $steps[] = ['key' => 'screening', 'label' => 'AI Resume Screening', 'date' => $screenedAt,
                    'description' => 'Your resume was screened for skills, education and experience.'];
    }
    if ($recommendedAt || $stage !== 'Validation') {
        $steps[] = ['key' => 'recommendation', 'label' => 'AI Job Recommendation', 'date' => $recommendedAt,
                    'description' => 'Your profile was matched with our open positions.'];
    }
    $steps[] = ['key' => 'pre', 'label' => 'Initial Interview', 'date' => $preAt,
                'description' => 'A first interview with our HR team.'];
    $steps[] = ['key' => 'final', 'label' => 'Final Interview', 'date' => $finalAt,
                'description' => 'The final interview for the position.'];
    if ($status === 'Offer' || isset($firstEvent['Job Offer Extended'])) {
        $steps[] = ['key' => 'offer', 'label' => 'Job Offer', 'date' => $firstEvent['Job Offer Extended'] ?? null,
                    'description' => 'A job offer has been prepared for you.'];
    }
    $steps[] = ['key' => 'hired', 'label' => 'Hired', 'date' => $hiredAt,
                'description' => 'Welcome to Archon Nell Incorporated.'];
    $steps[] = ['key' => 'onboarding', 'label' => 'Onboarding', 'date' => null,
                'description' => $onboardingStatus ? 'Onboarding status: ' . $onboardingStatus . '.' : 'HR will guide you through your first days.'];

    if ($rejected) {
        // Stages completed before the decision, then the decision itself.
        $done = ['submitted'];
        if (($hr['rejection_stage'] ?? '') !== 'Applicant Validation') {
            $done[] = 'validation';
            $done[] = 'screening';
            $done[] = 'recommendation';
        }
        if ($reachedPre && !($preUpcoming && !$reachedFinal)) {
            $done[] = 'pre';
        }
        if ($reachedFinal && $finalAt !== null && !$finalUpcoming) {
            $done[] = 'final';
        }
        if (isset($firstEvent['Job Offer Extended'])) {
            $done[] = 'offer';
        }
        $steps = array_values(array_filter($steps, static fn($s) => in_array($s['key'], $done, true)));
        foreach ($steps as &$s) {
            $s['state'] = 'completed';
        }
        unset($s);
        $steps[] = ['key' => 'rejected', 'label' => 'Application Rejected', 'date' => $rejectedAt, 'state' => 'rejected',
                    'description' => $rejectionStage ? "Your application did not proceed further (stage: {$rejectionStage})." : 'Your application will not proceed further.'];
    } else {
        $current = match ($stage) {
            'Pre-Interview'   => 'pre',
            'Final Interview' => $status === 'Offer' ? 'offer' : 'final',
            'Hired'           => $onboardingStatus === 'Completed' ? null : 'onboarding',
            default           => 'validation',
        };
        $keys = array_column($steps, 'key');
        $currentIndex = $current === null ? count($steps) : (int)array_search($current, $keys, true);
        foreach ($steps as $i => &$s) {
            $s['state'] = $i < $currentIndex ? 'completed' : ($i === $currentIndex ? 'current' : 'pending');
        }
        unset($s);
    }

    /* ---- current status ---- */
    if ($rejected) {
        [$label, $tone, $message] = ['Application Rejected', 'rejected',
            'Thank you for your interest in Archon Nell Incorporated. After careful review, your application will not proceed further. You are welcome to apply for future openings.'];
    } elseif ($stage === 'Hired') {
        [$label, $tone, $message] = ['Hired', 'hired', $onboardingStatus === 'Completed'
            ? 'Congratulations! You have been hired and your onboarding is complete.'
            : 'Congratulations! You have been hired. Our HR team will contact you about your onboarding and first day.'];
    } elseif ($stage === 'Final Interview' && $status === 'Offer') {
        [$label, $tone, $message] = ['Job Offer', 'hired', 'A job offer is available for you. Please review it below and accept or decline it before it expires.'];
    } elseif ($stage === 'Final Interview') {
        [$label, $tone, $message] = ['Final Interview', 'interview', $finalAt === null
            ? 'You have advanced to the final interview. HR will send you the schedule soon.'
            : ($finalUpcoming ? 'Your final interview is scheduled. Please see the details below.'
                              : 'Your final interview is done. Please wait for the result from our HR team.')];
    } elseif ($stage === 'Pre-Interview') {
        [$label, $tone, $message] = ['Initial Interview', 'interview', $preUpcoming
            ? 'Your application has been validated and your initial interview is scheduled. Please see the details below.'
            : 'Your initial interview is done. Please wait for the result from our HR team.'];
    } else {
        [$label, $tone, $message] = ['Application Validation', 'review',
            'Your application has been received and is being reviewed by our HR team. You will be notified once an interview is scheduled.'];
    }

    /* ---- updates (newest first) ---- */
    $updateText = [
        'Applicant Scheduled'         => ['Application validated', 'Your application passed validation and your initial interview has been scheduled.', 'info'],
        'Applicant Advanced'          => ['Moved to Final Interview', 'You have advanced to the final interview stage.', 'info'],
        'Final Interview Scheduled'   => ['Final interview scheduled', 'Your final interview has been scheduled. See the interview schedule for the details.', 'info'],
        'Final Interview Rescheduled' => ['Interview schedule changed', 'Your final interview schedule has been changed. Please check the new date and time.', 'warning'],
        'Applicant Hired'             => ['Hired', 'Congratulations! You have been hired. HR will contact you about your onboarding.', 'success'],
        'Job Offer Extended'          => ['Job offer available', 'Congratulations! A job offer has been extended to you. See the offer details below and accept or decline it.', 'success'],
        'Applicant Accepted Job Offer' => ['Job offer accepted', 'You accepted the job offer. Our HR team will confirm your hiring and contact you about onboarding.', 'success'],
        'Applicant Declined Job Offer' => ['Job offer declined', 'You declined the job offer. Thank you for letting us know.', 'warning'],
        'Applicant Job Offer Expired'  => ['Job offer expired', 'The job offer expired without an answer. Please contact the recruitment team.', 'danger'],
        'Applicant Rejected'          => ['Application rejected', 'Thank you for your interest. Your application will not proceed further. You may share feedback about your recruitment experience below.', 'danger'],
        'Future Opportunity Invitation Sent'      => ['Future opportunity invitation', 'We would like to keep your profile for future opportunities. Please let us know if we may contact you.', 'info'],
        'Applicant Accepted Future Opportunities' => ['Future opportunities accepted', 'You agreed to be contacted about future opportunities. Your profile is in our Talent Pool.', 'success'],
        'Applicant Declined Future Opportunities' => ['Future opportunities declined', 'You chose not to be contacted about future opportunities.', 'warning'],
        'Talent Pool Applicant Contacted'         => ['New job opportunity', 'A new position may match your profile. See Job Opportunities below.', 'info'],
        'Future Opportunity Accepted'             => ['Opportunity accepted', 'You accepted a job opportunity. A new application was created for you.', 'success'],
        'Future Opportunity Declined'             => ['Opportunity declined', 'You declined a job opportunity.', 'warning'],
        'Applicant Feedback Submitted'            => ['Feedback received', 'Thank you for sharing your recruitment experience.', 'info'],
        'Pre-Interview Rescheduled'               => ['Interview schedule changed', 'Your initial interview schedule has been changed. Please check the new date and time and confirm your attendance.', 'warning'],
        'Applicant Confirmed Interview Attendance' => ['Interview attendance confirmed', 'You confirmed that you will attend your interview.', 'success'],
        'Applicant Declined Interview Attendance'  => ['Interview declined', 'You told us you cannot attend the interview. Our recruitment team will contact you about the next step.', 'warning'],
        'Interview Confirmation Expired'           => ['Confirmation period expired', 'Your interview confirmation period has expired. Please contact the recruitment team.', 'danger'],
    ];
    $updates = [[
        'title' => 'Application submitted', 'tone' => 'info', 'date' => $submittedAt,
        'message' => 'Your application' . ($jobTitle !== '' ? " for {$jobTitle}" : '') . ' was successfully submitted.',
    ]];
    foreach ($events as $ev) {
        if (!isset($updateText[$ev['action']])) continue;
        [$title, $text, $evTone] = $updateText[$ev['action']];
        $updates[] = ['title' => $title, 'message' => $text, 'tone' => $evTone, 'date' => $ev['created_at']];
    }
    // Records changed before these events were logged still get an update for their current stage.
    $stageEvent = ['Pre-Interview' => 'Applicant Scheduled', 'Final Interview' => 'Applicant Advanced', 'Hired' => 'Applicant Hired', 'Rejected' => 'Applicant Rejected'][$stage] ?? null;
    if ($status === 'Offer' && !isset($firstEvent['Job Offer Extended'])) {
        $updates[] = ['title' => 'Job offer available', 'message' => 'Congratulations! A job offer has been extended to you. Our HR team will contact you with the details.', 'tone' => 'success', 'date' => $hr['updated_at']];
    }
    if ($hr && $stageEvent && !isset($firstEvent[$stageEvent])) {
        [$title, $text, $evTone] = $updateText[$stageEvent];
        $updates[] = ['title' => $title, 'message' => $text, 'tone' => $evTone, 'date' => $hr['updated_at']];
    }
    // Newest first; events logged in the same second keep their logged order (later one first).
    $dates = array_column($updates, 'date');
    $order = array_keys($updates);
    array_multisort($dates, SORT_DESC, SORT_STRING, $order, SORT_DESC, $updates);

    /* ---- interview schedule (chronological order: Initial first, Final second) ---- */
    $interviews = [];
    if ($hr && !$rejected) {
        if ($preAt !== null) {
            $preStatus = ($stage === 'Pre-Interview') ? ($preUpcoming ? 'Scheduled' : 'Awaiting Result') : 'Completed';
            $interviews[] = ap_interview('Initial Interview', $preAt, $hr['interview_type'], $hr['interview_location'], $hr['interviewer'], $preStatus)
                + ['round_key' => 'Pre-Interview', 'confirmation' => $stage === 'Pre-Interview' && $hrPdo ? ic_portal($hrPdo, (int)$hrId, 'Pre-Interview') : null];
        }
        if ($finalAt !== null && in_array($stage, ['Final Interview', 'Hired'], true)) {
            $finalStatus = ($stage === 'Hired' || $status === 'Offer') ? 'Completed' : ($finalUpcoming ? 'Scheduled' : 'Awaiting Result');
            $interviews[] = ap_interview('Final Interview', $finalAt, $hr['final_interview_type'], $hr['final_interview_location'], $hr['final_interviewer'], $finalStatus)
                + ['round_key' => 'Final Interview', 'confirmation' => $stage === 'Final Interview' && $hrPdo ? ic_portal($hrPdo, (int)$hrId, 'Final Interview') : null];
        }
    }

    $address = implode(', ', array_filter(array_map(static fn($p) => trim((string)$p), [$app['address'], $app['city'], $app['province']]), 'strlen'));

    return [
        'applicant' => [
            'full_name'  => ap_full_name($app),
            'first_name' => trim((string)$app['first_name']),
        ],
        'summary' => [
            'application_id' => (string)$app['application_number'],
            'job_posting_no' => $posting['posting_no'] ?? null,
            'position'       => $position,
            'department'     => $department,
            'date_applied'   => $submittedAt,
            'status'         => $label,
            'status_tone'    => $tone,
            'status_message' => $message,
            'rejection'      => $rejected ? [
                'stage'  => $rejectionStage,
                'reason' => ($hr['rejection_reason'] ?? null) ?: null,
                'date'   => $rejectedAt,
            ] : null,
            'latest_update'  => $updates[0],
        ],
        'rejected'   => $rejected,
        'talent'     => ap_talent($hrPdo, $hrId),
        // This application's job offer (details + Accept / Decline), never another applicant's.
        'offer'      => ($hrPdo && $hrId && ($jo = jor_for_applicant($hrPdo, $hrId))) ? jor_view($jo) : null,
        'progress'   => $steps,
        'interviews' => $interviews,
        'updates'    => $updates,
        'application' => [
            'full_name'     => ap_full_name($app),
            'email'         => (string)$app['email'],
            'mobile_number' => (string)$app['mobile_number'],
            'address'       => $address,
            'position'      => $position,
            'department'    => $department,
            'date_applied'  => $submittedAt,
            'resume'        => $resume ? [
                'file_name'   => (string)$resume['original_filename'],
                'file_size'   => (int)$resume['file_size'],
                'uploaded_at' => $resume['uploaded_at'],
            ] : null,
        ],
    ];
}

/**
 * Future opportunities of the signed-in application: the Talent Pool consent,
 * this person's job opportunity invitations, and the feedback form.
 * Opportunities are identified by their number (no database ids).
 */
function ap_talent(PDO $hr, ?int $hrId): ?array
{
    $a = $hrId ? tp_get($hr, $hrId) : null;
    if (!$a) {
        return null;
    }
    tp_expire($hr);
    $s = $hr->prepare("SELECT o.opportunity_no, o.status, o.message, o.sent_at, o.expires_at, o.responded_at, jp.posting_no, jp.title AS job_title,
                              COALESCE(d.name, jp.department) AS department, n.source_application_no AS new_application_no
                       FROM future_opportunities o JOIN applicants x ON x.id = o.applicant_id JOIN job_postings jp ON jp.id = o.job_posting_id
                       LEFT JOIN departments d ON d.id = jp.department_id LEFT JOIN applicants n ON n.id = o.new_applicant_id
                       WHERE LOWER(x.email) = LOWER(:e) AND x.date_of_birth IS NOT DISTINCT FROM CAST(:dob AS DATE) ORDER BY o.sent_at DESC");
    $s->execute(['e' => $a['email'], 'dob' => $a['date_of_birth']]);
    $rejected = $a['stage'] === 'Rejected' && empty($a['archived_at']);
    return [
        'status'         => tp_display_status($a),
        'future_pref'    => $rejected ? $a['future_pref'] : null,
        'in_talent_pool' => $rejected && in_array($a['talent_pool_status'], ['Active', 'Contacted', 'Re-applied'], true),
        'can_answer'     => $rejected && $a['future_pref'] !== null,
        'opportunities'  => $s->fetchAll(),
        'feedback'       => ['allowed' => $a['stage'] === 'Rejected', 'submitted' => tp_applicant_feedback($hr, (int)$a['id']) !== null, 'ratings' => TP_RATINGS],
    ];
}

/** The HRMS application behind the signed-in session (never another applicant's). */
function ap_signed_in_hr(): array
{
    $no = ap_signed_in_application(true);
    $app = $no !== null ? ap_find_application($no) : null;
    if (!$app) {
        json_response(['success' => false, 'authenticated' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Please sign in again.'], 401);
    }
    $hr = ap_hrms();
    $rec = ap_hr_record($hr, (string)$app['application_number'], (string)$app['applicant_number']);
    if (!$rec) {
        json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Your application is still being received. Please try again later.'], 409);
    }
    return [$hr, $app, tp_get($hr, (int)$rec['id'])];
}

/** Same applicant = same e-mail address and date of birth (what they signed in with). */
function ap_same_person(array $a, array $b): bool
{
    return strtolower(trim((string)$a['email'])) === strtolower(trim((string)$b['email']))
        && substr((string)$a['date_of_birth'], 0, 10) === substr((string)$b['date_of_birth'], 0, 10);
}

/** The HR stage / status as the applicant sees it: [label, tone]. */
function ap_status_of(?array $hr): array
{
    return match (true) {
        !$hr                                                            => ['Application Validation', 'review'],
        $hr['stage'] === 'Rejected'                                    => ['Application Rejected', 'rejected'],
        $hr['stage'] === 'Hired'                                       => ['Hired', 'hired'],
        $hr['stage'] === 'Final Interview' && $hr['status'] === 'Offer' => ['Job Offer', 'hired'],
        $hr['stage'] === 'Final Interview'                             => ['Final Interview', 'interview'],
        $hr['stage'] === 'Pre-Interview'                               => ['Initial Interview', 'interview'],
        default                                                        => ['Application Validation', 'review'],
    };
}

/**
 * "My Applications": every application this applicant (same e-mail + date of
 * birth) submitted, newest first, each with its job, department and status.
 */
function ap_person_applications(array $app): array
{
    $rows = db()->fetchAll(
        "SELECT a.application_number, a.applicant_id, a.job_position_id, COALESCE(a.submitted_at, a.created_at) AS applied_at,
                jp.job_title, ap.applicant_number
         FROM applications a
         JOIN applicants ap ON ap.id = a.applicant_id
         LEFT JOIN job_positions jp ON jp.id = a.job_position_id
         WHERE LOWER(ap.email) = LOWER(?) AND ap.date_of_birth = CAST(? AS DATE)
         ORDER BY applied_at DESC",
        [(string)$app['email'], substr((string)$app['date_of_birth'], 0, 10)]
    );
    $hrPdo = ap_hrms();
    if ($hrPdo) {
        ic_tick($hrPdo); // interview confirmation deadlines are current before they are shown
    }
    $out = [];
    foreach ($rows as $r) {
        $hr = ap_hr_record($hrPdo, (string)$r['application_number'], (string)$r['applicant_number']);
        $posting = jp_get_by_portal_id($hrPdo, (int)$r['job_position_id']);
        if (!$posting && $hr && !empty($hr['job_posting_id'])) {
            $posting = jp_get($hrPdo, (int)$hr['job_posting_id']);
        }
        $position = $hr && trim((string)$hr['position']) !== '' ? (string)$hr['position'] : (string)($r['job_title'] ?? '');
        $dept = ap_department($hrPdo, $hr ? (int)$hr['id'] : null, $position, $posting ? (int)$posting['id'] : null);
        if ($posting && jp_department_of($posting) !== '' && jp_department_of($posting) !== 'Unassigned'
            && !($hr && $hr['stage'] === 'Hired' && $dept !== '')) {
            $dept = jp_department_of($posting);
        }
        [$label, $tone] = ap_status_of($hr);
        $out[] = [
            'application_id' => (string)$r['application_number'],
            'job_title'      => $position ?: (string)($r['job_title'] ?? ''),
            'job_posting_no' => $posting['posting_no'] ?? null,
            'department'     => $dept === 'Unassigned' ? '' : $dept,
            'date_applied'   => $r['applied_at'],
            'status'         => $label,
            'status_tone'    => $tone,
            'current'        => $r['application_number'] === $app['application_number'],
        ];
    }
    return $out;
}

/* =====================================================================
 * Actions
 * ===================================================================== */

$action = (string)($_GET['action'] ?? ($_POST['action'] ?? 'session'));

try {
    switch ($action) {
        case 'session':
            json_response([
                'success'       => true,
                'authenticated' => ap_signed_in_application(false) !== null,
                'pending'       => ap_pending_state(),
                'csrf_token'    => generate_csrf_token(),
            ]);
            break;

        case 'login':
            ap_require_post();
            $applicationNumber = strtoupper(trim((string)($_POST['application_number'] ?? '')));
            $email = strtolower(trim((string)($_POST['email'] ?? '')));
            $dob   = trim((string)($_POST['date_of_birth'] ?? ''));

            $errors = [];
            if ($applicationNumber === '') {
                $errors[] = 'Application ID is required.';
            } elseif (mb_strlen($applicationNumber) > 50) {
                $errors[] = 'Please enter a valid Application ID.';
            }
            if ($email === '') {
                $errors[] = 'Email Address is required.';
            } elseif (!Security::validateEmail($email)) {
                $errors[] = 'Please enter a valid email address.';
            }
            if ($dob === '') {
                $errors[] = 'Date of Birth is required.';
            } elseif (!Security::validateDate($dob)) {
                $errors[] = 'Please enter a valid date of birth.';
            }
            if ($errors) {
                json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Validation failed', 'errors' => $errors], 422);
            }

            $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
            if (!Security::checkRateLimit($ip . ':applicant-portal-login', 10, 900)
                || !Security::checkRateLimit('applicant-portal-login:' . $applicationNumber, 5, 900)) {
                json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Too many sign-in attempts. Please wait 15 minutes and try again.'], 429);
            }

            $app = ap_find_application($applicationNumber);
            $matches = $app
                && hash_equals(strtolower(trim((string)$app['email'])), $email)
                && substr((string)$app['date_of_birth'], 0, 10) === $dob;
            if (!$matches) {
                json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'The details you entered do not match any submitted application. Please check your Application ID, email address and date of birth.'], 401);
            }

            if (ap_mailer_ready()) {
                $issued = ap_issue_code($app, 0);
                if (!$issued['success']) {
                    json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'We could not send your verification code right now. Please try again in a few minutes.'], 503);
                }
                json_response([
                    'success'               => true,
                    'verification_required' => true,
                    'pending'               => ap_pending_state(),
                    'csrf_token'            => generate_csrf_token(),
                ]);
            }

            ap_sign_in((string)$app['application_number']);
            json_response(['success' => true, 'verification_required' => false, 'csrf_token' => generate_csrf_token()]);
            break;

        case 'verify':
            ap_require_post();
            $pending = $_SESSION['applicant_portal_pending'] ?? null;
            if (!is_array($pending)) {
                json_response(['success' => false, 'restart' => true, 'csrf_token' => generate_csrf_token(), 'message' => 'Your verification step has ended. Please sign in again.'], 409);
            }
            $code = preg_replace('/\D/', '', (string)($_POST['code'] ?? ''));
            if (strlen($code) !== 6) {
                json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Please enter the 6-digit code sent to your e-mail.'], 422);
            }
            if (time() > (int)$pending['expires']) {
                json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'This code has expired. Please request a new code.'], 422);
            }
            if (!password_verify($code, (string)$pending['hash'])) {
                $attempts = (int)$pending['attempts'] + 1;
                if ($attempts >= AP_MAX_CODE_ATTEMPTS) {
                    unset($_SESSION['applicant_portal_pending']);
                    json_response(['success' => false, 'restart' => true, 'csrf_token' => generate_csrf_token(), 'message' => 'Too many incorrect codes. Please sign in again.'], 429);
                }
                $_SESSION['applicant_portal_pending']['attempts'] = $attempts;
                $left = AP_MAX_CODE_ATTEMPTS - $attempts;
                json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => "Incorrect verification code. {$left} attempt" . ($left === 1 ? '' : 's') . ' left.'], 422);
            }
            ap_sign_in((string)$pending['application_number']);
            json_response(['success' => true, 'csrf_token' => generate_csrf_token()]);
            break;

        case 'resend':
            ap_require_post();
            $pending = $_SESSION['applicant_portal_pending'] ?? null;
            if (!is_array($pending)) {
                json_response(['success' => false, 'restart' => true, 'csrf_token' => generate_csrf_token(), 'message' => 'Your verification step has ended. Please sign in again.'], 409);
            }
            $wait = AP_RESEND_COOLDOWN - (time() - (int)$pending['last_sent']);
            if ($wait > 0) {
                json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => "Please wait {$wait} seconds before requesting a new code.", 'pending' => ap_pending_state()], 429);
            }
            if ((int)$pending['resends'] >= AP_MAX_RESENDS) {
                unset($_SESSION['applicant_portal_pending']);
                json_response(['success' => false, 'restart' => true, 'csrf_token' => generate_csrf_token(), 'message' => 'Too many codes requested. Please sign in again.'], 429);
            }
            $app = ap_find_application((string)$pending['application_number']);
            if (!$app || !ap_mailer_ready() || !ap_issue_code($app, (int)$pending['resends'] + 1)['success']) {
                json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'We could not send a new code right now. Please try again in a few minutes.'], 503);
            }
            json_response(['success' => true, 'message' => 'A new code has been sent.', 'pending' => ap_pending_state(), 'csrf_token' => generate_csrf_token()]);
            break;

        case 'cancel':
            ap_require_post();
            unset($_SESSION['applicant_portal_pending']);
            json_response(['success' => true, 'csrf_token' => generate_csrf_token()]);
            break;

        case 'logout':
            ap_require_post();
            ap_sign_out();
            json_response(['success' => true, 'csrf_token' => generate_csrf_token()]);
            break;

        case 'dashboard':
            if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
                json_response(['success' => false, 'message' => 'Method not allowed'], 405);
            }
            $applicationNumber = ap_signed_in_application(empty($_GET['passive']));
            $app = $applicationNumber !== null ? ap_find_application($applicationNumber) : null;
            // Switch to another application of the same person (never to anyone else's).
            $wanted = strtoupper(trim((string)($_GET['app'] ?? '')));
            if ($app && $wanted !== '' && $wanted !== $applicationNumber) {
                $other = ap_find_application($wanted);
                if (!$other || !ap_same_person($app, $other)) {
                    json_response(['success' => false, 'authenticated' => true, 'csrf_token' => generate_csrf_token(), 'message' => 'Application not found.'], 404);
                }
                $_SESSION['applicant_portal']['application_number'] = (string)$other['application_number'];
                $app = $other;
            }
            if (!$app) {
                if ($applicationNumber !== null) {
                    ap_sign_out();
                }
                // A normal "signed out" answer (like `session`), so the page just shows the sign-in form.
                json_response(['success' => false, 'authenticated' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Please sign in to view your application.']);
            }
            json_response(['success' => true, 'authenticated' => true, 'csrf_token' => generate_csrf_token()] + ap_dashboard($app)
                + ['applications' => ap_person_applications($app)]);
            break;

        case 'future_preference':
            ap_require_post();
            [$hr, , $rec] = ap_signed_in_hr();
            $choice = (string)($_POST['choice'] ?? '');
            if (!in_array($choice, ['yes', 'no'], true)) {
                json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Please choose Yes or No.'], 422);
            }
            try {
                tp_set_preference($hr, (int)$rec['id'], $choice === 'yes', 'Portal');
            } catch (RuntimeException $e) {
                json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => $e->getMessage()], 422);
            }
            json_response(['success' => true, 'csrf_token' => generate_csrf_token(), 'message' => $choice === 'yes'
                ? 'Thank you. We may contact you about future opportunities that match your qualifications.'
                : 'Your choice is saved. We will not contact you about future opportunities.']);
            break;

        case 'opportunity_respond':
            ap_require_post();
            [$hr, , $rec] = ap_signed_in_hr();
            $choice = (string)($_POST['choice'] ?? '');
            $s = $hr->prepare("SELECT o.id FROM future_opportunities o JOIN applicants x ON x.id = o.applicant_id
                               WHERE o.opportunity_no = :no AND LOWER(x.email) = LOWER(:e) AND x.date_of_birth IS NOT DISTINCT FROM CAST(:dob AS DATE)");
            $s->execute(['no' => (string)($_POST['opportunity_no'] ?? ''), 'e' => $rec['email'], 'dob' => $rec['date_of_birth']]);
            $oid = $s->fetchColumn();
            if (!$oid || !in_array($choice, ['accept', 'decline'], true)) {
                json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Opportunity not found.'], 404);
            }
            try {
                $res = tp_respond_opportunity($hr, pdo(), tp_opportunity($hr, (int)$oid), $choice === 'accept', 'Portal');
            } catch (RuntimeException $e) {
                json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => $e->getMessage()], 422);
            }
            json_response(['success' => true, 'csrf_token' => generate_csrf_token(), 'message' => $choice === 'accept'
                ? 'Thank you! A new application was created' . (!empty($res['application']['application_no']) ? ' (Application ID ' . $res['application']['application_no'] . ')' : '') . '. It now goes through our recruitment process.'
                : 'Your answer is saved. We will not send further invitations unless you change your preference.',
                'application_no' => $res['application']['application_no'] ?? null]);
            break;

        // Attendance confirmation of the signed-in application's own interview (never another applicant's).
        // Accept / decline this application's own job offer (until its expiration date).
        case 'offer_respond':
            ap_require_post();
            [$hr, , $rec] = ap_signed_in_hr();
            $choice = (string)($_POST['choice'] ?? '');
            $jo = jor_for_applicant($hr, (int)$rec['id']);
            if (!$jo || !in_array($choice, ['accept', 'decline'], true)) {
                json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'There is no job offer to answer.'], 404);
            }
            try {
                $res = jor_respond($hr, $jo, $choice === 'accept', (string)($_POST['reason'] ?? ''), 'Portal');
            } catch (RuntimeException $e) {
                json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => $e->getMessage()], 422);
            }
            json_response(['success' => true, 'csrf_token' => generate_csrf_token(), 'message' => $res['applicant_response'] === 'Accepted'
                ? 'Thank you! You accepted the job offer. Our HR team will confirm your hiring and contact you about onboarding.'
                : 'Your answer has been sent to our HR team. Thank you for letting us know.']);
            break;

        case 'interview_respond':
            ap_require_post();
            [$hr, , $rec] = ap_signed_in_hr();
            $round = (string)($_POST['round'] ?? '');
            $choice = (string)($_POST['choice'] ?? '');
            if (!in_array($round, IC_ROUNDS, true) || !in_array($choice, ['confirm', 'decline'], true)) {
                json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Invalid request.'], 422);
            }
            ic_tick($hr);
            $req = ic_latest($hr, (int)$rec['id'], $round);
            if (!$req) {
                json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'There is no interview to confirm.'], 404);
            }
            try {
                $res = ic_respond($hr, $req, $choice === 'confirm', (string)($_POST['reason'] ?? ''), 'Portal');
            } catch (RuntimeException $e) {
                json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'expired' => in_array(ic_get($hr, (int)$req['id'])['status'] ?? '', ['Expired'], true),
                    'message' => $e->getMessage()], 422);
            }
            json_response(['success' => true, 'csrf_token' => generate_csrf_token(), 'message' => $res['status'] === 'Confirmed'
                ? 'Your attendance has been confirmed. A confirmation e-mail was sent to you.'
                : 'Your answer has been sent to our recruitment team. They will contact you about the next step.']);
            break;

        case 'submit_feedback':
            ap_require_post();
            [$hr, , $rec] = ap_signed_in_hr();
            try {
                tp_submit_applicant_feedback($hr, (int)$rec['id'], $_POST);
            } catch (RuntimeException $e) {
                json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => $e->getMessage()], 422);
            }
            json_response(['success' => true, 'csrf_token' => generate_csrf_token(), 'message' => 'Thank you for your feedback.']);
            break;

        default:
            json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Invalid action'], 400);
    }
} catch (Throwable $e) {
    error_log('applicant_portal.php ' . $action . ': ' . $e->getMessage());
    json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Your application status is temporarily unavailable. Please try again in a few minutes.'], 500);
}
