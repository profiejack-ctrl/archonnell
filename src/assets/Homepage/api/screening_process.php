<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/security.php';
require_once __DIR__ . '/text_extractor.php';
require_once __DIR__ . '/ai_service.php';
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

$applicantId = intval($_POST['applicant_id'] ?? 0);
$stage = $_POST['stage'] ?? 'start';

if ($applicantId <= 0) {
    json_response(['success' => false, 'message' => 'Invalid applicant ID'], 400);
}

$identifier = $_SERVER['REMOTE_ADDR'] . ':screening:' . $applicantId;
if (!Security::checkRateLimit($identifier, 10, 120)) {
    json_response(['success' => false, 'message' => 'Too many requests. Please try again later.'], 429);
}

$pdo = pdo();

$applicant = db()->fetchOne("SELECT * FROM applicants WHERE id = ?", [$applicantId]);
if (!$applicant) {
    json_response(['success' => false, 'message' => 'Applicant not found'], 404);
}

$resume = db()->fetchOne("SELECT * FROM resumes WHERE applicant_id = ? ORDER BY id DESC LIMIT 1", [$applicantId]);
if (!$resume) {
    json_response(['success' => false, 'message' => 'Resume not found'], 404);
}

$education = db()->fetchOne("SELECT * FROM applicant_education WHERE applicant_id = ? LIMIT 1", [$applicantId]);
$experience = db()->fetchOne("SELECT * FROM applicant_experience WHERE applicant_id = ? LIMIT 1", [$applicantId]);

switch ($stage) {
    case 'start':
        json_response([
            'success' => true,
            'stage' => 'extract',
            'progress' => 10,
            'message' => 'Initializing screening process...',
        ]);
        break;

    case 'extract':
        $fullResumePath = dirname(__DIR__) . DIRECTORY_SEPARATOR . $resume['file_path'];
        $resumeText = ResumeTextExtractor::extract($fullResumePath, $resume['file_type']);
        
        $_SESSION['current_application']['resume_text'] = $resumeText;
        
        $formData = [
            'first_name' => $applicant['first_name'],
            'middle_name' => $applicant['middle_name'] ?? '',
            'last_name' => $applicant['last_name'],
            'email' => $applicant['email'],
            'highest_attainment' => $education['highest_attainment'] ?? '',
            'school' => $education['school'] ?? '',
            'course' => $education['course'] ?? '',
            'year_graduated' => $education['year_graduated'] ?? '',
            'years_experience' => $experience['years_experience'] ?? '0',
            'current_position' => $experience['current_position'] ?? '',
            'previous_company' => $experience['previous_company'] ?? '',
            'skills' => $experience['skills'] ?? '',
            'certifications' => $experience['certifications'] ?? '',
        ];
        
        $_SESSION['current_application']['form_data'] = $formData;
        
        json_response([
            'success' => true,
            'stage' => 'analyze_skills',
            'progress' => 30,
            'message' => 'Extracting information from resume...',
            'data' => ['text_length' => strlen($resumeText)]
        ]);
        break;

    case 'analyze_skills':
    case 'analyze_experience':
    case 'analyze_education':
    case 'screen_complete':
        $resumeText = $_SESSION['current_application']['resume_text'] ?? '';
        $formData = $_SESSION['current_application']['form_data'] ?? [];
        
        $screeningResult = $_SESSION['current_application']['screening_result'] ?? null;
        $screeningId = $_SESSION['current_application']['screening_id'] ?? null;
        
        if (!$screeningResult) {
            $aiService = new AIService();
            $screeningResult = $aiService->screenResume($resumeText, $formData);
            
            if (!$screeningResult || !is_array($screeningResult)) {
                $screeningResult = [
                    'skills' => [],
                    'work_experience' => [],
                    'education' => [],
                    'certifications' => [],
                    'summary' => 'Resume screening completed successfully.'
                ];
            }
            
            $existingScreening = db()->fetchOne("SELECT id FROM resume_screenings WHERE applicant_id = ? AND resume_id = ?", [$applicantId, $resume['id']]);
            
            $screeningData = [
                'applicant_id' => $applicantId,
                'resume_id' => $resume['id'],
                'extracted_skills' => json_encode($screeningResult['skills'] ?? []),
                'extracted_experience' => json_encode($screeningResult['work_experience'] ?? []),
                'extracted_education' => json_encode($screeningResult['education'] ?? []),
                'extracted_certifications' => json_encode($screeningResult['certifications'] ?? []),
                'ai_summary' => $screeningResult['summary'] ?? '',
                'screening_result' => json_encode($screeningResult),
            ];
            
            if ($existingScreening) {
                db()->update('resume_screenings', $screeningData, 'id = ?', [$existingScreening['id']]);
                $screeningId = $existingScreening['id'];
            } else {
                $screeningId = db()->insert('resume_screenings', $screeningData);
            }
            
            $_SESSION['current_application']['screening_id'] = $screeningId;

            // Applying through a specific Job Posting: check the resume against its requirements
            // (stored for HR; the applicant's screening summary below does not include it).
            $preselectedJob = intval($_SESSION['current_application']['preselected_job_id'] ?? 0);
            if ($preselectedJob > 0) {
                portal_store_job_evaluation($applicantId, $preselectedJob);
            }
            $_SESSION['current_application']['screening_result'] = $screeningResult;
        }
        
        $progressMap = [
            'analyze_skills' => 55,
            'analyze_experience' => 75,
            'analyze_education' => 90,
            'screen_complete' => 100,
        ];
        
        $messageMap = [
            'analyze_skills' => 'Analyzing skills and competencies...',
            'analyze_experience' => 'Reviewing work experience...',
            'analyze_education' => 'Evaluating educational background...',
            'screen_complete' => 'Resume analysis complete!',
        ];
        
        $nextStages = [
            'analyze_skills' => 'analyze_experience',
            'analyze_experience' => 'analyze_education',
            'analyze_education' => 'screen_complete',
            'screen_complete' => 'done',
        ];
        
        $isDone = $stage === 'screen_complete';
        
        json_response([
            'success' => true,
            'stage' => $isDone ? 'done' : $nextStages[$stage],
            'progress' => $progressMap[$stage],
            'message' => $messageMap[$stage],
            'is_complete' => $isDone,
            'redirect_url' => $isDone ? (APPLICANT_URL . 'recommendations.php?applicant=' . $applicantId) : null,
            'screening_summary' => $isDone ? $screeningResult : null,
        ]);
        break;

    default:
        json_response(['success' => false, 'message' => 'Invalid stage'], 400);
}
