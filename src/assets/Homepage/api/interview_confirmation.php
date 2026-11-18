<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

/**
 * Interview attendance confirmation links e-mailed to applicants
 * (frontend: public #/interview-confirmation).
 *
 * The link carries a random token; only its SHA-256 hash is stored. The answer
 * is accepted only while the request is Pending Confirmation and its deadline
 * (3 days after it was sent, the database clock) has not passed; nothing else
 * identifies the applicant and no database id is returned.
 *
 *   GET  lookup   token            the interview + confirmation status + time left
 *   POST respond  token, choice=confirm|decline, reason (decline)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/hrms_bridge.php';
require_once dirname(__DIR__, 2) . '/config/interview_confirmation.php';

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

/** What the applicant sees about the request behind their link. */
function icp_view(PDO $hr, array $req): array
{
    $a = ic_applicant($hr, (int)$req['applicant_id'], $req['interview_round']);
    $type = trim((string)($a['itype'] ?? ''));
    $loc = trim((string)($a['iloc'] ?? ''));
    $online = strcasecmp($type, 'Online') === 0;
    return [
        'first_name'   => trim(explode(' ', (string)($a['full_name'] ?? ''))[0] ?? ''),
        'round'        => $req['interview_round'] === 'Pre-Interview' ? 'Initial Interview' : 'Final Interview',
        'position'     => (string)($a['position'] ?? ''),
        'department'   => (string)($a['department'] ?? ''),
        'interview_at' => $req['interview_at'],
        'type'         => $type === '' ? null : ($online ? 'Online' : 'Face to Face'),
        'location'     => $online ? null : ($loc !== '' ? $loc : null),
        'meeting_link' => $online && filter_var($loc, FILTER_VALIDATE_URL) ? $loc : null,
        'status'       => $req['status'],
        'deadline'     => $req['deadline'],
        'seconds_left' => (int)$req['seconds_left'],
        'responded_at' => $req['responded_at'],
        'can_respond'  => ic_closed_reason($req) === '',
        'closed_message' => ic_closed_reason($req) ?: null,
    ];
}

$action = (string)($_GET['action'] ?? ($_POST['action'] ?? 'lookup'));
$token = (string)($_GET['token'] ?? ($_POST['token'] ?? ''));
$invalid = 'This link is not valid. Please use the link in your latest interview e-mail, or sign in to the Applicant Portal.';

try {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (!Security::checkRateLimit($ip . ':interview-confirmation', 30, 900)) {
        json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Too many attempts. Please wait a few minutes and try again.'], 429);
    }
    $hr = hrms_bridge_pdo();
    if (!$hr) {
        throw new RuntimeException('unavailable');
    }
    ic_tick($hr);
    $req = ic_find_by_token($hr, $token);

    if ($action === 'lookup') {
        if (!$req) {
            json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => $invalid]);
        }
        json_response(['success' => true, 'csrf_token' => generate_csrf_token()] + icp_view($hr, $req));
    }

    if ($action === 'respond') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !verify_csrf_token($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
            json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Invalid security token. Please reload the page.'], 403);
        }
        if (!$req) {
            json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => $invalid], 404);
        }
        $choice = (string)($_POST['choice'] ?? '');
        if (!in_array($choice, ['confirm', 'decline'], true)) {
            json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Please choose Confirm or Decline.'], 422);
        }
        try {
            $res = ic_respond($hr, $req, $choice === 'confirm', (string)($_POST['reason'] ?? ''), 'Email');
        } catch (RuntimeException $e) {
            $now = ic_get($hr, (int)$req['id']);
            json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'expired' => ($now['status'] ?? '') === 'Expired', 'message' => $e->getMessage()], 422);
        }
        json_response(['success' => true, 'csrf_token' => generate_csrf_token(), 'status' => $res['status'],
            'message' => $res['status'] === 'Confirmed'
                ? 'Your attendance has been successfully confirmed. A confirmation e-mail was sent to you.'
                : 'Your answer has been sent to our recruitment team. They will contact you about the next step.']);
    }
    json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Invalid action.'], 400);
} catch (Throwable $e) {
    error_log('interview_confirmation.php: ' . $e->getMessage());
    json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'This page is temporarily unavailable. Please try again in a few minutes.'], 500);
}
