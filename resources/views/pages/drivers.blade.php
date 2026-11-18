<section class="panel">
    <div class="panel-header">
        <div>
            <p class="eyebrow">Drivers</p>
            <h3>Driver Performance</h3>
        </div>
        <?php if ($dashboard['isAdmin']): ?><button class="pill-button">Add Driver</button><?php endif; ?>
    </div>
    <div class="list-stack">
        <?php foreach ($dashboard['drivers'] as $driver): ?>
            <div class="list-item">
                <div class="avatar avatar-dark"><?= htmlspecialchars(strtoupper(substr($driver['name'] ?? 'DR', 0, 2))) ?></div>
                <div>
                    <h4><?= htmlspecialchars($driver['name']) ?></h4>
                    <p><?= htmlspecialchars($driver['role'] ?? 'Logistics Driver') ?> • <?= htmlspecialchars($driver['dispatches'] ?? '0 dispatches') ?></p>
                </div>
                <div class="status-pill status-approved"><?= htmlspecialchars($driver['score'] ?? '9.5') ?> / 10</div>
            </div>
        <?php endforeach; ?>
    </div>
</section>
