<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/text_extractor.php';

class AIService {
    private $apiKey;
    private $endpoint;
    private $model;

    public function __construct() {
        $this->apiKey = AI_API_KEY;
        $this->endpoint = AI_API_ENDPOINT;
        $this->model = AI_MODEL;
    }

    private function callAPI($prompt, $systemPrompt = '') {
        if (empty($this->apiKey)) {
            return $this->simulateAIResponse($prompt, $systemPrompt);
        }

        $messages = [];
        if (!empty($systemPrompt)) {
            $messages[] = ['role' => 'system', 'content' => $systemPrompt];
        }
        $messages[] = ['role' => 'user', 'content' => $prompt];

        $data = [
            'model' => $this->model,
            'messages' => $messages,
            'temperature' => 0.3,
            'max_tokens' => 2000,
            'response_format' => ['type' => 'json_object']
        ];

        $ch = curl_init($this->endpoint);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode($data),
            CURLOPT_HTTPHEADER => [
                'Content-Type: application/json',
                'Authorization: Bearer ' . $this->apiKey
            ],
            CURLOPT_TIMEOUT => 120,
            CURLOPT_SSL_VERIFYPEER => false
        ]);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);

        if ($httpCode !== 200 || $response === false) {
            return $this->simulateAIResponse($prompt, $systemPrompt);
        }

        $result = json_decode($response, true);
        if (isset($result['choices'][0]['message']['content'])) {
            return $this->parseAIResponse($result['choices'][0]['message']['content']);
        }

        return $this->simulateAIResponse($prompt, $systemPrompt);
    }

    private function parseAIResponse($content) {
        $decoded = json_decode($content, true);
        if ($decoded !== null) {
            return $decoded;
        }
        
        if (preg_match('/\{[\s\S]*\}/', $content, $matches)) {
            $decoded = json_decode($matches[0], true);
            if ($decoded !== null) {
                return $decoded;
            }
        }
        
        return null;
    }

    private function simulateAIResponse($prompt, $systemPrompt) {
        $isResumeScreening = strpos($systemPrompt, 'screening') !== false || strpos($prompt, 'resume') !== false;
        $isJobRecommendation = strpos($systemPrompt, 'recommend') !== false || strpos($prompt, 'recommend') !== false;
        
        if ($isJobRecommendation) {
            return $this->simulateJobRecommendation($prompt);
        }
        
        if ($isResumeScreening) {
            return $this->simulateResumeScreening($prompt);
        }
        
        return [
            'skills' => [],
            'work_experience' => [],
            'education' => [],
            'certifications' => [],
            'summary' => 'Analysis completed.',
            'recommendations' => []
        ];
    }

    private function simulateResumeScreening($prompt) {
        $formData = [];
        if (preg_match('/FORM DATA:\s*(\{[\s\S]*?\})/i', $prompt, $match)) {
            $formData = json_decode($match[1], true) ?: [];
        }
        
        $resumeText = '';
        if (preg_match('/RESUME TEXT:\s*([\s\S]*?)(?:FORM DATA:|$)/i', $prompt, $match)) {
            $resumeText = $match[1];
        }
        
        $allText = strtolower($resumeText . ' ' . json_encode($formData));
        
        $skills = [];
        $skillKeywords = [
            'Programming' => ['programming', 'coding', 'developer', 'software', 'php', 'javascript', 'python', 'java', 'c++', 'html', 'css', 'sql', 'mysql', 'web', 'ict', 'information technology', 'computer'],
            'Microsoft Office' => ['microsoft office', 'ms office', 'word', 'excel', 'powerpoint', 'outlook'],
            'Teaching' => ['teaching', 'teacher', 'education', 'classroom', 'instruction', 'lesson', 'student', 'pedagogy', 'let passer'],
            'Classroom Management' => ['classroom management', 'classroom', 'discipline', 'student management'],
            'Science' => ['science', 'biology', 'chemistry', 'physics', 'laboratory', 'lab work', 'research', 'scientific'],
            'Engineering' => ['engineering', 'engineer', 'civil', 'structural', 'construction', 'autocad', 'staad.pro', 'design'],
            'Project Management' => ['project management', 'project manager', 'planning', 'scheduling', 'budget', 'timeline'],
            'Chemical Formulation' => ['chemical', 'formulation', 'polymer', 'chemistry', 'r&d', 'laboratory', 'testing', 'material science'],
            'Quality Assurance' => ['quality', 'qa', 'qc', 'inspection', 'iso', 'audit', 'standards', 'quality control'],
            'Maintenance' => ['maintenance', 'repair', 'mechanical', 'electrical', 'technician', 'equipment', 'industrial', 'preventive'],
            'Communication Skills' => ['communication', 'interpersonal', 'oral', 'written', 'presentation'],
            'Leadership' => ['leadership', 'leader', 'manage', 'supervise', 'team', 'coordinate'],
            'Values Education' => ['values', 'christian', 'character', 'moral', 'ethics', 'religion', 'bible'],
            'Laboratory Analysis' => ['laboratory', 'lab', 'analysis', 'testing', 'experiment', 'research'],
            'Curriculum Development' => ['curriculum', 'syllabus', 'lesson plan', 'instructional materials']
        ];
        
        foreach ($skillKeywords as $skill => $keywords) {
            foreach ($keywords as $kw) {
                if (strpos($allText, strtolower($kw)) !== false) {
                    $skills[] = $skill;
                    break;
                }
            }
        }
        
        if (!empty($formData['skills'])) {
            $manualSkills = array_map('trim', explode(',', $formData['skills']));
            foreach ($manualSkills as $ms) {
                if (!empty($ms) && !in_array($ms, $skills)) {
                    $skills[] = ucwords(strtolower($ms));
                }
            }
        }
        if (empty($skills)) {
            $skills = ['Communication Skills', 'Microsoft Office', 'Problem Solving'];
        }
        
        $experiences = [];
        if (!empty($formData['years_experience'])) {
            $experiences[] = $formData['years_experience'] . ' years of work experience';
        }
        if (!empty($formData['current_position'])) {
            $experiences[] = 'Previous position: ' . $formData['current_position'];
        }
        if (!empty($formData['previous_company'])) {
            $experiences[] = 'Worked at: ' . $formData['previous_company'];
        }
        if (preg_match('/(\d+)\s*(?:year|yr|experience)/i', $allText, $match)) {
            $expText = $match[1] . ' years experience detected in resume';
            if (!in_array($expText, $experiences)) {
                $experiences[] = $expText;
            }
        }
        if (empty($experiences)) {
            $experiences = ['Entry-level candidate with foundational knowledge'];
        }
        
        $education = [];
        if (!empty($formData['course'])) {
            $education[] = $formData['course'];
        }
        if (!empty($formData['school'])) {
            $education[] = 'School: ' . $formData['school'];
        }
        if (!empty($formData['year_graduated'])) {
            $education[] = 'Graduated: ' . $formData['year_graduated'];
        }
        if (!empty($formData['highest_attainment'])) {
            array_unshift($education, $formData['highest_attainment']);
        }
        if (empty($education)) {
            $education = ['College graduate'];
        }
        
        $certifications = [];
        if (!empty($formData['certifications'])) {
            $certifications = array_map('trim', explode(',', $formData['certifications']));
            $certifications = array_filter($certifications);
        }
        if (preg_match('/(let|board|licensure|passer|eligible|certified|certificate)/i', $allText)) {
            $certifications[] = 'Professional License/Certification detected';
        }
        
        $fullName = trim(($formData['first_name'] ?? '') . ' ' . ($formData['middle_name'] ?? '') . ' ' . ($formData['last_name'] ?? ''));
        $summary = "Candidate {$fullName} has been screened. " . count($skills) . " key skills identified, " . 
                   (!empty($formData['years_experience']) ? $formData['years_experience'] . ' years of experience, ' : '') .
                   "with educational background in " . ($formData['course'] ?? 'relevant field') . ". " .
                   "Overall profile shows potential for technical and professional roles.";
        
        return [
            'skills' => array_values(array_unique(array_slice($skills, 0, 15))),
            'work_experience' => $experiences,
            'education' => $education,
            'certifications' => array_values(array_unique($certifications)),
            'summary' => $summary,
            'keywords_found' => $this->extractKeywords($allText)
        ];
    }

    private function simulateJobRecommendation($prompt) {
        $profile = [];
        $jobs = [];
        
        if (preg_match('/APPLICANT PROFILE:\s*(\{.*\})\s*JOB POSITIONS:/is', $prompt, $match)) {
            $profile = json_decode($match[1], true) ?: [];
        }

        if (preg_match('/JOB POSITIONS:\s*(\[.*\])/is', $prompt, $match)) {
            $jobs = json_decode($match[1], true) ?: [];
        }
        
        if (empty($jobs)) {
            return ['recommendations' => []];
        }
        
        $applicantSkills = array_map('strtolower', $profile['skills'] ?? []);
        $applicantExperience = strtolower(implode(' ', $profile['work_experience'] ?? []));
        $applicantEducation = strtolower(implode(' ', $profile['education'] ?? []));
        $applicantCerts = strtolower(implode(' ', $profile['certifications'] ?? []));
        $applicantSummary = strtolower($profile['summary'] ?? '');
        $allApplicant = $applicantExperience . ' ' . $applicantEducation . ' ' . $applicantCerts . ' ' . $applicantSummary . ' ' . implode(' ', $applicantSkills);
        
        $recommendations = [];
        
        foreach ($jobs as $job) {
            $jobId = $job['id'] ?? 0;
            $jobTitle = $job['job_title'] ?? 'Unknown Position';
            $reqSkills = $job['required_skills'] ?? [];
            $reqEducation = $job['required_education'] ?? [];
            $requirements = strtolower($job['requirements'] ?? '');
            $reqExperience = strtolower($job['required_experience'] ?? '');
            
            if (!is_array($reqSkills)) {
                $reqSkills = json_decode($reqSkills, true) ?: [];
            }
            if (!is_array($reqEducation)) {
                $reqEducation = json_decode($reqEducation, true) ?: [];
            }
            
            $reqSkillsLower = array_map('strtolower', $reqSkills);
            $reqEducationLower = array_map('strtolower', $reqEducation);
            
            $matchingSkills = [];
            $skillScore = 0;
            if (!empty($reqSkillsLower)) {
                foreach ($reqSkillsLower as $rSkill) {
                    foreach ($applicantSkills as $aSkill) {
                        similar_text($rSkill, $aSkill, $percent);
                        if ($percent > 60 || strpos($aSkill, $rSkill) !== false || strpos($rSkill, $aSkill) !== false) {
                            $matchingSkills[] = $reqSkills[array_search($rSkill, $reqSkillsLower)] ?? ucfirst($rSkill);
                            $skillScore += min(100, $percent);
                            break;
                        }
                    }
                }
                $skillMatchPercent = count($reqSkillsLower) > 0 ? min(100, ($skillScore / count($reqSkillsLower))) : 0;
            } else {
                $skillMatchPercent = 30;
            }
            
            $matchingEducation = [];
            $educationScore = 0;
            if (!empty($reqEducationLower)) {
                foreach ($reqEducationLower as $rEdu) {
                    if (strpos($applicantEducation, $rEdu) !== false || 
                        strpos($allApplicant, $rEdu) !== false ||
                        stripos($rEdu, 'bachelor') !== false && (strpos($applicantEducation, 'bachelor') !== false || strpos($applicantEducation, 'college') !== false || strpos($applicantEducation, 'graduate') !== false)) {
                        $matchingEducation[] = $reqEducation[array_search($rEdu, $reqEducationLower)] ?? ucfirst($rEdu);
                        $educationScore += 100;
                    }
                }
                $eduMatchPercent = count($reqEducationLower) > 0 ? min(100, ($educationScore / (count($reqEducationLower) * 100)) * 100) : 30;
            } else {
                $eduMatchPercent = 30;
            }
            
            $matchingExperience = [];
            $expScore = 0;
            
            if (preg_match('/(\d+(?:\.\d+)?)\s*(?:year|yr)/i', $reqExperience, $expMatch)) {
                $requiredYears = floatval($expMatch[1]);
                if (preg_match('/(\d+(?:\.\d+)?)\s*(?:year|yr)/i', $applicantExperience, $applicantExpMatch)) {
                    $applicantYears = floatval($applicantExpMatch[1]);
                    if ($applicantYears >= $requiredYears) {
                        $expScore = 100;
                        $matchingExperience[] = "Meets required experience ({$applicantYears} years >= {$requiredYears} years)";
                    } else {
                        $expScore = ($applicantYears / $requiredYears) * 60;
                        $matchingExperience[] = "Has {$applicantYears} years experience (requires {$requiredYears})";
                    }
                } else {
                    $expScore = 25;
                }
            } else {
                if (!empty($applicantExperience) && strpos($applicantExperience, 'entry') === false) {
                    $expScore = 70;
                    $matchingExperience[] = "Relevant work experience detected";
                } elseif (preg_match('/prefer/i', $reqExperience)) {
                    $expScore = 50;
                }
            }
            
            $jobTitleLower = strtolower($jobTitle);
            $jobTitleBonus = 0;
            foreach ($applicantSkills as $aSkill) {
                if (strpos($jobTitleLower, $aSkill) !== false || strpos($aSkill, $jobTitleLower) !== false) {
                    $jobTitleBonus = 10;
                    break;
                }
            }
            
            $overallScore = ($skillMatchPercent * 0.45) + ($eduMatchPercent * 0.30) + ($expScore * 0.20) + $jobTitleBonus;
            $overallScore = min(98, max(20, round($overallScore)));
            
            $reasons = [];
            if (!empty($matchingSkills)) {
                $reasons[] = count($matchingSkills) . " relevant skills detected: " . implode(', ', array_slice($matchingSkills, 0, 3));
            }
            if (!empty($matchingEducation)) {
                $reasons[] = "Relevant educational background: " . implode(', ', array_slice($matchingEducation, 0, 2));
            }
            if (!empty($matchingExperience)) {
                $reasons[] = implode(', ', $matchingExperience);
            }
            if (empty($reasons)) {
                $reasons[] = "Basic qualifications met";
            }
            
            $recommendations[] = [
                'job_id' => $jobId,
                'job_position_id' => $jobId,
                'job_title' => $jobTitle,
                'description' => $job['description'] ?? '',
                'match_score' => $overallScore,
                'matching_skills' => array_values(array_unique($matchingSkills)),
                'matching_experience' => $matchingExperience,
                'matching_education' => array_values(array_unique($matchingEducation)),
                'ai_reason' => implode("\n", $reasons),
                'reason' => implode("\n", $reasons)
            ];
        }
        
        usort($recommendations, function($a, $b) {
            return $b['match_score'] - $a['match_score'];
        });
        
        return [
            'recommendations' => $recommendations
        ];
    }

    private function extractKeywords($text) {
        $commonWords = ['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'day', 'get', 'has', 'him', 'his', 'how', 'man', 'new', 'now', 'old', 'see', 'two', 'way', 'who', 'boy', 'did', 'its', 'let', 'put', 'say', 'she', 'too', 'use', 'with', 'that', 'this', 'will', 'your', 'from', 'they', 'been', 'have', 'what', 'made', 'were', 'then', 'them', 'than', 'into', 'just', 'some', 'also', 'very', 'most', 'only', 'over', 'such', 'year', 'with', 'like', 'work', 'time', 'good'];
        $words = preg_split('/[^a-zA-Z0-9]+/', strtolower($text));
        $words = array_filter($words, function($w) use ($commonWords) {
            return strlen($w) > 3 && !in_array($w, $commonWords);
        });
        $counts = array_count_values($words);
        arsort($counts);
        return array_slice(array_keys($counts), 0, 20);
    }

    public function screenResume($resumeText, $formData = []) {
        $systemPrompt = "You are an expert HR AI resume screening system. Analyze the resume content and extract structured information. Return ONLY valid JSON with this format: {\"skills\": [], \"work_experience\": [], \"education\": [], \"certifications\": [], \"summary\": \"\"}. Be thorough and specific. Do NOT include any text outside the JSON.";
        
        $prompt = "Analyze this resume and form data:\n\n";
        if (!empty($resumeText)) {
            $prompt .= "RESUME TEXT:\n" . substr($resumeText, 0, 8000) . "\n\n";
        }
        if (!empty($formData)) {
            $prompt .= "FORM DATA:\n" . json_encode($formData) . "\n\n";
        }
        $prompt .= "Extract:\n1. Skills (technical and soft)\n2. Work experience details including positions and duration\n3. Educational background\n4. Certifications/licenses\n5. A brief professional summary";
        
        $result = $this->callAPI($prompt, $systemPrompt);
        
        if (!isset($result['skills'])) $result['skills'] = [];
        if (!isset($result['work_experience'])) $result['work_experience'] = [];
        if (!isset($result['education'])) $result['education'] = [];
        if (!isset($result['certifications'])) $result['certifications'] = [];
        if (!isset($result['summary'])) $result['summary'] = 'Resume screening completed.';
        
        return $result;
    }

    public function recommendJobs($applicantProfile, $availableJobs) {
        $systemPrompt = "You are an expert HR AI job matching system. Compare the applicant's profile against available jobs and calculate accurate match scores with explainable reasons. Return ONLY valid JSON with this format: {\"recommendations\": [{\"job_id\": 0, \"job_title\": \"\", \"match_score\": 0, \"matching_skills\": [], \"matching_experience\": [], \"matching_education\": [], \"reason\": \"\"}]}. match_score should be 0-100.";
        
        $prompt = "Based on the following applicant profile and available job positions, generate job recommendations with match scores:\n\n";
        $prompt .= "APPLICANT PROFILE:\n" . json_encode($applicantProfile) . "\n\n";
        $prompt .= "JOB POSITIONS:\n" . json_encode($availableJobs) . "\n\n";
        $prompt .= "For each job:\n- Calculate match_score 0-100 based on skills (45%), education (30%), and experience (20%)\n- List specific matching skills, experience, and education\n- Provide clear reasons why the job matches\n- Sort by match_score descending\n- Return ONLY valid JSON";
        
        $result = $this->callAPI($prompt, $systemPrompt);
        
        if (!isset($result['recommendations']) || !is_array($result['recommendations'])) {
            $result = $this->simulateAIResponse($prompt, $systemPrompt);
        }
        
        return $result;
    }
}
