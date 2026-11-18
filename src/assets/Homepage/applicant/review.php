<?php
declare(strict_types=1);

/** Public page moved to the React site: app/public.html#/review (URL kept for links and bookmarks). */
require_once __DIR__ . '/../../includes/spa.php';

site_redirect('review', ['applicant' => (int)($_GET['applicant'] ?? 0) ?: '']);
