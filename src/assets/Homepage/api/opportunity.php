<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

/**
 * Answer links e-mailed to applicants (frontend: public #/opportunity).
 *
 *   type=future: "Consider for Future Opportunities" after a rejection
 *                (choice yes -> Talent Pool, no -> no future contact)
 *   type=job:    a Future Job Opportunity sent from the Talent Pool
 *                (choice accept -> a new application, decline)
 *
 * The link carries a random token; only its SHA-256 hash is stored, it works
 * once, and it expires. Nothing else identifies the applicant, and no
 * database id is returned.
 *
 *   GET  lookup   type, token      what the link is about (first name, position, status)
 *   POST respond  type, token, choice
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/hrms_bridge.php';
require_once dirname(__DIR__, 2) . '/config/mailer.php';
require_once dirname(__DIR__, 2) . '/config/talent_pool.php';

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

/** The record behind a link, or null (unknown, used or expired). */
function op_find(PDO $hr, string $type, string $token): ?array
{
    if (!preg_match('/^[A-Za-z0-9_-]{30,60}$/', $token)) {
        return null;
    }
    $hash = hash('sha256', $token);
    if ($type === 'future') {
        $s = $hr->prepare("SELECT * FROM applicants WHERE future_token_hash = :h AND future_token_expires >= LOCALTIMESTAMP
                           AND future_pref = 'Pending Response' AND stage = 'Rejected' AND archived_at IS NULL");
        $s->execute(['h' => $hash]);
        return $s->fetch() ?: null;
    }
    if ($type === 'job') {
        tp_expire($hr);
        $s = $hr->prepare("SELECT id FROM future_opportunities WHERE token_hash = :h AND status = 'Invited'");
        $s->execute(['h' => $hash]);
        $id = $s->fetchColumn();
        return $id ? tp_opportunity($hr, (int)$id) : null;
    }
    return null;
}

$action = (string)($_GET['action'] ?? ($_POST['action'] ?? 'lookup'));
$type = (string)($_GET['type'] ?? ($_POST['type'] ?? ''));
$token = (string)($_GET['token'] ?? ($_POST['token'] ?? ''));
$gone = 'This link is no longer valid: it was already used, it expired, or the invitation was withdrawn. You can sign in to the Applicant Portal to see your applications.';

try {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (!Security::checkRateLimit($ip . ':opportunity-link', 30, 900)) {
        json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Too many attempts. Please wait a few minutes and try again.'], 429);
    }
    $hr = hrms_bridge_pdo();
    if (!$hr) {
        throw new RuntimeException('unavailable');
    }
    if (!in_array($type, ['future', 'job'], true)) {
        json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Invalid link.'], 400);
    }
    $rec = op_find($hr, $type, $token);

    if ($action === 'lookup') {
        if (!$rec) {
            // An already used / expired link is a normal outcome, not an error.
            json_response(['success' => false, 'gone' => true, 'csrf_token' => generate_csrf_token(), 'message' => $gone]);
        }
        $first = trim(explode(' ', (string)$rec['full_name'])[0] ?? '');
        json_response(['success' => true, 'csrf_token' => generate_csrf_token(), 'type' => $type, 'first_name' => $first] + ($type === 'future'
            ? ['position' => $rec['position']]
            : ['job_title' => $rec['job_title'], 'department' => $rec['department'], 'posting_no' => $rec['posting_no'], 'employment_type' => $rec['employment_type'],
               'message' => $rec['message'], 'expires_at' => $rec['expires_at']]));
    }

    if ($action === 'respond') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !verify_csrf_token($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
            json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Invalid security token. Please reload the page.'], 403);
        }
        if (!$rec) {
            json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => $gone], 404);
        }
        $choice = (string)($_POST['choice'] ?? '');
        try {
            if ($type === 'future') {
                if (!in_array($choice, ['yes', 'no'], true)) {
                    throw new RuntimeException('Please choose Yes or No.');
                }
                tp_set_preference($hr, (int)$rec['id'], $choice === 'yes', 'Email');
                $msg = $choice === 'yes'
                    ? 'Thank you! Your profile is now in our Talent Pool, and we may contact you about future opportunities that match your qualifications.'
                    : 'Thank you for letting us know. We will not contact you about future opportunities. You can change this in the Applicant Portal.';
                json_response(['success' => true, 'csrf_token' => generate_csrf_token(), 'message' => $msg]);
            }
            if (!in_array($choice, ['accept', 'decline'], true)) {
                throw new RuntimeException('Please choose Accept or Decline.');
            }
            $res = tp_respond_opportunity($hr, pdo(), $rec, $choice === 'accept', 'Email');
            json_response(['success' => true, 'csrf_token' => generate_csrf_token(), 'application_no' => $res['application']['application_no'] ?? null,
                'message' => $choice === 'accept'
                    ? 'Thank you! A new application was created for ' . $rec['job_title'] . (!empty($res['application']['application_no'])
                        ? ' (Application ID ' . $res['application']['application_no'] . '). Use it with your e-mail address and date of birth to follow it in the Applicant Portal.'
                        : '.') . ' It now goes through our normal recruitment process.'
                    : 'Thank you for letting us know. We will not send you further invitations unless you change your preference in the Applicant Portal.']);
        } catch (RuntimeException $e) {
            json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => $e->getMessage()], 422);
        }
    }
    json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Invalid action.'], 400);
} catch (Throwable $e) {
    error_log('opportunity.php: ' . $e->getMessage());
    json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'This page is temporarily unavailable. Please try again in a few minutes.'], 500);
}
