<?php
/**
 * Bridge: push a submitted application from the public recruitment portal
 * (database: archon_nell_recruitment) into the main HRMS
 * (database: archon_nell) so it appears automatically in
 * Applicant Management -> Applicant Validation.
 *
 * Best-effort only: a failure here is logged and swallowed so it can never
 * break the applicant's submission.
 */

require_once __DIR__ . '/config.php';

define('HRMS_DB_NAME', env_get('DB_DATABASE', getenv('HRMS_DB_NAME') ?: 'archon_nell'));

function hrms_bridge_pdo(): ?PDO
{
    static $pdo = null;
    static $tried = false;
    if ($tried) {
        return $pdo;
    }
    $tried = true;
    try {
        $dsn = 'pgsql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . HRMS_DB_NAME;
        $pdo = new PDO($dsn, DB_USER, (string)DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]);
        $pdo->exec("SET TIME ZONE 'Asia/Manila'");
    } catch (Throwable $e) {
        error_log('HRMS bridge connect failed: ' . $e->getMessage());
        $pdo = null;
    }
    return $pdo;
}

/**
 * Upsert an applicant row into archon_nell.applicants.
 * Keyed on applicant_no (= portal applicant_number) so re-submissions or a
 * second application by the same applicant update the same HRMS record and
 * never create duplicates.  HR-controlled fields (stage / status) and the
 * applicant's name (fixed once submitted; the database refuses changes) are
 * left untouched on update.
 */
function hrms_bridge_sync_applicant(array $applicant, array $job, string $applicationNumber, $matchScore, ?array $resume): bool
{
    $pdo = hrms_bridge_pdo();
    if (!$pdo) {
        return false;
    }

    try {
        $first  = trim((string)($applicant['first_name'] ?? ''));
        $middle = trim((string)($applicant['middle_name'] ?? ''));
        $last   = trim((string)($applicant['last_name'] ?? ''));
        $full   = trim($first . ' ' . ($middle !== '' ? $middle . ' ' : '') . $last);
        if ($full === '') {
            $full = trim((string)($applicant['email'] ?? 'Applicant'));
        }

        // Personal details the employee record needs once this applicant is hired.
        $gender = trim((string)($applicant['gender'] ?? ''));
        $dob    = trim((string)($applicant['date_of_birth'] ?? ''));
        $addressParts = array_filter(array_map(
            static fn($p) => trim((string)$p),
            [$applicant['address'] ?? '', $applicant['city'] ?? '', $applicant['province'] ?? '']
        ), 'strlen');

        $resumePath = null;
        if ($resume && !empty($resume['file_path'])) {
            $resumePath = 'Homepage/' . ltrim(str_replace('\\', '/', (string)$resume['file_path']), '/');
        }

        $sql = "INSERT INTO applicants
                    (applicant_no, first_name, middle_name, last_name, email, mobile_number,
                     gender, date_of_birth, address,
                     resume_path, match_score, full_name, position, status, stage,
                     source, source_application_no, job_posting_id, applied_at, created_at)
                VALUES
                    (:no, :first, :middle, :last, :email, :mobile,
                     :gender, CAST(:dob AS DATE), :address,
                     :resume, :score, :full, :position, 'New', 'Validation',
                     'Portal', :app_no, (SELECT id FROM job_postings WHERE portal_job_position_id = :portal_job), NOW(), NOW())
                ON CONFLICT (applicant_no) DO UPDATE SET
                    email = EXCLUDED.email,
                    mobile_number = EXCLUDED.mobile_number,
                    gender = EXCLUDED.gender,
                    date_of_birth = EXCLUDED.date_of_birth,
                    address = EXCLUDED.address,
                    resume_path = EXCLUDED.resume_path,
                    match_score = EXCLUDED.match_score,
                    position = EXCLUDED.position,
                    source_application_no = EXCLUDED.source_application_no,
                    job_posting_id = EXCLUDED.job_posting_id";

        $stmt = $pdo->prepare($sql);
        $stmt->execute([
            'no'       => (string)($applicant['applicant_number'] ?? ''),
            'first'    => $first !== '' ? $first : null,
            'middle'   => $middle !== '' ? $middle : null,
            'last'     => $last !== '' ? $last : null,
            'email'    => (string)($applicant['email'] ?? '') ?: null,
            'mobile'   => (string)($applicant['mobile_number'] ?? '') ?: null,
            'gender'   => in_array($gender, ['Male', 'Female', 'Other', 'Prefer not to say'], true) ? $gender : null,
            'dob'      => preg_match('/^\d{4}-\d{2}-\d{2}/', $dob) ? substr($dob, 0, 10) : null,
            'address'  => $addressParts ? mb_substr(implode(', ', $addressParts), 0, 500) : null,
            'resume'   => $resumePath,
            'score'    => ($matchScore !== null && $matchScore !== '') ? (float)$matchScore : null,
            'full'     => $full,
            'position' => (string)($job['job_title'] ?? 'Unspecified'),
            'app_no'   => $applicationNumber,
            // The Job Posting behind the portal job applied for (Applicant -> Application -> Job Posting).
            'portal_job' => (int)($job['id'] ?? 0),
        ]);
        return true;
    } catch (Throwable $e) {
        error_log('HRMS bridge sync failed: ' . $e->getMessage());
        return false;
    }
}

/* =====================================================================
 * Job Postings (HRMS) as seen from the careers portal
 * ===================================================================== */

require_once dirname(__DIR__, 2) . '/config/job_postings.php';

/**
 * The HRMS connection, after bringing job posting availability up to date
 * (past-deadline postings closed, portal jobs active only while accepting).
 * Call before listing jobs or accepting an application. Null when the HRMS is
 * unreachable (the portal then keeps its current job statuses).
 */
function portal_sync_job_postings(): ?PDO
{
    $hr = hrms_bridge_pdo();
    if ($hr) {
        try {
            jp_sync_availability($hr, pdo());
        } catch (Throwable $e) {
            error_log('portal_sync_job_postings: ' . $e->getMessage());
        }
    }
    return $hr;
}

/**
 * Check the applicant's AI-screened resume against the requirements of the Job
 * Posting behind $portalJobId and store the result with the screening (HR
 * sees it in Applicant Management; it is never sent to the applicant).
 * Best-effort.
 */
function portal_store_job_evaluation(int $applicantId, int $portalJobId): void
{
    try {
        $hr = hrms_bridge_pdo();
        $posting = $hr ? jp_get_by_portal_id($hr, $portalJobId) : null;
        $screening = db()->fetchOne('SELECT * FROM resume_screenings WHERE applicant_id = ? ORDER BY id DESC LIMIT 1', [$applicantId]);
        if (!$posting || !$screening) {
            return;
        }
        $result = json_decode((string)($screening['screening_result'] ?? '{}'), true) ?: [];
        $list = static fn($key, $column) => $result[$key] ?? (json_decode((string)($screening[$column] ?? '[]'), true) ?: []);
        $experience = db()->fetchOne('SELECT skills FROM applicant_experience WHERE applicant_id = ? LIMIT 1', [$applicantId]);
        $profile = [
            'skills'          => $list('skills', 'extracted_skills'),
            'work_experience' => $list('work_experience', 'extracted_experience'),
            'education'       => $list('education', 'extracted_education'),
            'certifications'  => $list('certifications', 'extracted_certifications'),
            'summary'         => (string)($screening['ai_summary'] ?? ''),
            'form_skills'     => (string)($experience['skills'] ?? ''),
        ];
        $result['job_evaluation'] = jp_evaluate_profile($profile, $posting) + ['job_position_id' => $portalJobId];
        db()->update('resume_screenings', ['screening_result' => json_encode($result)], 'id = ?', [$screening['id']]);
    } catch (Throwable $e) {
        error_log('portal_store_job_evaluation: ' . $e->getMessage());
    }
}
