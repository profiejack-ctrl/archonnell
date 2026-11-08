<style>
    .audit-hero{display:flex;justify-content:space-between;align-items:flex-start;gap:20px;margin-bottom:18px}
    .audit-hero h2{margin:3px 0 6px;color:var(--text);font-size:25px}
    .audit-hero p{margin:0;color:var(--muted);font-size:13px}
    .audit-live{display:inline-flex;align-items:center;gap:8px;color:#16836c;background:rgba(22,163,126,.1);padding:9px 12px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap}
    .audit-live:before{content:'';width:7px;height:7px;border-radius:50%;background:#18a77f;box-shadow:0 0 0 4px rgba(24,167,127,.12)}
    .audit-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-bottom:18px}
    .audit-stat{padding:18px 20px;border:1px solid var(--border);background:var(--surface);border-radius:16px;box-shadow:var(--shadow)}
    .audit-stat span{display:block;color:var(--muted);font-size:12px;font-weight:600}.audit-stat strong{display:block;color:var(--text);font-size:25px;margin-top:7px}
    .audit-toolbar{display:flex;gap:10px;align-items:center;margin-bottom:16px;flex-wrap:wrap}
    .audit-toolbar input,.audit-toolbar select{border:1px solid var(--border);background:var(--surface);color:var(--text);border-radius:10px;padding:10px 12px;font:inherit;min-height:40px}
    .audit-toolbar input{flex:1;min-width:220px}.audit-toolbar button{border:0;border-radius:10px;background:var(--accent);color:white;padding:11px 16px;font-weight:700;cursor:pointer}
    .audit-count{margin-left:auto;color:var(--muted);font-size:12px}
    .audit-table{width:100%;border-collapse:collapse}.audit-table th{text-align:left;color:var(--muted);font-size:11px;text-transform:uppercase;letter-spacing:.06em;padding:12px 14px;border-bottom:1px solid var(--border)}
    .audit-table td{padding:14px;border-bottom:1px solid var(--border);color:var(--text);font-size:13px;vertical-align:top}.audit-table tr:last-child td{border-bottom:0}
    .audit-actor{display:flex;align-items:center;gap:10px;min-width:140px}.audit-avatar{display:grid;place-items:center;width:34px;height:34px;border-radius:11px;background:var(--accent-light);color:var(--accent);font-weight:800;font-size:12px}.audit-actor strong{display:block;font-size:13px}.audit-actor small,.audit-date small{display:block;color:var(--muted);font-size:11px;margin-top:3px}
    .audit-action{display:inline-block;padding:5px 9px;border-radius:7px;color:var(--accent);background:var(--accent-light);font-size:11px;font-weight:700;white-space:nowrap}.audit-module{font-weight:700}.audit-description{max-width:480px;line-height:1.5}.audit-date{white-space:nowrap}.audit-ip{font-family:monospace;color:var(--muted);font-size:12px;white-space:nowrap}.audit-empty{text-align:center;padding:45px 20px!important;color:var(--muted)!important}
    @media(max-width:850px){.audit-table{min-width:850px}.audit-table-wrap{overflow-x:auto}.audit-stats{grid-template-columns:1fr}.audit-hero{flex-direction:column}}
</style>

<div class="audit-hero">
    <div>
        <p class="eyebrow">Security &amp; accountability</p>
        <h2>Audit Logs</h2>
        <p>A clear record of important actions across your FleetOps workspace.</p>
    </div>
    <span class="audit-live">Activity tracking active</span>
</div>

<div class="audit-stats">
    <div class="audit-stat"><span>All recorded events</span><strong><?= number_format($dashboard['auditStats']['total']) ?></strong></div>
    <div class="audit-stat"><span>Events today</span><strong><?= number_format($dashboard['auditStats']['today']) ?></strong></div>
    <div class="audit-stat"><span>People active today</span><strong><?= number_format($dashboard['auditStats']['actors']) ?></strong></div>
</div>

<section class="panel">
    <div class="panel-header"><div><p class="eyebrow">Activity history</p><h3>Recent events</h3></div></div>
    <form method="GET" action="<?= route('audit-logs') ?>" class="audit-toolbar">
        <input type="search" name="search" value="<?= htmlspecialchars(request('search', ''), ENT_QUOTES, 'UTF-8') ?>" placeholder="Search people or activity" aria-label="Search audit logs">
        <select name="module" aria-label="Filter by area">
            <option value="">All areas</option>
            <?php foreach ($dashboard['auditModules'] as $module): ?>
                <option value="<?= htmlspecialchars($module, ENT_QUOTES, 'UTF-8') ?>" <?= request('module') === $module ? 'selected' : '' ?>><?= htmlspecialchars($module) ?></option>
            <?php endforeach; ?>
        </select>
        <button type="submit">Filter activity</button>
        <span class="audit-count">Latest 100 events</span>
    </form>
    <div class="audit-table-wrap">
        <table class="audit-table">
            <thead><tr><th>Person</th><th>Action</th><th>Area</th><th>Details</th><th>IP address</th><th>When</th></tr></thead>
            <tbody>
            <?php if (count($dashboard['auditLogs'])): foreach ($dashboard['auditLogs'] as $entry): ?>
                <tr>
                    <td><div class="audit-actor"><span class="audit-avatar"><?= htmlspecialchars(strtoupper(substr($entry['actor'], 0, 2))) ?></span><span><strong><?= htmlspecialchars($entry['actor']) ?></strong><small>Account activity</small></span></div></td>
                    <td><span class="audit-action"><?= htmlspecialchars($entry['action']) ?></span></td>
                    <td class="audit-module"><?= htmlspecialchars($entry['module']) ?></td>
                    <td class="audit-description"><?= htmlspecialchars($entry['description']) ?></td>
                    <td class="audit-ip"><?= htmlspecialchars($entry['ip'] ?? '—') ?></td>
                    <td class="audit-date" title="<?= htmlspecialchars($entry['created_at'] ?? '') ?>"><?= htmlspecialchars($entry['relative_time'] ?? '—') ?><small><?= htmlspecialchars($entry['created_at'] ?? '') ?></small></td>
                </tr>
            <?php endforeach; else: ?>
                <tr><td colspan="6" class="audit-empty">No activity matches this filter yet. Important system changes will appear here as they happen.</td></tr>
            <?php endif; ?>
            </tbody>
        </table>
    </div>
</section>
