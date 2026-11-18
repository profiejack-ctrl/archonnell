<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/hrms_bridge.php';

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_response(['success' => false, 'message' => 'Method not allowed'], 405);
}

$csrf = $_POST['csrf_token'] ?? '';
if (!verify_csrf_token($csrf)) {
    json_response(['success' => false, 'message' => 'Invalid security token'], 403);
}

$action = $_POST['action'] ?? 'submit';
$applicantId = intval($_POST['applicant_id'] ?? 0);

if ($applicantId <= 0) {
    json_response(['success' => false, 'message' => 'Invalid applicant ID'], 400);
}

$identifier = $_SERVER['REMOTE_ADDR'] . ':submit:' . $applicantId;
if (!Security::checkRateLimit($identifier, 5, 300)) {
    json_response(['success' => false, 'message' => 'Too many submission attempts. Please try again later.'], 429);
}

$pdo = pdo();

$applicant = db()->fetchOne("SELECT * FROM applicants WHERE id = ?", [$applicantId]);
if (!$applicant) {
    json_response(['success' => false, 'message' => 'Applicant not found'], 404);
}

switch ($action) {
    case 'submit':
        $jobPositionId = intval($_POST['job_position_id'] ?? 0);
        
        if ($jobPositionId <= 0) {
            json_response(['success' => false, 'message' => 'Please select a valid job position'], 400);
        }
        
        // Only a Published Job Posting that is open (not past its deadline) accepts applications.
        portal_sync_job_postings();
        $job = db()->fetchOne("SELECT * FROM job_positions WHERE id = ? AND status = 'active'", [$jobPositionId]);
        if (!$job) {
            json_response(['success' => false, 'message' => 'This job posting is closed and no longer accepts applications.'], 400);
        }
        
        $existing = db()->fetchOne(
            "SELECT id FROM applications WHERE applicant_id = ? AND job_position_id = ? AND status IN ('Submitted', 'Under Review', 'Shortlisted')",
            [$applicantId, $jobPositionId]
        );
        if ($existing) {
            json_response(['success' => false, 'message' => 'You have already applied for this position'], 400);
        }
        
        try {
            $pdo->beginTransaction();
            
            $applicationNumber = generate_application_number($pdo);
            
            $recommendation = db()->fetchOne(
                "SELECT * FROM job_recommendations WHERE applicant_id = ? AND job_position_id = ?",
                [$applicantId, $jobPositionId]
            );
            
            $matchScore = $recommendation ? floatval($recommendation['match_score']) : null;
            
            $applicationId = db()->insert('applications', [
                'applicant_id' => $applicantId,
                'job_position_id' => $jobPositionId,
                'application_number' => $applicationNumber,
                'status' => 'Submitted',
                'match_score' => $matchScore,
                'submitted_at' => date('Y-m-d H:i:s'),
            ]);
            
            $pdo->commit();

            // AI Resume Screening result checked against this Job Posting's requirements (for HR).
            portal_store_job_evaluation($applicantId, $jobPositionId);

            // E-mail the applicant a submission confirmation (best-effort:
            // a mail outage must never affect a successful application).
            try {
                $mailerPath = dirname(__DIR__, 2) . '/config/mailer.php';
                if (is_file($mailerPath)) {
                    require_once $mailerPath;
                    $applicantEmail = trim((string)($applicant['email'] ?? ''));
                    if (function_exists('send_application_submitted_email')
                        && filter_var($applicantEmail, FILTER_VALIDATE_EMAIL)) {
                        $applicantName = trim(
                            ($applicant['first_name'] ?? '') . ' ' .
                            ($applicant['middle_name'] ?? '') . ' ' .
                            ($applicant['last_name'] ?? '')
                        );
                        send_application_submitted_email($applicantEmail, [
                            'name'           => $applicantName,
                            'application_id' => $applicationNumber,
                            'position'       => $job['job_title'] ?? '',
                            'date'           => date('F j, Y g:i A'),
                        ]);
                    }
                }
            } catch (Throwable $mailError) {
                error_log('application confirmation email failed: ' . $mailError->getMessage());
            }

            // Push the applicant into the main HRMS (Applicant Validation).
            // Best-effort: never let a bridge failure affect the applicant.
            try {
                $resumeRow = db()->fetchOne(
                    "SELECT * FROM resumes WHERE applicant_id = ? ORDER BY id DESC LIMIT 1",
                    [$applicantId]
                );
                hrms_bridge_sync_applicant($applicant, $job, $applicationNumber, $matchScore, $resumeRow ?: null);
            } catch (Throwable $bridgeError) {
                error_log('HRMS bridge invocation failed: ' . $bridgeError->getMessage());
            }

            unset($_SESSION['current_application']);
            // The success page shows this application's details to this session only.
            $_SESSION['submitted_applications'][] = $applicationNumber;

            json_response([
                'success' => true,
                'message' => 'Application submitted successfully!',
                'redirect_url' => APPLICANT_URL . 'success.php?app=' . $applicationNumber,
                'application' => [
                    'application_id' => $applicationId,
                    'application_number' => $applicationNumber,
                    'applicant_number' => $applicant['applicant_number'],
                    'job_title' => $job['job_title'],
                    'status' => 'Submitted',
                    'match_score' => $matchScore,
                    'submitted_at' => date('F j, Y g:i A'),
                ]
            ]);
            
        } catch (Exception $e) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }
            error_log('Submit error: ' . $e->getMessage());
            json_response(['success' => false, 'message' => 'Submission failed: ' . $e->getMessage()], 500);
        }
        break;

    case 'confirm':
        $applicationNumber = $_POST['application_number'] ?? '';
        
        if (empty($applicationNumber)) {
            json_response(['success' => false, 'message' => 'Invalid application number'], 400);
        }
        
        $application = db()->fetchOne(
            "SELECT a.*, jp.job_title, ap.applicant_number, 
                    CONCAT(ap.first_name, ' ', COALESCE(ap.middle_name, ''), ' ', ap.last_name) as full_name,
                    ap.email, ap.mobile_number
             FROM applications a
             JOIN job_positions jp ON a.job_position_id = jp.id
             JOIN applicants ap ON a.applicant_id = ap.id
             WHERE a.application_number = ?",
            [$applicationNumber]
        );
        
        if (!$application) {
            json_response(['success' => false, 'message' => 'Application not found'], 404);
        }
        
        json_response([
            'success' => true,
            'application' => [
                'application_number' => $application['application_number'],
                'applicant_number' => $application['applicant_number'],
                'full_name' => $application['full_name'],
                'email' => $application['email'],
                'mobile_number' => $application['mobile_number'],
                'job_title' => $application['job_title'],
                'status' => $application['status'],
                'match_score' => floatval($application['match_score']),
                'submitted_at' => date('F j, Y g:i A', strtotime($application['submitted_at'])),
            ]
        ]);
        break;

    default:
        json_response(['success' => false, 'message' => 'Invalid action'], 400);
}
