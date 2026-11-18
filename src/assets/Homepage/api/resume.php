<?php
error_reporting(0);
ini_set('display_errors', 0);

/**
 * Lets an applicant open the resume they just uploaded, from the Review &
 * Submit step. Resumes stay unreachable over HTTP (uploads/resumes/.htaccess);
 * this serves only the latest resume of the application in progress in this
 * browser session. HR staff use /download-resume.php (login + permission).
 *
 *   GET resume.php?applicant=<id>
 *   GET resume.php?portal=1        the resume of the application signed in to the Applicant Portal
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/applicant_portal_auth.php';

function resume_fail(int $code, string $message): never
{
    http_response_code($code);
    header('Content-Type: text/plain; charset=utf-8');
    header('X-Content-Type-Options: nosniff');
    echo $message;
    exit;
}

if (isset($_GET['portal'])) {
    // Applicant Portal: the application comes from the signed-in session only.
    $portalApplication = ap_signed_in_application();
    if (!$portalApplication) {
        resume_fail(404, 'Resume not found.');
    }
    $portalRow = db()->fetchOne(
        "SELECT a.applicant_id FROM applications a
         JOIN applicants ap ON ap.id = a.applicant_id
         WHERE UPPER(a.application_number) = UPPER(?) OR UPPER(ap.applicant_number) = UPPER(?)
         LIMIT 1",
        [$portalApplication, $portalApplication]
    );
    $applicantId = $portalRow ? (int)$portalRow['applicant_id'] : 0;
} else {
    $portalApplication = null;
    $applicantId = intval($_GET['applicant'] ?? 0);
    if ($applicantId <= 0 || (int)($_SESSION['current_application']['applicant_id'] ?? 0) !== $applicantId) {
        resume_fail(404, 'Resume not found.');
    }
}

$resume = $applicantId > 0
    ? db()->fetchOne("SELECT * FROM resumes WHERE applicant_id = ? ORDER BY id DESC LIMIT 1", [$applicantId])
    : null;

$path = null;
$originalName = null;

if ($resume && !empty($resume['file_path'])) {
    $dir = realpath(RESUME_UPLOAD_DIR);
    $candidate = realpath(dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, (string)$resume['file_path']));
    if ($dir && $candidate && strpos($candidate, $dir . DIRECTORY_SEPARATOR) === 0 && is_file($candidate)) {
        $path = $candidate;
        $originalName = (string)($resume['original_filename'] ?? basename($candidate));
    }
}

// Fallback: check archon_nell.applicants.resume_path for portal session
if (!$path && $portalApplication) {
    require_once __DIR__ . '/hrms_bridge.php';
    $hr = hrms_bridge_pdo();
    if ($hr) {
        $stmt = $hr->prepare(
            "SELECT resume_path FROM applicants
             WHERE UPPER(source_application_no) = UPPER(:q) OR UPPER(applicant_no) = UPPER(:q)
             LIMIT 1"
        );
        $stmt->execute(['q' => $portalApplication]);
        $hrRow = $stmt->fetch();
        if ($hrRow && !empty($hrRow['resume_path'])) {
            $root = dirname(__DIR__, 2);
            $candidate = realpath($root . '/' . ltrim(str_replace('\\', '/', (string)$hrRow['resume_path']), '/'));
            $uploadRoot = realpath(dirname(__DIR__) . '/uploads/resumes');
            if ($uploadRoot && $candidate && strpos($candidate, $uploadRoot . DIRECTORY_SEPARATOR) === 0 && is_file($candidate)) {
                $path = $candidate;
                $originalName = basename($candidate);
            }
        }
    }
}

if (!$path || !is_file($path)) {
    resume_fail(404, 'Resume file not found.');
}

$ext  = strtolower(pathinfo($path, PATHINFO_EXTENSION));
$mime = [
    'pdf'  => 'application/pdf',
    'doc'  => 'application/msword',
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
][$ext] ?? null;
if ($mime === null) {
    resume_fail(404, 'Resume file not found.');
}

// PDFs open in the browser; Word files download.
$name = preg_replace('/[^\w.\- ()]+/u', '_', (string)($resume['original_filename'] ?: basename($path)));
while (ob_get_level()) {
    ob_end_clean();
}
header('Content-Type: ' . $mime);
header('Content-Length: ' . filesize($path));
header('Content-Disposition: ' . ($ext === 'pdf' ? 'inline' : 'attachment') . '; filename="' . $name . '"');
header('X-Content-Type-Options: nosniff');
header('Cache-Control: private, no-store');
readfile($path);
exit;
