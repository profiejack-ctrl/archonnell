<?php
require_once __DIR__ . '/config.php';
require_once __DIR__ . '/db.php';

class Security {
    /** City/Municipality options of the application form (mirrored in frontend/src/utils/locations.ts). */
    const CITY_OPTIONS = [
        'Caloocan City', 'Las Piñas City', 'Makati City', 'Malabon City', 'Mandaluyong City',
        'Manila City', 'Marikina City', 'Muntinlupa City', 'Navotas City', 'Parañaque City',
        'Pasay City', 'Pasig City', 'Pateros', 'Quezon City', 'San Juan City', 'Taguig City',
        'Valenzuela City',
    ];

    /** Province options of the application form (mirrored in frontend/src/utils/locations.ts). */
    const PROVINCE_OPTIONS = [
        'Abra', 'Agusan del Norte', 'Agusan del Sur', 'Aklan', 'Albay', 'Antique', 'Apayao',
        'Aurora', 'Basilan', 'Bataan', 'Batanes', 'Batangas', 'Benguet', 'Biliran', 'Bohol',
        'Bukidnon', 'Bulacan', 'Cagayan', 'Camarines Norte', 'Camarines Sur', 'Camiguin', 'Capiz',
        'Catanduanes', 'Cavite', 'Cebu', 'Cotabato', 'Davao de Oro', 'Davao del Norte',
        'Davao del Sur', 'Davao Occidental', 'Davao Oriental', 'Dinagat Islands', 'Eastern Samar',
        'Guimaras', 'Ifugao', 'Ilocos Norte', 'Ilocos Sur', 'Iloilo', 'Isabela', 'Kalinga',
        'La Union', 'Laguna', 'Lanao del Norte', 'Lanao del Sur', 'Leyte', 'Maguindanao del Norte',
        'Maguindanao del Sur', 'Marinduque', 'Masbate', 'Metro Manila', 'Misamis Occidental',
        'Misamis Oriental', 'Mountain Province', 'Negros Occidental', 'Negros Oriental',
        'Northern Samar', 'Nueva Ecija', 'Nueva Vizcaya', 'Occidental Mindoro', 'Oriental Mindoro',
        'Palawan', 'Pampanga', 'Pangasinan', 'Quezon', 'Quirino', 'Rizal', 'Romblon', 'Samar',
        'Sarangani', 'Siquijor', 'Sorsogon', 'South Cotabato', 'Southern Leyte', 'Sultan Kudarat',
        'Sulu', 'Surigao del Norte', 'Surigao del Sur', 'Tarlac', 'Tawi-Tawi', 'Zambales',
        'Zamboanga del Norte', 'Zamboanga del Sur', 'Zamboanga Sibugay',
    ];

    public static function sanitizeInput($input) {
        if (is_array($input)) {
            return array_map([self::class, 'sanitizeInput'], $input);
        }
        // Stored as plain text: every screen escapes on output (React, e-mail
        // templates), so HTML-encoding here would show "Bachelor&#039;s Degree"
        // and copy "O&#039;Brien" into the employee record. Only control
        // characters (other than tab / line breaks) are removed.
        $input = trim((string)($input ?? ''));
        return preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $input) ?? '';
    }

    public static function validateEmail($email) {
        return filter_var($email, FILTER_VALIDATE_EMAIL) !== false;
    }

    public static function validatePhone($phone) {
        return preg_match('/^[+]?[\d\s\-()]{7,20}$/', $phone) === 1;
    }

    public static function validateRequired($value) {
        return !empty(trim($value ?? ''));
    }

    public static function validateDate($date, $format = 'Y-m-d') {
        $d = DateTime::createFromFormat($format, $date);
        return $d && $d->format($format) === $date;
    }

    public static function validateStringLength($str, $min = 1, $max = 255) {
        $len = strlen(trim($str ?? ''));
        return $len >= $min && $len <= $max;
    }

    public static function validateResumeFile($file) {
        $errors = [];

        if (!isset($file) || $file['error'] !== UPLOAD_ERR_OK) {
            switch ($file['error'] ?? UPLOAD_ERR_NO_FILE) {
                case UPLOAD_ERR_INI_SIZE:
                case UPLOAD_ERR_FORM_SIZE:
                    $errors[] = "File is too large. Maximum size is " . (MAX_RESUME_SIZE / 1024 / 1024) . "MB.";
                    break;
                case UPLOAD_ERR_PARTIAL:
                    $errors[] = "File upload was interrupted. Please try again.";
                    break;
                case UPLOAD_ERR_NO_FILE:
                    $errors[] = "Please upload a resume file.";
                    break;
                default:
                    $errors[] = "File upload failed. Please try again.";
            }
            return $errors;
        }

        if ($file['size'] > MAX_RESUME_SIZE) {
            $errors[] = "File is too large. Maximum size is " . (MAX_RESUME_SIZE / 1024 / 1024) . "MB.";
        }

        $finfo = new finfo(FILEINFO_MIME_TYPE);
        $detectedMime = $finfo->file($file['tmp_name']);

        // finfo's MIME sniffing can occasionally misidentify a perfectly valid
        // PDF/DOC/DOCX (magic-database differences are common across OSes and
        // export tools). Fall back to checking the file's actual binary
        // signature before rejecting - this still verifies the real file
        // content (not just its name/extension), it just isn't dependent on
        // a single fallible heuristic.
        if (!in_array($detectedMime, ALLOWED_RESUME_TYPES, true) && !self::hasKnownDocumentSignature($file['tmp_name'])) {
            $errors[] = "Invalid file type. Only PDF, DOC, and DOCX files are allowed.";
        }

        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!in_array($ext, ALLOWED_RESUME_EXTENSIONS)) {
            $errors[] = "Invalid file extension. Only .pdf, .doc, and .docx files are allowed.";
        }

        $filename = basename($file['name']);
        if (preg_match('/[\x00-\x1F\x80-\xFF]/', $filename)) {
            $errors[] = "Invalid filename contains forbidden characters.";
        }

        $php_check = @file_get_contents($file['tmp_name'], false, null, 0, 512);
        if ($php_check !== false) {
            if (preg_match('/<\?php|<\?=|<script\s+language\s*=\s*["\']php["\']/i', $php_check)) {
                $errors[] = "File contains potentially malicious content.";
            }
        }

        return $errors;
    }

    /** True if the file's first bytes match a genuine PDF, DOCX (zip) or legacy DOC (OLE) header. */
    private static function hasKnownDocumentSignature($tmpName) {
        $header = @file_get_contents($tmpName, false, null, 0, 8);
        if ($header === false || $header === '') {
            return false;
        }
        if (strncmp($header, '%PDF-', 5) === 0) {
            return true; // PDF
        }
        if (strncmp($header, "PK\x03\x04", 4) === 0) {
            return true; // DOCX (zip container)
        }
        if (strncmp($header, "\xD0\xCF\x11\xE0\xA1\xB1\x1A\xE1", 8) === 0) {
            return true; // legacy DOC (OLE compound file)
        }
        return false;
    }

    public static function sanitizeFileName($filename) {
        $filename = basename($filename);
        $filename = preg_replace('/[^a-zA-Z0-9._-]/', '_', $filename);
        return $filename;
    }

    public static function preventXSS($data) {
        if (is_array($data)) {
            return array_map([self::class, 'preventXSS'], $data);
        }
        return htmlspecialchars($data ?? '', ENT_QUOTES | ENT_HTML5, 'UTF-8');
    }

    public static function checkRateLimit($key, $maxRequests = 10, $window = 60) {
        try {
            $pdo = pdo();

            $cleanup = $pdo->prepare("DELETE FROM rate_limit WHERE expires < NOW()");
            $cleanup->execute();

            $stmt = $pdo->prepare("SELECT request_count FROM rate_limit WHERE identifier = ? AND expires > NOW()");
            $stmt->execute([$key]);
            $count = $stmt->fetchColumn();

            if ($count === false) {
                $insert = $pdo->prepare("INSERT INTO rate_limit (identifier, request_count, expires) VALUES (?, 1, NOW() + CAST(? AS INTEGER) * INTERVAL '1 second')");
                $insert->execute([$key, $window]);
                return true;
            }

            if ($count >= $maxRequests) {
                return false;
            }

            $update = $pdo->prepare("UPDATE rate_limit SET request_count = request_count + 1 WHERE identifier = ? AND expires > NOW()");
            $update->execute([$key]);
            return true;
        } catch (\Throwable $e) {
            error_log('checkRateLimit failed: ' . $e->getMessage());
            return true;
        }
    }

    public static function validateApplicantData($data) {
        $errors = [];

        $requiredFields = [
            'first_name' => 'First Name',
            'last_name' => 'Last Name',
            'date_of_birth' => 'Date of Birth',
            'gender' => 'Gender',
            'email' => 'Email Address',
            'mobile_number' => 'Mobile Number',
            'address' => 'Address',
            'city' => 'City/Municipality',
            'province' => 'Province',
            'highest_attainment' => 'Highest Educational Attainment',
            'school' => 'School/University',
            'course' => 'Course/Degree',
            'year_graduated' => 'Year Graduated',
            'years_experience' => 'Years of Work Experience',
            'current_position' => 'Current/Previous Position',
            'previous_company' => 'Previous Company/Employer',
            'skills' => 'Skills',
            'professional_summary' => 'Professional Summary',
        ];

        foreach ($requiredFields as $field => $label) {
            if (!self::validateRequired($data[$field] ?? '')) {
                $errors[] = "{$label} is required.";
            }
        }

        if (!empty($data['email']) && !self::validateEmail($data['email'])) {
            $errors[] = "Please enter a valid email address.";
        }

        if (!empty($data['mobile_number']) && !self::validatePhone($data['mobile_number'])) {
            $errors[] = "Please enter a valid mobile number.";
        }

        // Dropdown fields: only the listed options may be saved.
        if (self::validateRequired($data['city'] ?? '') && !in_array(self::sanitizeInput($data['city']), self::CITY_OPTIONS, true)) {
            $errors[] = "Please select a valid City/Municipality.";
        }

        if (self::validateRequired($data['province'] ?? '') && !in_array(self::sanitizeInput($data['province']), self::PROVINCE_OPTIONS, true)) {
            $errors[] = "Please select a valid Province.";
        }

        if (!empty($data['date_of_birth']) && !self::validateDate($data['date_of_birth'])) {
            $errors[] = "Please enter a valid date of birth.";
        } elseif (!empty($data['date_of_birth'])
            && $data['date_of_birth'] > (new DateTimeImmutable('now', new DateTimeZone('Asia/Manila')))->format('Y-m-d')) {
            // Today is the latest date of birth accepted (Manila wall-clock date).
            $errors[] = "Date of birth cannot be in the future.";
        }

        return $errors;
    }
}
