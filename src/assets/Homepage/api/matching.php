<?php
error_reporting(0);
ini_set('display_errors', 0);
ob_start();

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/security.php';
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

$action = $_POST['action'] ?? 'generate';
$applicantId = intval($_POST['applicant_id'] ?? 0);

if ($applicantId <= 0) {
    json_response(['success' => false, 'message' => 'Invalid applicant ID'], 400);
}

$identifier = $_SERVER['REMOTE_ADDR'] . ':matching:' . $applicantId;
if (!Security::checkRateLimit($identifier, 10, 120)) {
    json_response(['success' => false, 'message' => 'Too many requests. Please try again later.'], 429);
}

$pdo = pdo();

$applicant = db()->fetchOne("SELECT * FROM applicants WHERE id = ?", [$applicantId]);
if (!$applicant) {
    json_response(['success' => false, 'message' => 'Applicant not found'], 404);
}

switch ($action) {
    case 'generate':
        $stage = $_POST['stage'] ?? 'start';
        
        $screening = db()->fetchOne("SELECT * FROM resume_screenings WHERE applicant_id = ? ORDER BY id DESC LIMIT 1", [$applicantId]);
        if (!$screening) {
            json_response(['success' => false, 'message' => 'Resume screening not completed. Please go back and complete screening first.'], 400);
        }
        
        // Published Job Postings that accept applications (their requirements are on these rows).
        portal_sync_job_postings();
        $activeJobs = db()->fetchAll("SELECT * FROM job_positions WHERE status = 'active' ORDER BY id ASC");
        if (empty($activeJobs)) {
            json_response(['success' => false, 'message' => 'No available job positions at the moment.'], 400);
        }
        
        $screeningResult = json_decode($screening['screening_result'] ?? '{}', true) ?: [];
        
        $profile = [
            'skills' => $screeningResult['skills'] ?? json_decode($screening['extracted_skills'] ?? '[]', true),
            'work_experience' => $screeningResult['work_experience'] ?? json_decode($screening['extracted_experience'] ?? '[]', true),
            'education' => $screeningResult['education'] ?? json_decode($screening['extracted_education'] ?? '[]', true),
            'certifications' => $screeningResult['certifications'] ?? json_decode($screening['extracted_certifications'] ?? '[]', true),
            'summary' => $screening['ai_summary'] ?? $screeningResult['summary'] ?? '',
        ];
        
        $aiService = new AIService();
        $matchResult = $aiService->recommendJobs($profile, $activeJobs);
        
        $rawRecommendations = $matchResult['recommendations'] ?? [];
        $recommendations = [];
        
        foreach ($rawRecommendations as $raw) {
            $jobPosId = intval($raw['job_position_id'] ?? $raw['job_id'] ?? 0);
            if ($jobPosId <= 0) continue;
            $jobMatch = null;
            foreach ($activeJobs as $aj) {
                if (intval($aj['id']) === $jobPosId) {
                    $jobMatch = $aj;
                    break;
                }
            }
            $recommendations[] = [
                'job_id' => $jobPosId,
                'job_position_id' => $jobPosId,
                'job_title' => $raw['job_title'] ?? ($jobMatch['job_title'] ?? 'Position'),
                'description' => $raw['description'] ?? ($jobMatch['description'] ?? ''),
                'match_score' => floatval($raw['match_score'] ?? 0),
                'matching_skills' => array_values($raw['matching_skills'] ?? []),
                'matching_experience' => array_values($raw['matching_experience'] ?? []),
                'matching_education' => array_values($raw['matching_education'] ?? []),
                'ai_reason' => $raw['ai_reason'] ?? ($raw['reason'] ?? ''),
                'reason' => $raw['reason'] ?? ($raw['ai_reason'] ?? ''),
            ];
        }
        
        if (!empty($recommendations)) {
            db()->delete('job_recommendations', 'applicant_id = ?', [$applicantId]);
            
            foreach ($recommendations as $rec) {
                db()->insert('job_recommendations', [
                    'applicant_id' => $applicantId,
                    'job_position_id' => intval($rec['job_position_id']),
                    'match_score' => floatval($rec['match_score']),
                    'matching_skills' => json_encode($rec['matching_skills']),
                    'matching_experience' => json_encode($rec['matching_experience']),
                    'matching_education' => json_encode($rec['matching_education']),
                    'ai_reason' => $rec['ai_reason'],
                ]);
            }
        }
        
        $_SESSION['current_application']['profile'] = $profile;
        $_SESSION['current_application']['recommendations'] = $recommendations;
        
        $stageMessages = [
            'start' => 'Loading applicant profile...',
            'load_jobs' => 'Fetching available positions...',
            'compare_skills' => 'Comparing skills with job requirements...',
            'compare_experience' => 'Matching work experience...',
            'calculate' => 'Calculating compatibility scores...',
            'finalize' => 'Generating recommendations...',
            'done' => 'Recommendations ready!',
        ];
        
        $stages = array_keys($stageMessages);
        $currentIdx = array_search($stage, $stages);
        if ($currentIdx === false) $currentIdx = 0;
        
        $progress = ($currentIdx / (count($stages) - 1)) * 100;
        $nextStage = $currentIdx < count($stages) - 1 ? $stages[$currentIdx + 1] : 'done';
        
        json_response([
            'success' => true,
            'stage' => $nextStage,
            'progress' => round($progress),
            'message' => $stageMessages[$stage] ?? 'Processing...',
            'is_complete' => $stage === 'finalize',
            'redirect_url' => $stage === 'finalize' ? (APPLICANT_URL . 'recommendations.php?applicant=' . $applicantId . '&show=1') : null,
            'recommendations' => $stage === 'finalize' ? $recommendations : null,
        ]);
        break;

    case 'get_recommendations':
        $recommendations = db()->fetchAll(
            "SELECT jr.*, jp.job_title, jp.description, jp.requirements 
             FROM job_recommendations jr 
             JOIN job_positions jp ON jr.job_position_id = jp.id 
             WHERE jr.applicant_id = ? 
             ORDER BY jr.match_score DESC",
            [$applicantId]
        );
        
        if (empty($recommendations)) {
            json_response(['success' => false, 'message' => 'No recommendations found. Please generate recommendations first.'], 404);
        }
        
        foreach ($recommendations as &$rec) {
            $rec['matching_skills'] = json_decode($rec['matching_skills'] ?? '[]', true);
            $rec['matching_experience'] = json_decode($rec['matching_experience'] ?? '[]', true);
            $rec['matching_education'] = json_decode($rec['matching_education'] ?? '[]', true);
            $rec['match_score'] = floatval($rec['match_score']);
        }
        
        json_response([
            'success' => true,
            'recommendations' => $recommendations,
        ]);
        break;

    case 'select_job':
        $jobPositionId = intval($_POST['job_position_id'] ?? 0);
        
        if ($jobPositionId <= 0) {
            json_response(['success' => false, 'message' => 'Please select a job position.'], 400);
        }
        
        portal_sync_job_postings();
        $job = db()->fetchOne("SELECT * FROM job_positions WHERE id = ? AND status = 'active'", [$jobPositionId]);
        if (!$job) {
            json_response(['success' => false, 'message' => 'Selected job position is not available.'], 404);
        }
        
        $recommendation = db()->fetchOne(
            "SELECT * FROM job_recommendations WHERE applicant_id = ? AND job_position_id = ?",
            [$applicantId, $jobPositionId]
        );
        
        $_SESSION['current_application']['selected_job'] = [
            'job_position_id' => $jobPositionId,
            'job_title' => $job['job_title'],
            'match_score' => $recommendation ? floatval($recommendation['match_score']) : 0,
            'matching_skills' => $recommendation ? json_decode($recommendation['matching_skills'], true) : [],
            'matching_experience' => $recommendation ? json_decode($recommendation['matching_experience'], true) : [],
            'matching_education' => $recommendation ? json_decode($recommendation['matching_education'], true) : [],
            'ai_reason' => $recommendation['ai_reason'] ?? '',
        ];
        
        json_response([
            'success' => true,
            'message' => 'Job selected successfully',
            'redirect_url' => APPLICANT_URL . 'review.php?applicant=' . $applicantId,
            'selected_job' => $_SESSION['current_application']['selected_job'],
        ]);
        break;

    default:
        json_response(['success' => false, 'message' => 'Invalid action'], 400);
}
