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

$identifier = $_SERVER['REMOTE_ADDR'] . ':' . ($_POST['session_id'] ?? session_id());
if (!Security::checkRateLimit($identifier . ':upload', 5, 300)) {
    json_response(['success' => false, 'message' => 'Too many upload requests. Please try again later.'], 429);
}

$csrf = $_POST['csrf_token'] ?? '';
if (!verify_csrf_token($csrf)) {
    json_response(['success' => false, 'message' => 'Invalid security token. Please refresh the page.'], 403);
}

$applicantData = [
    'first_name' => $_POST['first_name'] ?? '',
    'middle_name' => $_POST['middle_name'] ?? '',
    'last_name' => $_POST['last_name'] ?? '',
    'date_of_birth' => $_POST['date_of_birth'] ?? '',
    'gender' => $_POST['gender'] ?? '',
    'email' => $_POST['email'] ?? '',
    'mobile_number' => $_POST['mobile_number'] ?? '',
    'address' => $_POST['address'] ?? '',
    'city' => $_POST['city'] ?? '',
    'province' => $_POST['province'] ?? '',
    'highest_attainment' => $_POST['highest_attainment'] ?? '',
    'school' => $_POST['school'] ?? '',
    'course' => $_POST['course'] ?? '',
    'year_graduated' => $_POST['year_graduated'] ?? '',
    'years_experience' => $_POST['years_experience'] ?? '',
    'current_position' => $_POST['current_position'] ?? '',
    'previous_company' => $_POST['previous_company'] ?? '',
    'skills' => $_POST['skills'] ?? '',
    'certifications' => $_POST['certifications'] ?? '',
    'professional_summary' => $_POST['professional_summary'] ?? '',
];

$validationErrors = Security::validateApplicantData($applicantData);

$fileErrors = Security::validateResumeFile($_FILES['resume'] ?? null);
$errors = array_merge($validationErrors, $fileErrors);

if (!empty($errors)) {
    json_response(['success' => false, 'message' => 'Validation failed', 'errors' => $errors], 422);
}

$pdo = pdo();

try {
    $pdo->beginTransaction();
    
    $applicantNumber = generate_applicant_number($pdo);
    
    $applicantId = db()->insert('applicants', [
        'applicant_number' => $applicantNumber,
        'first_name' => Security::sanitizeInput($applicantData['first_name']),
        'middle_name' => Security::sanitizeInput($applicantData['middle_name']) ?: null,
        'last_name' => Security::sanitizeInput($applicantData['last_name']),
        'date_of_birth' => $applicantData['date_of_birth'],
        'gender' => $applicantData['gender'],
        'email' => strtolower(trim($applicantData['email'])),
        'mobile_number' => Security::sanitizeInput($applicantData['mobile_number']),
        'address' => Security::sanitizeInput($applicantData['address']),
        'city' => Security::sanitizeInput($applicantData['city']),
        'province' => Security::sanitizeInput($applicantData['province']),
    ]);
    
    db()->insert('applicant_education', [
        'applicant_id' => $applicantId,
        'highest_attainment' => Security::sanitizeInput($applicantData['highest_attainment']),
        'school' => Security::sanitizeInput($applicantData['school']),
        'course' => Security::sanitizeInput($applicantData['course']),
        'year_graduated' => Security::sanitizeInput($applicantData['year_graduated']),
    ]);
    
    db()->insert('applicant_experience', [
        'applicant_id' => $applicantId,
        'years_experience' => floatval($applicantData['years_experience']),
        'current_position' => Security::sanitizeInput($applicantData['current_position']),
        'previous_company' => Security::sanitizeInput($applicantData['previous_company']),
        'skills' => Security::sanitizeInput($applicantData['skills']),
        'certifications' => Security::sanitizeInput($applicantData['certifications']) ?: null,
        'professional_summary' => Security::sanitizeInput($applicantData['professional_summary']),
    ]);
    
    $file = $_FILES['resume'];
    $originalFilename = Security::sanitizeFileName($file['name']);
    $storedFilename = generate_resume_filename($originalFilename);
    
    $counter = 0;
    while (file_exists(RESUME_UPLOAD_DIR . $storedFilename)) {
        $counter++;
        $ext = strtolower(pathinfo($storedFilename, PATHINFO_EXTENSION));
        $nameWithoutExt = pathinfo($storedFilename, PATHINFO_FILENAME);
        $storedFilename = $nameWithoutExt . '_' . $counter . '.' . $ext;
    }
    
    $uploadPath = RESUME_UPLOAD_DIR . $storedFilename;
    $relativePath = 'uploads/resumes/' . $storedFilename;
    
    if (!move_uploaded_file($file['tmp_name'], $uploadPath)) {
        throw new Exception('Failed to move uploaded file');
    }
    
    chmod($uploadPath, 0644);
    
    $finfo = new finfo(FILEINFO_MIME_TYPE);
    $fileType = $finfo->file($uploadPath);
    
    $resumeId = db()->insert('resumes', [
        'applicant_id' => $applicantId,
        'original_filename' => $originalFilename,
        'stored_filename' => $storedFilename,
        'file_path' => $relativePath,
        'file_type' => $fileType,
        'file_size' => filesize($uploadPath),
    ]);

    // Job Posting -> Apply Now may have carried a specific job here; keep it
    // in session so the applicant does not have to pick it again after AI
    // Job Recommendation (still validated as a real, active posting).
    $preselectedJobId = intval($_POST['preselected_job_id'] ?? 0);
    if ($preselectedJobId > 0) {
        portal_sync_job_postings(); // a posting past its deadline no longer counts
        $preselectedJobRow = db()->fetchOne(
            "SELECT id FROM job_positions WHERE id = ? AND status = 'active'",
            [$preselectedJobId]
        );
        if (!$preselectedJobRow) {
            $preselectedJobId = 0;
        }
    }

    $_SESSION['current_application'] = [
        'applicant_id' => $applicantId,
        'resume_id' => $resumeId,
        'applicant_number' => $applicantNumber,
        'applicant_data' => $applicantData,
        'form_data' => $applicantData,
        'preselected_job_id' => $preselectedJobId ?: null,
        'resume_data' => [
            'original_filename' => $originalFilename,
            'stored_filename' => $storedFilename,
            'file_path' => $relativePath,
        ],
    ];
    
    $pdo->commit();
    
    json_response([
        'success' => true,
        'message' => 'Application data saved and resume uploaded successfully',
        'redirect_url' => APPLICANT_URL . 'screening.php?applicant=' . $applicantId,
        'applicant_id' => $applicantId,
    ]);
    
} catch (Exception $e) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    
    if (isset($uploadPath) && file_exists($uploadPath)) {
        @unlink($uploadPath);
    }
    
    error_log('Upload handler error: ' . $e->getMessage());
    json_response(['success' => false, 'message' => 'An error occurred: ' . $e->getMessage()], 500);
}
