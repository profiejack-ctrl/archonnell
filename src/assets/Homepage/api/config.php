<?php
// Same clock as the HRMS (config/database.php) and the database sessions (Asia/Manila):
// submission times, application numbers and deadlines use the Philippine date and time.
date_default_timezone_set('Asia/Manila');

if (session_status() === PHP_SESSION_NONE) {
    /*
     * Use a session cookie name distinct from the main HRMS app (which
     * shares this same domain/path but keeps its own session store and
     * regenerates its session ID under strict mode). Without this, a
     * visit to the HRMS side (e.g. Employee Portal / login) while an
     * Applicant Phase form is open would silently swap out the shared
     * "PHPSESSID" cookie for a new, empty session - so by the time the
     * applicant clicked Continue, the CSRF token stored in this session
     * (and the applicant/application progress) was gone, producing
     * "Invalid security token." Giving this portal its own cookie name
     * keeps its session (and CSRF token) intact regardless of what the
     * HRMS app does to its own session.
     */
    if (session_name() !== 'ARCHONNELL_APPSESSID') {
        session_name('ARCHONNELL_APPSESSID');
    }
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'domain'   => '',
        'secure'   => (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off'),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

if (empty($_SESSION['csrf_token'])) {
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
}

function _ajax_shutdown_handler() {
    $error = error_get_last();
    if ($error && in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR])) {
        if (is_ajax_request() || (isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false)) {
            while (ob_get_level()) {
                ob_end_clean();
            }
            http_response_code(500);
            header('Content-Type: application/json');
            header('X-Content-Type-Options: nosniff');
            error_log('Fatal error in ' . $error['file'] . ':' . $error['line'] . ' - ' . $error['message']);
            echo json_encode([
                'success' => false,
                'message' => 'A server error occurred. Please try again or contact support.'
            ]);
        }
    }
}
register_shutdown_function('_ajax_shutdown_handler');

// Shared project-root .env (same loader the HRMS uses). The legacy DB_NAME /
// DB_USER / DB_PASS variable names are still honoured as fallbacks.
require_once dirname(__DIR__, 2) . '/config/env.php';

define('DB_HOST', env_get('DB_HOST', 'localhost'));
define('DB_PORT', env_get('DB_PORT', '5432'));
define('DB_NAME', env_get('PORTAL_DB_DATABASE', env_get('DB_NAME', 'archon_nell_recruitment')));
define('DB_USER', env_get('DB_USERNAME', env_get('DB_USER', 'postgres')));
define('DB_PASS', env_get('DB_PASSWORD', env_get('DB_PASS', '')));

define('AI_API_KEY', env_get('AI_API_KEY', ''));
define('AI_API_ENDPOINT', env_get('AI_API_ENDPOINT', 'https://api.openai.com/v1/chat/completions'));
define('AI_MODEL', env_get('AI_MODEL', 'gpt-4o-mini'));

define('MAX_RESUME_SIZE', 5 * 1024 * 1024);
define('ALLOWED_RESUME_TYPES', ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
define('ALLOWED_RESUME_EXTENSIONS', ['pdf', 'doc', 'docx']);

define('RESUME_UPLOAD_DIR', dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'resumes' . DIRECTORY_SEPARATOR);

$scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
$host   = $_SERVER['HTTP_HOST'] ?? 'localhost';
$self   = $_SERVER['PHP_SELF'] ?? '/Homepage/api/config.php';
define('SITE_URL', $scheme . '://' . $host . dirname($self, 2) . '/');
define('APPLICANT_URL', SITE_URL . 'applicant/');

if (!is_dir(RESUME_UPLOAD_DIR)) {
    mkdir(RESUME_UPLOAD_DIR, 0755, true);
}

$htaccess_path = dirname(__DIR__) . DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . '.htaccess';
if (!file_exists($htaccess_path)) {
    file_put_contents($htaccess_path, "Options -Indexes\n<FilesMatch \"\.(php|php5|phtml|pl|py|jsp|asp|aspx|sh|cgi)$\">\nOrder Allow,Deny\nDeny from all\n</FilesMatch>\n");
}

function sanitize_output($data) {
    if (is_array($data)) {
        return array_map('sanitize_output', $data);
    }
    return htmlspecialchars($data ?? '', ENT_QUOTES, 'UTF-8');
}

function e($str) {
    echo sanitize_output($str);
}

/**
 * Cache-busting query string ("?v=<mtime>") for a static asset under the
 * Homepage root, e.g. asset_version('js/applicant.js'). Without this,
 * browsers can keep serving an old cached copy of applicant.js even after
 * the file on disk has been fixed - which looks exactly like the fix never
 * happened (e.g. an outdated CSRF/validation error handler still running).
 * The version changes only when the file itself changes.
 */
function asset_version(string $relativePath): string {
    $full = dirname(__DIR__) . DIRECTORY_SEPARATOR . str_replace('/', DIRECTORY_SEPARATOR, $relativePath);
    $mtime = @filemtime($full);
    return '?v=' . ($mtime ?: '1');
}

function generate_csrf_token() {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}

function verify_csrf_token($token) {
    if (empty($_SESSION['csrf_token']) || empty($token)) {
        return false;
    }
    return hash_equals($_SESSION['csrf_token'], $token);
}

function generate_applicant_number($pdo) {
    $year = date('Y');
    $stmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM applicants WHERE applicant_number LIKE ?");
    $stmt->execute(["APP-{$year}-%"]);
    $count = $stmt->fetchColumn() + 1;
    return sprintf("APP-%s-%05d", $year, $count);
}

function generate_application_number($pdo) {
    $year = date('Y');
    $stmt = $pdo->prepare("SELECT COUNT(*) as cnt FROM applications WHERE application_number LIKE ?");
    $stmt->execute(["AP-{$year}-%"]);
    $count = $stmt->fetchColumn() + 1;
    return sprintf("AP-%s-%05d", $year, $count);
}

function generate_resume_filename($originalName) {
    $ext = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));
    $year = date('Y');
    $rand = str_pad(mt_rand(1, 99999), 5, '0', STR_PAD_LEFT);
    return "RESUME_{$year}_{$rand}.{$ext}";
}

function flash_message($key = null, $message = null) {
    if ($message !== null) {
        $_SESSION['flash'][$key] = $message;
    } elseif ($key !== null) {
        if (isset($_SESSION['flash'][$key])) {
            $msg = $_SESSION['flash'][$key];
            unset($_SESSION['flash'][$key]);
            return $msg;
        }
        return null;
    }
    return null;
}

function redirect($url) {
    header("Location: {$url}");
    exit;
}

if (!function_exists('json_response')) {
    function json_response($data, $code = 200) {
        while (ob_get_level()) {
            ob_end_clean();
        }
        http_response_code($code);
        header('Content-Type: application/json');
        header('X-Content-Type-Options: nosniff');
        echo json_encode($data);
        exit;
    }
}

function is_ajax_request() {
    return isset($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest';
}
