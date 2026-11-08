<?php
$finance = $dashboard['finance'];
$cards = $finance['cards'];
$trend = $finance['trend'];
$breakdown = $finance['breakdown'];
?>

<style>
.dashboard-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; margin-bottom: 1.5rem; }
.dashboard-grid-wide { grid-template-columns: minmax(0,2fr) minmax(0,1fr); }
@media (max-width: 900px) { .dashboard-grid-wide { grid-template-columns: 1fr; } }
.card { background: white; border-radius: 8px; padding: 1.5rem; box-shadow: 0 1px 3px rgba(0,0,0,0.1); display: flex; flex-direction: column; }
.card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.card-title { font-size: 1.125rem; font-weight: 600; color: #111827; margin: 0; }
.stat-value { font-size: 2rem; font-weight: 700; color: #111827; margin: 0.5rem 0; }
.stat-desc { font-size: 0.875rem; color: #6b7280; }
.text-green { color: #10b981; }
.text-red { color: #ef4444; }
.chart-container { position: relative; height: 300px; width: 100%; flex-grow: 1; }
</style>

<section class="panel" style="background: transparent; border: none; padding: 0;">
    <div class="panel-header" style="margin-bottom: 1.5rem;">
        <div>
            <p class="eyebrow">Financial Overview</p>
            <h3>Cost Analytics</h3>
        </div>
        <div class="cost-page-actions">
            <button class="pill-button" type="button" onclick="openTripExpenseModal()">+ Trip expense</button>
            <?php if ($dashboard['isAdmin']): ?><button class="btn-secondary" type="button" onclick="openExpenseModal()">Log maintenance</button><?php endif; ?>
        </div>
    </div>

    <?php if (session('status')): ?>
        <div class="alert-banner status-approved" style="padding:10px 14px;border-radius:12px;margin-bottom:14px;font-weight:600;">
            <?= htmlspecialchars(session('status')) ?>
        </div>
    <?php endif; ?>
    <?php if ($errors->any()): ?>
        <div class="alert-banner" style="padding:10px 14px;border-radius:12px;margin-bottom:14px;font-weight:600;background:rgba(231,76,60,0.12);color:#e74c3c;">
            <?= htmlspecialchars($errors->first()) ?>
        </div>
    <?php endif; ?>

    <div class="dashboard-grid">
        <?php foreach ($cards as $card): ?>
            <div class="card">
                <h3 class="card-title"><?= htmlspecialchars($card['title']) ?></h3>
                <div class="stat-value">₱<?= number_format((float) $card['value'], 0) ?></div>
                <?php if (isset($card['change'])): ?>
                    <div class="stat-desc">
                        <span class="<?= (float) $card['change'] < 0 ? 'text-green' : 'text-red' ?>">
                            <?= (float) $card['change'] < 0 ? '↓' : '↑' ?> <?= abs((float) $card['change']) ?>%
                        </span>
                        <?= htmlspecialchars($card['meta']) ?>
                    </div>
                <?php else: ?>
                    <div class="stat-desc"><?= htmlspecialchars($card['meta']) ?></div>
                <?php endif; ?>
            </div>
        <?php endforeach; ?>
    </div>

    <div class="dashboard-grid dashboard-grid-wide">
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Monthly Expenses Trend</h3>
                <span style="font-size:0.8rem;color:var(--muted);">Last 6 months, live</span>
            </div>
            <div class="chart-container">
                <canvas id="expensesChart"></canvas>
            </div>
        </div>
        <div class="card">
            <div class="card-header">
                <h3 class="card-title">Cost Breakdown</h3>
                <span style="font-size:0.8rem;color:var(--muted);">This month</span>
            </div>
            <div class="chart-container">
                <canvas id="breakdownChart"></canvas>
            </div>
        </div>
    </div>
</section>

<section class="panel trip-expenses-panel">
    <div class="panel-header">
        <div><p class="eyebrow">Meals · Parking · Other</p><h3>Trip expenses &amp; receipts</h3><p class="trip-expense-intro">Record out-of-pocket travel costs with a receipt photo for proof. Fuel purchases stay in Fuel Monitor.</p></div>
        <span class="trip-expense-total">This month <strong>&#8369;<?= number_format((float) ($finance['totals']['trip_expenses_this_month'] ?? 0), 2) ?></strong></span>
    </div>
    <div class="table-wrapper">
        <table class="trip-expenses-table">
            <thead><tr><?php if ($dashboard['isAdmin']): ?><th>Submitted by</th><?php endif; ?><th>Date</th><th>Vehicle</th><th>Category</th><th>Description</th><th>Amount</th><th>Proof</th></tr></thead>
            <tbody>
                <?php foreach (($dashboard['tripExpenses'] ?? []) as $expense): ?>
                    <tr>
                        <?php if ($dashboard['isAdmin']): ?><td><?= htmlspecialchars($expense['submitted_by'], ENT_QUOTES, 'UTF-8') ?></td><?php endif; ?>
                        <td><?= htmlspecialchars($expense['date'] ?? '—', ENT_QUOTES, 'UTF-8') ?></td>
                        <td><?= htmlspecialchars($expense['vehicle'], ENT_QUOTES, 'UTF-8') ?></td>
                        <td><span class="expense-category-tag"><?= htmlspecialchars($expense['category'], ENT_QUOTES, 'UTF-8') ?></span></td>
                        <td><?= htmlspecialchars($expense['description'], ENT_QUOTES, 'UTF-8') ?></td>
                        <td><strong>&#8369;<?= number_format((float) $expense['amount'], 2) ?></strong></td>
                        <td><a class="expense-proof-link" href="<?= route('trip-expenses.receipt', $expense['id']) ?>" target="_blank" rel="noopener noreferrer">View receipt</a></td>
                    </tr>
                <?php endforeach; ?>
                <?php if (empty($dashboard['tripExpenses'])): ?><tr><td colspan="<?= $dashboard['isAdmin'] ? 7 : 6 ?>" class="trip-expense-empty">No meal or parking expenses saved yet. Add an expense and attach its receipt photo.</td></tr><?php endif; ?>
            </tbody>
        </table>
    </div>
</section>

<!-- Modal: Log Expense (Maintenance) -->
<?php if ($dashboard['isAdmin']): ?>
<div id="expense-modal" class="modal-backdrop" style="display:none;">
    <div class="modal-card">
        <div class="modal-header">
            <h3>Log Maintenance Expense</h3>
            <button class="close-btn" type="button" onclick="closeExpenseModal()">✕</button>
        </div>
        <form method="POST" action="<?= route('maintenance.store') ?>">
            <?= csrf_field() ?>
            <div class="form-group" style="margin-bottom:12px;">
                <label for="expense-vehicle">Vehicle</label>
                <select class="form-control" id="expense-vehicle" name="vehicle_id" required>
                    <?php foreach ($dashboard['vehicleOptions'] as $vehicle): ?>
                        <option value="<?= (int) $vehicle->id ?>"><?= htmlspecialchars($vehicle->name) ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="form-group" style="margin-bottom:12px;">
                <label for="expense-description">Description</label>
                <input class="form-control" type="text" id="expense-description" name="description" required maxlength="150" placeholder="e.g. Oil change & filter">
            </div>
            <div class="form-group" style="margin-bottom:12px;">
                <label for="expense-cost">Cost (₱)</label>
                <input class="form-control" type="number" id="expense-cost" name="cost" required min="0" step="0.01">
            </div>
            <div class="form-group" style="margin-bottom:16px;">
                <label for="expense-date">Date serviced</label>
                <input class="form-control" type="date" id="expense-date" name="serviced_at" required max="<?= now()->toDateString() ?>" value="<?= now()->toDateString() ?>">
            </div>
            <button type="submit" class="btn-primary" style="width:100%;">Save Expense</button>
        </form>
    </div>
</div>
<?php endif; ?>

<div id="trip-expense-modal" class="modal-backdrop" style="display:none;" role="dialog" aria-modal="true" aria-labelledby="trip-expense-title">
    <div class="modal-card trip-expense-modal-card">
        <div class="modal-header"><div><p class="eyebrow">Trip reimbursement record</p><h3 id="trip-expense-title">Add trip expense</h3></div><button class="close-btn" type="button" onclick="closeTripExpenseModal()" aria-label="Close">×</button></div>
        <p class="trip-expense-intro">Save meals, parking, or other trip costs. A receipt photo is required so the expense can be reviewed.</p>
        <form method="POST" action="<?= $dashboard['isAdmin'] ? route('trip-expenses.store') : route('users.trip-expenses.store') ?>" enctype="multipart/form-data">
            <?= csrf_field() ?>
            <div class="form-group" style="margin-bottom:12px;">
                <label for="trip-expense-category">Expense type</label>
                <select class="form-control" id="trip-expense-category" name="category" required><option value="Meals">Meals / food</option><option value="Parking">Parking</option><option value="Other">Other trip cost</option></select>
            </div>
            <div class="form-group" style="margin-bottom:12px;">
                <label for="trip-expense-vehicle">Vehicle</label>
                <select class="form-control" id="trip-expense-vehicle" name="vehicle_id" required>
                    <option value="">Choose a vehicle</option>
                    <?php foreach ($dashboard['vehicleOptions'] as $vehicle): ?><option value="<?= (int) $vehicle->id ?>"><?= htmlspecialchars($vehicle->plate_number.' · '.$vehicle->name, ENT_QUOTES, 'UTF-8') ?></option><?php endforeach; ?>
                </select>
            </div>
            <div class="form-group" style="margin-bottom:12px;"><label for="trip-expense-description">What was this for?</label><input class="form-control" id="trip-expense-description" name="description" maxlength="255" required placeholder="e.g. Driver meal during delivery"></div>
            <div class="trip-expense-fields">
                <div class="form-group" style="margin-bottom:12px;"><label for="trip-expense-amount">Amount (PHP)</label><input class="form-control" id="trip-expense-amount" name="amount" type="number" min="0.01" max="1000000" step="0.01" required placeholder="0.00"></div>
                <div class="form-group" style="margin-bottom:12px;"><label for="trip-expense-date">Expense date</label><input class="form-control" id="trip-expense-date" name="expense_date" type="date" max="<?= now()->toDateString() ?>" value="<?= now()->toDateString() ?>" required></div>
            </div>
            <div class="form-group" style="margin-bottom:14px;"><label for="trip-expense-receipt">Receipt photo (JPG, PNG, WebP; max 5 MB)</label><input class="form-control" id="trip-expense-receipt" name="receipt" type="file" accept="image/jpeg,image/png,image/webp" required><small class="settings-help">Receipt images are kept private and only visible to you and administrators.</small></div>
            <div class="fuel-form-actions"><button type="button" class="btn-secondary" onclick="closeTripExpenseModal()">Cancel</button><button type="submit" class="btn-primary">Save expense with proof</button></div>
        </form>
    </div>
</div>

<script>
function openTripExpenseModal() { document.getElementById('trip-expense-modal').style.display = 'flex'; }
function closeTripExpenseModal() { document.getElementById('trip-expense-modal').style.display = 'none'; }
function openExpenseModal() {
    document.getElementById('expense-modal').style.display = 'flex';
}
function closeExpenseModal() {
    document.getElementById('expense-modal').style.display = 'none';
}
</script>

<style>
.cost-page-actions { display:flex; align-items:center; flex-wrap:wrap; gap:10px; }
.trip-expenses-panel { margin-top:20px; }
.trip-expense-intro { margin:6px 0 0; color:var(--muted); font-size:.86rem; line-height:1.5; }
.trip-expense-total { display:flex; align-items:center; gap:8px; color:var(--muted); font-size:.82rem; white-space:nowrap; }
.trip-expense-total strong { color:var(--text); font-size:1rem; }
.trip-expenses-table { width:100%; border-collapse:collapse; }
.trip-expenses-table th { padding:12px; text-align:left; color:var(--muted); font-size:.72rem; text-transform:uppercase; border-bottom:1px solid var(--border); }
.trip-expenses-table td { padding:13px 12px; color:var(--text); font-size:.84rem; border-bottom:1px solid var(--border); }
.trip-expenses-table tr:last-child td { border-bottom:0; }
.expense-category-tag { display:inline-block; padding:5px 9px; border-radius:99px; color:var(--accent); background:var(--accent-light); font-size:.74rem; font-weight:700; }
.expense-proof-link { color:var(--accent); font-weight:700; text-decoration:none; white-space:nowrap; }
.expense-proof-link:hover { text-decoration:underline; }
.trip-expense-empty { color:var(--muted)!important; text-align:center; padding:30px!important; }
.trip-expense-modal-card { width:min(560px, calc(100vw - 32px)); max-height:88vh; overflow-y:auto; }
.trip-expense-fields { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
@media(max-width:720px) { .trip-expense-fields { grid-template-columns:1fr; gap:0; } .trip-expenses-panel .panel-header { align-items:flex-start; flex-direction:column; gap:10px; } }
</style>

<script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
<script>
document.addEventListener('DOMContentLoaded', function() {
    const trendLabels = <?= json_encode($trend['labels'] ?? []) ?>;
    const trendValues = <?= json_encode($trend['values'] ?? []) ?>;
    const breakdownLabels = <?= json_encode($breakdown['labels'] ?? []) ?>;
    const breakdownValues = <?= json_encode($breakdown['values'] ?? []) ?>;
    const breakdownColors = <?= json_encode($breakdown['colors'] ?? []) ?>;

    const ctxExpenses = document.getElementById('expensesChart');
    if (ctxExpenses) {
        const minTrend = trendValues.length ? Math.min(...trendValues) : 0;
        new Chart(ctxExpenses.getContext('2d'), {
            type: 'line',
            data: {
                labels: trendLabels,
                datasets: [{
                    label: 'Total Cost (₱)',
                    data: trendValues,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: false, suggestedMin: minTrend * 0.9 } }
            }
        });
    }

    const ctxBreakdown = document.getElementById('breakdownChart');
    if (ctxBreakdown) {
        new Chart(ctxBreakdown.getContext('2d'), {
            type: 'doughnut',
            data: {
                labels: breakdownLabels,
                datasets: [{
                    data: breakdownValues,
                    backgroundColor: breakdownColors,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '70%',
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
});
</script>
