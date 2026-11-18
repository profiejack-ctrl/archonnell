<?php
/**
 * Applicant Portal sign-in state, kept in the portal's own PHP session
 * (ARCHONNELL_APPSESSID, started by config.php) - never in the HRMS login.
 *
 * Only the application number is stored; every request looks the
 * application up again from it, so no database id reaches the browser.
 */

require_once __DIR__ . '/config.php';

/** Signed-in portal sessions end after 30 minutes without activity (same as the HRMS). */
const AP_SESSION_TTL = 1800;

/**
 * Application number of the signed-in applicant, or null.
 * $touch = false for background refreshes, so they never keep a session alive.
 */
function ap_signed_in_application(bool $touch = true): ?string
{
    $state = $_SESSION['applicant_portal'] ?? null;
    if (!is_array($state) || empty($state['application_number'])) {
        return null;
    }
    if (time() - (int)($state['last_activity'] ?? 0) > AP_SESSION_TTL) {
        unset($_SESSION['applicant_portal']);
        return null;
    }
    if ($touch) {
        $_SESSION['applicant_portal']['last_activity'] = time();
    }
    return (string)$state['application_number'];
}

/** Sign the applicant in (new session id, so a pre-set session cannot be reused). */
function ap_sign_in(string $applicationNumber): void
{
    session_regenerate_id(true);
    unset($_SESSION['applicant_portal_pending']);
    $_SESSION['applicant_portal'] = [
        'application_number' => $applicationNumber,
        'signed_in_at'       => time(),
        'last_activity'      => time(),
    ];
}

/** Sign out of the portal only; an application in progress in this browser is kept. */
function ap_sign_out(): void
{
    unset($_SESSION['applicant_portal'], $_SESSION['applicant_portal_pending']);
    session_regenerate_id(true);
}
