<?php
declare(strict_types=1);

/** Public page moved to the React site: app/public.html#/screening (URL kept for links and bookmarks). */
require_once __DIR__ . '/../../includes/spa.php';

site_redirect('screening', ['applicant' => (int)($_GET['applicant'] ?? 0) ?: '']);
