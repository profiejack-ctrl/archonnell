<?php
declare(strict_types=1);

/** Public page moved to the React site: app/public.html#/recommendations (URL kept for links and bookmarks). */
require_once __DIR__ . '/../../includes/spa.php';

site_redirect('recommendations', ['applicant' => (int)($_GET['applicant'] ?? 0) ?: '', 'show' => (int)($_GET['show'] ?? 0) ?: '']);
