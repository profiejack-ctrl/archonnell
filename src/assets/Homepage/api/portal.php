<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

/**
 * Read-only JSON endpoint for the React public site / applicant portal
 * (frontend/src/public). It returns exactly the data the former PHP pages
 * rendered server-side, using the same queries:
 *
 *   bootstrap                 CSRF token + the careers slide's job links   (index.php, header)
 *   job&id=N                  the job Apply Now applies for (while it accepts applications)
 *   jobs                      the careers page: Published postings accepting applications
 *   job_posting&no=JP-...     one job page (applicant-facing fields only)
 *   applicant&applicant=N     applicant name + pre-selected job            (applicant/recommendations.php)
 *   review&applicant=N        everything the review step shows             (applicant/review.php)
 *   application&app=AP-...    the submitted application summary            (applicant/success.php)
 *
 * The writes of the application flow stay in resume_upload.php,
 * screening_process.php, matching.php and submit_application.php.
 *
 * Applicant details (name, contact, address, education...) are only returned
 * to the browser session that created that application.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/hrms_bridge.php';

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    json_response(['success' => false, 'message' => 'Method not allowed'], 405);
}

/** True when $applicantId is the application in progress in this browser session. */
function portal_owns_applicant(int $applicantId): bool
{
    return $applicantId > 0
        && (int)($_SESSION['current_application']['applicant_id'] ?? 0) === $applicantId;
}

/** Decode a JSON list column into a plain array. */
function portal_json_list($value): array
{
    $decoded = json_decode((string)($value ?? '[]'), true);
    return is_array($decoded) ? array_values($decoded) : [];
}

$action = (string)($_GET['action'] ?? 'bootstrap');

try {
    switch ($action) {
        case 'bootstrap':
            // The careers slide lists the Published job postings that accept applications
            // (Recruitment Management > Job Posting), each linked to its job page.
            $careers = [];
            try {
                $hr = portal_sync_job_postings();
                foreach ($hr ? jp_open_postings($hr) : [] as $posting) {
                    $careers[] = [
                        'title'      => (string)$posting['title'],
                        'job_id'     => (int)$posting['portal_job_position_id'] ?: null,
                        'posting_no' => (string)$posting['posting_no'],
                    ];
                }
            } catch (Throwable $e) {
                error_log('portal.php bootstrap careers: ' . $e->getMessage());
                $careers = [];
            }
            json_response([
                'success'    => true,
                'csrf_token' => generate_csrf_token(),
                'careers'    => $careers,
            ]);
            break;

        case 'job':
            // Apply Now ?job=<id>: the job being applied for, while it accepts applications.
            $jobId = intval($_GET['id'] ?? 0);
            $hr = $jobId > 0 ? portal_sync_job_postings() : null;
            $job = $jobId > 0
                ? db()->fetchOne("SELECT id, job_title FROM job_positions WHERE id = ? AND status = 'active'", [$jobId])
                : null;
            $posting = $job && $hr ? jp_get_by_portal_id($hr, $jobId) : null;
            json_response([
                'success' => true,
                'job'     => $job ? [
                    'id'         => (int)$job['id'],
                    'job_title'  => $job['job_title'],
                    'posting_no' => $posting['posting_no'] ?? null,
                    'department' => $posting ? jp_department_of($posting) : null,
                    'deadline'   => $posting['deadline'] ?? null,
                ] : null,
                // A job was asked for but no longer accepts applications.
                'unavailable' => $jobId > 0 && !$job,
            ]);
            break;

        case 'jobs':
            // Careers page: every Published posting that accepts applications (applicant-facing fields only).
            $hr = portal_sync_job_postings();
            json_response([
                'success' => true,
                'jobs'    => $hr ? array_map('jp_public_view', jp_open_postings($hr)) : [],
            ]);
            break;

        case 'job_posting':
            // One job page (careers/JP-2026-0001). Drafts, closed and archived postings are not shown.
            $postingNo = strtoupper(trim((string)($_GET['no'] ?? '')));
            $hr = portal_sync_job_postings();
            $posting = $hr && preg_match('/^JP-\d{4}-\d{4,}$/', $postingNo) ? jp_get_by_no($hr, $postingNo) : null;
            json_response([
                'success' => true,
                'posting' => $posting && !empty($posting['accepting']) ? jp_public_view($posting) : null,
                'message' => $posting && $posting['status'] === 'Closed'
                    ? 'This job posting is closed and no longer accepts applications.'
                    : 'This job posting is not available.',
            ]);
            break;

        case 'applicant':
            $applicantId = intval($_GET['applicant'] ?? 0);
            $applicant = portal_owns_applicant($applicantId)
                ? db()->fetchOne("SELECT first_name, middle_name, last_name, applicant_number FROM applicants WHERE id = ?", [$applicantId])
                : null;
            if (!$applicant) {
                json_response(['success' => false, 'message' => 'Applicant not found', 'redirect' => 'apply'], 404);
            }
            json_response([
                'success'            => true,
                'full_name'          => trim(($applicant['first_name'] ?? '') . ' ' . ($applicant['middle_name'] ?? '') . ' ' . ($applicant['last_name'] ?? '')),
                'applicant_number'   => $applicant['applicant_number'],
                // A specific job posting's "Apply Now" is pre-selected on arrival.
                'preselected_job_id' => intval($_SESSION['current_application']['preselected_job_id'] ?? 0),
            ]);
            break;

        case 'review':
            $applicantId = intval($_GET['applicant'] ?? 0);
            if (!portal_owns_applicant($applicantId)) {
                json_response(['success' => false, 'message' => 'Applicant not found', 'redirect' => 'apply'], 404);
            }
            $applicant  = db()->fetchOne("SELECT * FROM applicants WHERE id = ?", [$applicantId]);
            $education  = db()->fetchOne("SELECT * FROM applicant_education WHERE applicant_id = ? LIMIT 1", [$applicantId]);
            $experience = db()->fetchOne("SELECT * FROM applicant_experience WHERE applicant_id = ? LIMIT 1", [$applicantId]);
            $resume     = db()->fetchOne("SELECT * FROM resumes WHERE applicant_id = ? ORDER BY id DESC LIMIT 1", [$applicantId]);
            $screening  = db()->fetchOne("SELECT * FROM resume_screenings WHERE applicant_id = ? ORDER BY id DESC LIMIT 1", [$applicantId]);

            // Which job: the one picked in AI Job Recommendation, else the top recommendation.
            $recommendation = null;
            $selectedJobId = 0;
            if (isset($_SESSION['current_application']['selected_job'])) {
                $selectedJobId = intval($_SESSION['current_application']['selected_job']['job_position_id'] ?? 0);
                if ($selectedJobId <= 0) {
                    $selectedJobId = intval($_SESSION['current_application']['selected_job']['job_id'] ?? 0);
                }
            }
            if ($selectedJobId <= 0 && !empty($_SESSION['current_application']['recommendations']) && is_array($_SESSION['current_application']['recommendations'])) {
                $first = reset($_SESSION['current_application']['recommendations']);
                $selectedJobId = intval($first['job_position_id'] ?? $first['job_id'] ?? 0);
            }

            if ($selectedJobId > 0) {
                $recommendation = db()->fetchOne(
                    "SELECT jr.*, jp.job_title FROM job_recommendations jr JOIN job_positions jp ON jr.job_position_id = jp.id WHERE jr.applicant_id = ? AND jr.job_position_id = ?",
                    [$applicantId, $selectedJobId]
                );

                if (!$recommendation) {
                    // Same fallback as the former review page: rebuild the recommendation
                    // from this session's AI results and store it.
                    $jobPos = db()->fetchOne("SELECT * FROM job_positions WHERE id = ? AND status = 'active'", [$selectedJobId]);
                    $sessionRec = null;
                    if (isset($_SESSION['current_application']['recommendations']) && is_array($_SESSION['current_application']['recommendations'])) {
                        foreach ($_SESSION['current_application']['recommendations'] as $sr) {
                            $sid = intval($sr['job_position_id'] ?? $sr['job_id'] ?? 0);
                            if ($sid === $selectedJobId) { $sessionRec = $sr; break; }
                        }
                    }
                    if ($jobPos) {
                        $recommendation = [
                            'id' => 0,
                            'applicant_id' => $applicantId,
                            'job_position_id' => $selectedJobId,
                            'match_score' => $sessionRec['match_score'] ?? 50,
                            'matching_skills' => json_encode($sessionRec['matching_skills'] ?? []),
                            'matching_experience' => json_encode($sessionRec['matching_experience'] ?? []),
                            'matching_education' => json_encode($sessionRec['matching_education'] ?? []),
                            'ai_reason' => $sessionRec['ai_reason'] ?? ($sessionRec['reason'] ?? "Profile aligns with position requirements"),
                            'job_title' => $jobPos['job_title'],
                        ];
                        try {
                            db()->insert('job_recommendations', [
                                'applicant_id' => $applicantId,
                                'job_position_id' => $selectedJobId,
                                'match_score' => floatval($recommendation['match_score']),
                                'matching_skills' => $recommendation['matching_skills'],
                                'matching_experience' => $recommendation['matching_experience'],
                                'matching_education' => $recommendation['matching_education'],
                                'ai_reason' => $recommendation['ai_reason'],
                            ]);
                        } catch (\Throwable $e) { error_log('portal.php review insert rec fallback: ' . $e->getMessage()); }
                    }
                }
            }
            if (!$applicant || !$recommendation || $selectedJobId <= 0) {
                json_response(['success' => false, 'message' => 'Please select a job position.', 'redirect' => 'recommendations'], 409);
            }

            json_response([
                'success'         => true,
                'job_position_id' => $selectedJobId,
                'applicant' => [
                    'full_name'     => trim($applicant['first_name'] . ' ' . ($applicant['middle_name'] ?? '') . ' ' . $applicant['last_name']),
                    'date_of_birth' => $applicant['date_of_birth'],
                    'gender'        => $applicant['gender'],
                    'mobile_number' => $applicant['mobile_number'],
                    'email'         => $applicant['email'],
                    'address'       => $applicant['address'],
                    'city'          => $applicant['city'],
                    'province'      => $applicant['province'],
                ],
                'education' => $education ? [
                    'highest_attainment' => $education['highest_attainment'],
                    'course'             => $education['course'],
                    'year_graduated'     => $education['year_graduated'],
                    'school'             => $education['school'],
                ] : null,
                'experience' => $experience ? [
                    'years_experience'     => $experience['years_experience'],
                    'current_position'     => $experience['current_position'],
                    'previous_company'     => $experience['previous_company'],
                    'skills'               => $experience['skills'],
                    'certifications'       => $experience['certifications'],
                    'professional_summary' => $experience['professional_summary'],
                ] : null,
                'resume' => $resume ? [
                    'original_filename' => $resume['original_filename'],
                    'file_size'         => (int)$resume['file_size'],
                    'file_path'         => $resume['file_path'],
                ] : null,
                'recommendation' => [
                    'job_title'           => $recommendation['job_title'],
                    'match_score'         => floatval($recommendation['match_score'] ?? 0),
                    'matching_skills'     => portal_json_list($recommendation['matching_skills'] ?? '[]'),
                    'matching_experience' => portal_json_list($recommendation['matching_experience'] ?? '[]'),
                    'matching_education'  => portal_json_list($recommendation['matching_education'] ?? '[]'),
                    'ai_reason'           => (string)($recommendation['ai_reason'] ?? ''),
                ],
                'screening' => [
                    'skills'     => portal_json_list($screening['extracted_skills'] ?? '[]'),
                    'experience' => portal_json_list($screening['extracted_experience'] ?? '[]'),
                    'education'  => portal_json_list($screening['extracted_education'] ?? '[]'),
                    'ai_summary' => (string)($screening['ai_summary'] ?? ''),
                ],
            ]);
            break;

        case 'application':
            $applicationNumber = (string)($_GET['app'] ?? '');
            $application = null;
            // Only the session that submitted it sees the details (the page still
            // shows its general confirmation otherwise).
            if ($applicationNumber !== '' && in_array($applicationNumber, $_SESSION['submitted_applications'] ?? [], true)) {
                $application = db()->fetchOne(
                    "SELECT a.*, jp.job_title, ap.applicant_number, ap.first_name, ap.middle_name, ap.last_name, ap.email, ap.mobile_number
                     FROM applications a
                     JOIN job_positions jp ON a.job_position_id = jp.id
                     JOIN applicants ap ON a.applicant_id = ap.id
                     WHERE a.application_number = ?",
                    [$applicationNumber]
                );
            }
            json_response([
                'success'     => true,
                'application' => $application ? [
                    'application_number' => $application['application_number'],
                    'applicant_number'   => $application['applicant_number'],
                    'full_name'          => trim(($application['first_name'] ?? '') . ' ' . ($application['middle_name'] ?? '') . ' ' . ($application['last_name'] ?? '')),
                    'job_title'          => $application['job_title'],
                    'status'             => $application['status'],
                    'match_score'        => $application['match_score'],
                    'submitted_at'       => $application['submitted_at'],
                    'email'              => $application['email'],
                ] : null,
            ]);
            break;

        default:
            json_response(['success' => false, 'message' => 'Invalid action'], 400);
    }
} catch (Throwable $e) {
    error_log('portal.php ' . $action . ': ' . $e->getMessage());
    json_response(['success' => false, 'message' => 'A server error occurred. Please try again or contact support.'], 500);
}
