<?php
require_once __DIR__ . '/api/config.php';
require_once __DIR__ . '/api/db.php';

$pdo = pdo();
$errors = [];
$success = false;

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = $_POST['action'] ?? '';
    
    if ($action === 'install') {
        try {
            // PostgreSQL schema + default job positions. Each file is run whole
            // (not split on ";") because the schema contains trigger functions.
            $sqlFiles = [
                dirname(__DIR__) . '/database/schema/archon_nell_recruitment.pgsql.sql',
                dirname(__DIR__) . '/database/seeds/archon_nell_recruitment.seed.pgsql.sql',
            ];
            foreach ($sqlFiles as $sqlFile) {
                $sql = file_get_contents($sqlFile);
                if ($sql === false) {
                    throw new RuntimeException('Cannot read ' . basename($sqlFile));
                }
                $pdo->exec($sql);
            }

            $success = true;
            flash_message('success', 'Database tables created and sample data seeded successfully!');
        } catch (Exception $e) {
            $errors[] = 'Installation failed: ' . $e->getMessage();
        }
    }
}

$basePath = str_replace('\\', '/', dirname($_SERVER['PHP_SELF'], 1));
$baseUrl = 'http' . (isset($_SERVER['HTTPS']) && $_SERVER['HTTPS'] === 'on' ? 's' : '') . '://' . $_SERVER['HTTP_HOST'] . $basePath;
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Setup - Archon Nell Recruitment System</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: Arial, sans-serif;
            background: #eef8fd;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
        }
        .setup-box {
            background: white;
            border-radius: 8px;
            padding: 40px;
            max-width: 600px;
            width: 100%;
            box-shadow: 0 10px 40px rgba(0,0,0,0.1);
        }
        h1 {
            color: #0a3970;
            font-size: 28px;
            margin-bottom: 10px;
        }
        h2 {
            color: #0877bb;
            font-size: 18px;
            margin: 20px 0 10px;
        }
        .subtitle {
            color: #647484;
            margin-bottom: 30px;
            font-size: 14px;
        }
        .info-section {
            background: #f5f9fb;
            padding: 20px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 13px;
        }
        .info-section p { margin-bottom: 8px; color: #304f64; }
        .info-section strong { color: #0a3970; }
        .errors {
            background: #fdecea;
            color: #b71c1c;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 13px;
        }
        .success {
            background: #e8f5e9;
            color: #2e7d32;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 13px;
        }
        .btn {
            display: inline-block;
            padding: 14px 30px;
            background: #0877bb;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 14px;
            font-weight: bold;
            cursor: pointer;
            text-decoration: none;
            transition: 0.2s;
        }
        .btn:hover { background: #075d94; }
        .btn-green { background: #2e7d32; }
        .btn-green:hover { background: #1b5e20; }
        .btn-group { display: flex; gap: 12px; margin-top: 20px; flex-wrap: wrap; }
        .config-note {
            background: #fff8e1;
            padding: 15px;
            border-radius: 6px;
            margin-bottom: 20px;
            font-size: 12px;
            color: #795548;
            border-left: 4px solid #ffc107;
        }
        ul { margin-left: 20px; margin-top: 8px; color: #304f64; font-size: 13px; }
        li { margin-bottom: 5px; }
    </style>
</head>
<body>
    <div class="setup-box">
        <h1>Archon Nell Recruitment System</h1>
        <p class="subtitle">Setup and Installation Wizard</p>

        <?php if (!empty($errors)): ?>
            <div class="errors">
                <strong>Error(s):</strong><br>
                <?php foreach ($errors as $e): ?>
                    &bull; <?= htmlspecialchars($e) ?><br>
                <?php endforeach; ?>
            </div>
        <?php endif; ?>

        <?php if ($msg = flash_message('success')): ?>
            <div class="success">
                <strong>Success!</strong> <?= htmlspecialchars($msg) ?><br><br>
                <strong>Next Steps:</strong>
                <ul>
                    <li>Edit <code>api/config.php</code> to set your database credentials and AI API key</li>
                    <li>Configure the <code>.env</code> file (optional)</li>
                    <li>Visit the <a href="<?= htmlspecialchars($baseUrl) ?>/applicant/apply.php">Application Form</a> to start using the system</li>
                    <li>Update the Apply Now button links on your homepage if needed</li>
                </ul>
                <div class="btn-group">
                    <a href="<?= htmlspecialchars($baseUrl) ?>/applicant/apply.php" class="btn btn-green">Go to Application Form →</a>
                    <a href="<?= htmlspecialchars($baseUrl) ?>/index.php" class="btn">View Homepage</a>
                </div>
            </div>
        <?php endif; ?>

        <?php if (!$success): ?>
            <div class="config-note">
                <strong>Before installation:</strong><br>
                Edit the database credentials in <code>api/config.php</code> if needed:<br>
                <code>
                    DB_HOST = '<?= htmlspecialchars(DB_HOST) ?>'<br>
                    DB_NAME = '<?= htmlspecialchars(DB_NAME) ?>'<br>
                    DB_USER = '<?= htmlspecialchars(DB_USER) ?>'<br>
                    DB_PASS = '<?= str_repeat('*', strlen(DB_PASS)) ?>'
                </code>
            </div>

            <div class="info-section">
                <h2>Installation Details</h2>
                <p><strong>Database:</strong> <?= htmlspecialchars(DB_NAME) ?></p>
                <p><strong>Host:</strong> <?= htmlspecialchars(DB_HOST) ?></p>
                <p><strong>Tables to create:</strong></p>
                <ul>
                    <li>applicants - Applicant personal information</li>
                    <li>resumes - Uploaded resume files</li>
                    <li>job_positions - Available job vacancies (sample data included)</li>
                    <li>applications - Submitted applications</li>
                    <li>resume_screenings - AI screening results</li>
                    <li>job_recommendations - AI job recommendations</li>
                    <li>applicant_education - Education details</li>
                    <li>applicant_experience - Work experience details</li>
                    <li>rate_limit - Security rate limiting</li>
                </ul>
            </div>

            <form method="POST">
                <input type="hidden" name="action" value="install">
                <div class="btn-group">
                    <button type="submit" class="btn">Install Database & Seed Data</button>
                </div>
            </form>
        <?php endif; ?>
    </div>
</body>
</html>
