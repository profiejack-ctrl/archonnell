<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

/**
 * Job offer Accept / Decline links e-mailed to applicants (frontend: public #/job-offer).
 *
 * The link carries a random token; only its SHA-256 hash is stored and it is
 * cleared once the offer is answered or expires. The answer is accepted only
 * while the offer is Extended, unanswered and not past its expiration date
 * (checked by the database). No database id is returned.
 *
 *   GET  lookup   token                                   the offer as the applicant sees it
 *   POST respond  token, choice=accept|decline, reason    (reason required to decline)
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/hrms_bridge.php';
require_once dirname(__DIR__, 2) . '/config/job_offer_response.php';

header('Content-Type: application/json');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$action = (string)($_GET['action'] ?? ($_POST['action'] ?? 'lookup'));
$token = (string)($_GET['token'] ?? ($_POST['token'] ?? ''));
$invalid = 'This link is no longer valid: the offer was already answered, it expired, or a newer e-mail replaced it. Please sign in to the Applicant Portal to see your job offer.';

try {
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    if (!Security::checkRateLimit($ip . ':job-offer-link', 30, 900)) {
        json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Too many attempts. Please wait a few minutes and try again.'], 429);
    }
    $hr = hrms_bridge_pdo();
    if (!$hr) {
        throw new RuntimeException('unavailable');
    }
    $o = jor_find_by_token($hr, $token);

    if ($action === 'lookup') {
        if (!$o) {
            json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => $invalid]);
        }
        json_response(['success' => true, 'csrf_token' => generate_csrf_token(), 'first_name' => trim(explode(' ', (string)$o['full_name'])[0] ?? '')] + jor_view($o));
    }

    if ($action === 'respond') {
        if ($_SERVER['REQUEST_METHOD'] !== 'POST' || !verify_csrf_token($_POST['csrf_token'] ?? ($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) {
            json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Invalid security token. Please reload the page.'], 403);
        }
        if (!$o) {
            json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => $invalid], 404);
        }
        $choice = (string)($_POST['choice'] ?? '');
        if (!in_array($choice, ['accept', 'decline'], true)) {
            json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Please choose Accept or Decline.'], 422);
        }
        try {
            $res = jor_respond($hr, $o, $choice === 'accept', (string)($_POST['reason'] ?? ''), 'Email');
        } catch (RuntimeException $e) {
            json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => $e->getMessage()], 422);
        }
        json_response(['success' => true, 'csrf_token' => generate_csrf_token(), 'message' => $res['applicant_response'] === 'Accepted'
            ? 'Thank you! You accepted the job offer. Our HR team will confirm your hiring and contact you about onboarding.'
            : 'Your answer has been sent to our HR team. Thank you for letting us know.']);
    }
    json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'Invalid action.'], 400);
} catch (Throwable $e) {
    error_log('job_offer_response.php: ' . $e->getMessage());
    json_response(['success' => false, 'csrf_token' => generate_csrf_token(), 'message' => 'This page is temporarily unavailable. Please try again in a few minutes.'], 500);
}
