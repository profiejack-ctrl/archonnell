<?php
$maintenanceIssuesByVehicle = [];
foreach (($dashboard['vehicles'] ?? []) as $fleetVehicle) {
    $maintenanceIssuesByVehicle[$fleetVehicle->id] = $fleetVehicle->maintenanceIssues->map(fn ($issue) => [
        'id' => $issue->id,
        'details' => $issue->details,
        'status' => $issue->status,
        'photo' => $issue->photo_path ? route('maintenance-issues.photo', $issue->id) : null,
        'reported_by' => $issue->reporter?->name ?? 'Former account',
        'created_at' => $issue->created_at?->format('M d, Y h:i A'),
    ])->values()->all();
}
?>
<div class="fleet-command-wrapper">
    <?php if (session('success')): ?><div style="padding:12px 16px;border:1px solid #86efac;border-radius:10px;background:#f0fdf4;color:#166534;">✓ <?= htmlspecialchars(session('success'), ENT_QUOTES, 'UTF-8') ?></div><?php endif; ?>
    <?php if ($errors->any()): ?><div style="padding:12px 16px;border:1px solid #fca5a5;border-radius:10px;background:#fef2f2;color:#991b1b;"><?= htmlspecialchars($errors->first(), ENT_QUOTES, 'UTF-8') ?></div><?php endif; ?>
    <!-- Fleet Command Top Bar Header -->
    <div class="fleet-command-header">
        <div>
            <h1 class="fleet-title">Fleet Command</h1>
            <p class="fleet-subtitle">Vehicle inventory, maintenance logs, and live location map</p>
        </div>
        <div class="fleet-header-actions">
            <button class="btn-export" onclick="exportFleetCSV()">
                <span class="btn-icon">📊</span> Export Fleet
            </button>
            <?php if ($dashboard['isAdmin']): ?><button class="btn-add-vehicle" onclick="openAddVehicleModal()">
                <span class="btn-icon">+</span> Add New Vehicle
            </button><?php endif; ?>
        </div>
    </div>

    <!-- Status Filters Capsule Bar -->
    <div class="status-filters-bar">
        <button class="status-filter-btn active" onclick="filterByStatus('all', this)">All Status</button>
        <button class="status-filter-btn" onclick="filterByStatus('available', this)">AVAILABLE</button>
        <button class="status-filter-btn" onclick="filterByStatus('in transit', this)">IN TRANSIT</button>
        <button class="status-filter-btn" onclick="filterByStatus('reserved', this)">RESERVED</button>
        <button class="status-filter-btn" onclick="filterByStatus('maintenance', this)">MAINTENANCE</button>
        <button class="status-filter-btn" onclick="filterByStatus('inactive', this)">INACTIVE</button>
    </div>

    <!-- Fleet Inventory Table Card -->
    <div class="fleet-table-card">
        <div class="table-responsive">
            <table class="fleet-table" id="fleet-inventory-table">
                <thead>
                    <tr>
                        <th>VEHICLE ID</th>
                        <th>PLATE NO.</th>
                        <th>TYPE</th>
                        <th>BRAND & MODEL</th>
                        <th>STATUS</th>
                        <th class="text-right"><?= $dashboard['isAdmin'] ? 'ACTIONS' : 'VIEW' ?></th>
                    </tr>
                </thead>
                <tbody id="vehicle-table-body">
                    <?php foreach (($dashboard['vehicles'] ?? []) as $vehicle): ?>
                        <tr data-status="<?= in_array(strtolower($vehicle->status), ['active', 'available'], true) ? 'available' : strtolower(htmlspecialchars($vehicle->status, ENT_QUOTES, 'UTF-8')) ?>">
                            <td><strong class="vehicle-id-text"><?= htmlspecialchars($vehicle->vehicle_code, ENT_QUOTES, 'UTF-8') ?></strong></td>
                            <td><span class="plate-no-link"><?= htmlspecialchars($vehicle->plate_number, ENT_QUOTES, 'UTF-8') ?></span></td>
                            <td><?= htmlspecialchars($vehicle->type ?? '—', ENT_QUOTES, 'UTF-8') ?></td>
                            <td><?= htmlspecialchars($vehicle->name ?? '—', ENT_QUOTES, 'UTF-8') ?></td>
                            <td><span class="status-pill-badge"><?= htmlspecialchars($vehicle->status, ENT_QUOTES, 'UTF-8') ?></span></td>
                            <td class="text-right">
                                <button type="button" class="action-btn view-link" onclick="viewVehicleDetails(this)" data-code="<?= htmlspecialchars($vehicle->vehicle_code, ENT_QUOTES, 'UTF-8') ?>" data-plate="<?= htmlspecialchars($vehicle->plate_number, ENT_QUOTES, 'UTF-8') ?>" data-type="<?= htmlspecialchars($vehicle->type ?? '', ENT_QUOTES, 'UTF-8') ?>" data-name="<?= htmlspecialchars($vehicle->name ?? '', ENT_QUOTES, 'UTF-8') ?>" data-odometer="<?= (int) ($vehicle->odometer ?? 0) ?>" data-status="<?= htmlspecialchars($vehicle->status, ENT_QUOTES, 'UTF-8') ?>">View</button>
                                <button type="button" class="action-btn" onclick="openMaintenanceModal(<?= (int) $vehicle->id ?>, <?= htmlspecialchars(json_encode($vehicle->vehicle_code.' · '.$vehicle->plate_number), ENT_QUOTES, 'UTF-8') ?>)">Maintenance<?= $vehicle->maintenanceIssues->where('status', '!=', 'Resolved')->count() ? ' ('.$vehicle->maintenanceIssues->where('status', '!=', 'Resolved')->count().')' : '' ?></button>
                                <?php if ($dashboard['isAdmin']): ?><button type="button" class="action-btn edit-link" onclick="editVehicle(this)" data-id="<?= (int) $vehicle->id ?>" data-code="<?= htmlspecialchars($vehicle->vehicle_code, ENT_QUOTES, 'UTF-8') ?>" data-plate="<?= htmlspecialchars($vehicle->plate_number, ENT_QUOTES, 'UTF-8') ?>" data-type="<?= htmlspecialchars($vehicle->type ?? '', ENT_QUOTES, 'UTF-8') ?>" data-name="<?= htmlspecialchars($vehicle->name ?? '', ENT_QUOTES, 'UTF-8') ?>" data-odometer="<?= (int) ($vehicle->odometer ?? 0) ?>" data-status="<?= htmlspecialchars($vehicle->status, ENT_QUOTES, 'UTF-8') ?>">Edit</button><?php endif; ?>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                    <?php if (count($dashboard['vehicles'] ?? []) === 0): ?><tr><td colspan="6">No vehicles are recorded yet.</td></tr><?php endif; ?>
                </tbody>
            </table>
        </div>
    </div>
</div>

<!-- Modal: Add New Vehicle -->
<?php if ($dashboard['isAdmin']): ?>
<div id="add-vehicle-modal" class="modal-backdrop" style="display: none;">
    <div class="modal-card">
        <div class="modal-header">
            <h3>+ Add New Vehicle</h3>
            <button class="close-btn" onclick="closeAddVehicleModal()">✕</button>
        </div>
        <form id="vehicle-form" method="POST" action="<?= route('vehicles.store') ?>">
            <?= csrf_field() ?>
            <input type="hidden" id="vehicle-method" name="_method" value="">
            <div class="form-grid">
                <div class="form-group">
                    <label>Vehicle ID</label>
                    <input type="text" id="add-vhc-id" name="vehicle_code" class="form-control" value="<?= htmlspecialchars($dashboard['nextVehicleCode'] ?? '', ENT_QUOTES, 'UTF-8') ?>" readonly maxlength="50" />
                    <small class="settings-help">Auto-generated from the existing fleet sequence.</small>
                </div>
                <div class="form-group">
                    <label>Plate No.</label>
                    <input type="text" id="add-plate" name="plate_number" class="form-control" placeholder="e.g. XYZ-9988" required maxlength="30" />
                </div>
                <div class="form-group">
                    <label>Vehicle Type</label>
                    <select id="add-type" name="type" class="form-control" required>
                        <option value="Truck">Truck</option>
                        <option value="Van">Van</option>
                        <option value="Motorcycle">Motorcycle</option>
                        <option value="Sedan">Sedan</option>
                        <option value="Pickup">Pickup</option>
                    </select>
                </div>
                <div class="form-group">
                    <label>Brand & Model (Year)</label>
                    <input type="text" id="add-brand" name="name" class="form-control" placeholder="e.g. Isuzu Elf (2023)" required maxlength="150" />
                </div>
                <div class="form-group"><label>Odometer</label><div class="form-control" style="color:var(--muted);">Calculated from completed tracked trips (km)</div></div>
                <div class="form-group full-width">
                    <label>Initial Status</label>
                    <select id="add-status" name="status" class="form-control" required>
                        <option value="Active">Available</option>
                        <option value="Available">Available</option>
                        <option value="In Transit">In Transit</option>
                        <option value="Reserved">Reserved</option>
                        <option value="Maintenance">Maintenance</option>
                        <option value="Inactive">Inactive</option>
                    </select>
                </div>
            </div>
            <div class="modal-footer margin-top-md">
                <button type="button" class="btn-secondary" onclick="closeAddVehicleModal()">Cancel</button>
                <button type="submit" class="btn-primary">Save Vehicle</button>
            </div>
        </form>
    </div>
</div>
<?php endif; ?>

<div id="maintenance-modal" class="modal-backdrop" style="display:none;">
    <div class="modal-card maintenance-modal-card">
        <div class="modal-header">
            <div><p class="eyebrow">Fleet condition</p><h3 id="maintenance-modal-title">Maintenance history</h3></div>
            <button class="close-btn" type="button" onclick="closeMaintenanceModal()">×</button>
        </div>
        <div id="maintenance-issue-list" class="maintenance-issue-list"></div>
        <?php if ($dashboard['isAdmin']): ?>
        <form id="maintenance-issue-form" method="POST" enctype="multipart/form-data" action="">
            <?= csrf_field() ?>
            <h4>Report damage or a repair need</h4>
            <label for="maintenance-details">Damage and symptoms</label>
            <textarea id="maintenance-details" name="details" class="form-control" rows="3" maxlength="5000" required placeholder="Describe the damage, warning light, or repair needed"></textarea>
            <label for="maintenance-photo">Photo (optional)</label>
            <input id="maintenance-photo" type="file" name="photo" class="form-control" accept="image/jpeg,image/png,image/webp">
            <small class="settings-help">JPG, PNG, or WebP, up to 5 MB. Images are only available to signed-in staff.</small>
            <button type="submit" class="btn-primary" style="margin-top:14px;">Save maintenance report</button>
        </form>
        <?php endif; ?>
    </div>
</div>

<!-- Modal: View Vehicle Details -->
<div id="view-vehicle-modal" class="modal-backdrop" style="display: none;">
    <div class="modal-card">
        <div class="modal-header">
            <h3>Vehicle Details Specifications</h3>
            <button class="close-btn" onclick="closeViewModal()">✕</button>
        </div>
        <div class="modal-body">
            <div class="details-summary-header">
                <div>
                    <span class="badge-code-lg" id="view-modal-id"></span>
                    <h2 id="view-modal-brand" class="margin-top-xs"></h2>
                    <p class="plate-text-lg" id="view-modal-plate"></p>
                </div>
                <div id="view-modal-status-badge">
                    <span class="status-pill-badge"></span>
                </div>
            </div>
            <hr class="divider" />
            <div class="details-grid">
                <div class="details-item">
                    <span class="details-label">Type</span>
                    <strong id="view-modal-type"></strong>
                </div>
                <div class="details-item">
                    <span class="details-label">Odometer</span>
                    <strong id="view-modal-odometer"></strong>
                </div>
                <div class="details-item">
                    <span class="details-label">Next Service Due</span>
                    <strong>Not set</strong>
                </div>
            </div>
        </div>
        <div class="modal-footer margin-top-md">
            <button class="btn-secondary" onclick="closeViewModal()">Close</button>
        </div>
    </div>
</div>

<!-- CSS Styling for Fleet Command Vehicles View -->
<style>
.fleet-command-wrapper {
    display: flex;
    flex-direction: column;
    gap: 20px;
}

/* Header Top Bar */
.fleet-command-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: 16px;
}
.fleet-title {
    margin: 0;
    font-size: 1.8rem;
    font-weight: 800;
    color: #11253f;
    letter-spacing: -0.02em;
}
.fleet-subtitle {
    margin: 4px 0 0;
    color: #6c7a93;
    font-size: 0.92rem;
    font-weight: 500;
}
.fleet-header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
}
.btn-export {
    border: 1px solid #e7ebf3;
    background: #ffffff;
    color: #11253f;
    padding: 10px 18px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 0.88rem;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(20, 33, 61, 0.05);
    transition: transform 0.15s ease, background 0.15s ease;
}
.btn-export:hover {
    background: #f8fafc;
    transform: translateY(-1px);
}
.btn-add-vehicle {
    border: 0;
    background: #2563eb;
    color: #ffffff;
    padding: 10px 20px;
    border-radius: 999px;
    font-weight: 700;
    font-size: 0.88rem;
    cursor: pointer;
    box-shadow: 0 6px 16px rgba(37, 99, 235, 0.3);
    transition: transform 0.15s ease, background 0.15s ease;
}
.btn-add-vehicle:hover {
    background: #1d4ed8;
    transform: translateY(-1px);
}
.btn-icon {
    margin-right: 6px;
}

/* Status Filter Bar */
.status-filters-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    overflow-x: auto;
    padding-bottom: 4px;
}
.status-filter-btn {
    border: 0;
    background: #f1f5f9;
    color: #64748b;
    padding: 8px 18px;
    border-radius: 999px;
    font-size: 0.82rem;
    font-weight: 800;
    letter-spacing: 0.04em;
    cursor: pointer;
    transition: all 0.2s ease;
    white-space: nowrap;
}
.status-filter-btn:hover {
    background: #e2e8f0;
    color: #334155;
}
.status-filter-btn.active {
    background: #2563eb;
    color: #ffffff;
    box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
}

/* Fleet Inventory Table Card */
.fleet-table-card {
    background: #ffffff;
    border-radius: 20px;
    box-shadow: 0 18px 35px rgba(20, 33, 61, 0.06);
    border: 1px solid #e7ebf3;
    overflow: hidden;
}
.table-responsive {
    width: 100%;
    overflow-x: auto;
}
.fleet-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.85rem;
    text-align: left;
}
.fleet-table th {
    padding: 14px 16px;
    color: #64748b;
    font-weight: 800;
    font-size: 0.74rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border-bottom: 1px solid #e2e8f0;
    background: #fafbfc;
    white-space: nowrap;
}
.fleet-table td {
    padding: 14px 16px;
    border-bottom: 1px solid #f1f5f9;
    color: #334155;
    font-weight: 500;
    vertical-align: middle;
    white-space: nowrap;
}
.fleet-table tbody tr {
    transition: background 0.15s ease;
}
.fleet-table tbody tr:hover {
    background: #f8fafc;
}
.vehicle-id-text {
    font-weight: 800;
    color: #0f172a;
    font-size: 0.86rem;
    white-space: nowrap;
}
.plate-no-link {
    color: #2563eb;
    font-weight: 700;
    font-family: 'Inter', monospace;
    font-size: 0.86rem;
    white-space: nowrap;
}

/* Custom Status Pills matching Screenshot */
.status-pill-badge {
    display: inline-block;
    padding: 6px 14px;
    border-radius: 999px;
    font-size: 0.78rem;
    font-weight: 800;
    text-align: center;
}
.badge-available {
    background: #dcfce7;
    color: #166534;
}
.badge-in-transit {
    background: #f3e8ff;
    color: #7e22ce;
}
.badge-reserved {
    background: #dbeafe;
    color: #1e40af;
}
.badge-maintenance {
    background: #ffedd5;
    color: #c2410c;
}
.badge-inactive {
    background: #f1f5f9;
    color: #64748b;
}

/* Table Action Links */
.action-links {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 10px;
    white-space: nowrap;
}
.action-btn {
    border: 0;
    background: transparent;
    cursor: pointer;
    font-size: 0.82rem;
    font-weight: 700;
    text-decoration: none;
    padding: 0;
    white-space: nowrap;
    transition: opacity 0.15s ease;
}
.action-btn:hover {
    opacity: 0.75;
}
.map-link { color: #dc2626; }
.view-link { color: #334155; }
.edit-link { color: #16a34a; }
.service-link { color: #d97706; }
.delete-link { color: #ef4444; }
.icon-red { color: #ef4444; margin-right: 2px; }
.icon-wrench { color: #d97706; margin-right: 2px; }
.text-right { text-align: right; }

/* Modals */
.form-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 14px;
}
.form-group.full-width {
    grid-column: span 2;
}
@media (max-width: 560px) {
    .form-grid, .details-grid { grid-template-columns: 1fr; }
    .form-group.full-width { grid-column: span 1; }
}
.details-summary-header h2 { margin: 0; font-size: 1.3rem; }
.badge-code-lg { background: #dbeafe; color: #1e40af; padding: 4px 10px; border-radius: 8px; font-weight: 800; font-size: 0.8rem; }
.plate-text-lg { margin: 4px 0 0; color: #64748b; font-size: 0.9rem; font-weight: 600; }
.details-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
.details-item { display: flex; flex-direction: column; gap: 4px; }
.details-label { font-size: 0.76rem; font-weight: 700; color: #64748b; text-transform: uppercase; }
.modal-footer { display: flex; justify-content: flex-end; gap: 10px; }
.margin-top-xs { margin-top: 4px; }
.maintenance-modal-card { width: min(760px, calc(100vw - 32px)); max-height: 88vh; overflow-y: auto; }
.maintenance-modal-card .modal-header { align-items: flex-start; }
.maintenance-modal-card .modal-header h3 { margin: 2px 0 0; }
.maintenance-issue-list { display: grid; gap: 12px; max-height: 42vh; overflow-y: auto; margin: 4px 0 18px; }
.maintenance-issue-card { padding: 14px 16px; border: 1px solid var(--border); border-radius: 12px; background: var(--bg); }
.maintenance-issue-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.maintenance-issue-heading small { color: var(--muted); font-size: .75rem; }
.maintenance-issue-card p { margin: 10px 0; color: var(--text); white-space: pre-wrap; line-height: 1.5; }
.maintenance-status { display: inline-flex; padding: 5px 9px; border-radius: 999px; background: rgba(245,158,11,.14); color: #a16207; font-size: .73rem; font-weight: 800; }
.maintenance-status-resolved { background: rgba(34,197,94,.13); color: #15803d; }
.maintenance-status-in-progress { background: rgba(67,97,238,.13); color: #3730a3; }
.maintenance-status-waiting-for-parts { background: rgba(249,115,22,.13); color: #c2410c; }
.maintenance-photo-link { color: var(--accent); font-size: .82rem; font-weight: 700; }
.maintenance-status-form { display: flex; align-items: center; gap: 8px; margin-top: 12px; }
.maintenance-status-form label { color: var(--muted); font-size: .8rem; font-weight: 700; }
.maintenance-status-form select { max-width: 200px; }
.maintenance-empty { padding: 16px; color: var(--muted); text-align: center; }
#maintenance-issue-form { padding-top: 17px; border-top: 1px solid var(--border); }
#maintenance-issue-form h4 { margin: 0 0 13px; color: var(--text); }
#maintenance-issue-form label { display: block; margin: 12px 0 6px; color: var(--text); font-size: .82rem; font-weight: 700; }
#maintenance-issue-form input[type=file] { height: auto; }
</style>

<!-- JavaScript Logic for Fleet Command Operations -->
<script>
const basePath = <?= json_encode($dashboard['basePath']) ?>;

function filterByStatus(statusKey, btnElem) {
    document.querySelectorAll('.status-filter-btn').forEach(btn => btn.classList.remove('active'));
    btnElem.classList.add('active');

    const rows = document.querySelectorAll('#vehicle-table-body tr');
    rows.forEach(row => {
        const rowStatus = row.getAttribute('data-status');
        if (statusKey === 'all' || rowStatus === statusKey) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

function openAddVehicleModal() {
    document.getElementById('add-vehicle-modal').style.display = 'flex';
    const idInput = document.getElementById('add-vhc-id');
    if (idInput && document.querySelector('#add-vehicle-modal h3').textContent.includes('Add')) {
        idInput.value = "<?= htmlspecialchars($dashboard['nextVehicleCode'] ?? '', ENT_QUOTES, 'UTF-8') ?>";
    }
}
function closeAddVehicleModal() {
    document.getElementById('add-vehicle-modal').style.display = 'none';
    document.getElementById('vehicle-form').reset();
    document.getElementById('vehicle-form').action = "<?= route('vehicles.store') ?>";
    document.getElementById('vehicle-method').value = '';
    document.querySelector('#add-vehicle-modal h3').textContent = '+ Add New Vehicle';
    const idInput = document.getElementById('add-vhc-id');
    if (idInput) { idInput.value = "<?= htmlspecialchars($dashboard['nextVehicleCode'] ?? '', ENT_QUOTES, 'UTF-8') ?>"; }
}

function viewVehicleDetails(button) {
    const {code: vId, plate, type, name: brand, odometer: odo, status} = button.dataset;
    document.getElementById('view-modal-id').innerText = vId;
    document.getElementById('view-modal-brand').innerText = brand;
    document.getElementById('view-modal-plate').innerText = 'Plate: ' + plate;
    document.getElementById('view-modal-type').innerText = type;
    document.getElementById('view-modal-odometer').innerText = `${Number(odo).toLocaleString()} km`;

    const badgeClass = status === 'Available' ? 'badge-available' :
                       (status === 'In Transit' ? 'badge-in-transit' :
                       (status === 'Reserved' ? 'badge-reserved' :
                       (status === 'Maintenance' ? 'badge-maintenance' : 'badge-inactive')));

    document.getElementById('view-modal-status-badge').innerHTML = `<span class="status-pill-badge ${badgeClass}">${status}</span>`;
    document.getElementById('view-vehicle-modal').style.display = 'flex';
}
function closeViewModal() {
    document.getElementById('view-vehicle-modal').style.display = 'none';
}

function editVehicle(button) {
    const {id, code, plate, type, name, status} = button.dataset;
    openAddVehicleModal();
    document.querySelector('#add-vehicle-modal h3').textContent = 'Edit Vehicle';
    document.querySelector('#vehicle-form').action = `<?= url('/vehicles') ?>/${id}`;
    document.getElementById('vehicle-method').value = 'PUT';
    document.getElementById('add-vhc-id').value = code;
    document.getElementById('add-plate').value = plate;
    document.getElementById('add-type').value = type;
    document.getElementById('add-brand').value = name;
    document.getElementById('add-status').value = status;
}

const maintenanceIssuesByVehicle = <?= json_encode($maintenanceIssuesByVehicle, JSON_HEX_TAG | JSON_HEX_APOS | JSON_HEX_AMP | JSON_HEX_QUOT) ?>;
const maintenanceAdmin = <?= !empty($dashboard['isAdmin']) ? 'true' : 'false' ?>;
function openMaintenanceModal(vehicleId, label) {
    const modal = document.getElementById('maintenance-modal');
    document.getElementById('maintenance-modal-title').textContent = `Maintenance · ${label}`;
    const list = document.getElementById('maintenance-issue-list');
    const issues = maintenanceIssuesByVehicle[vehicleId] || [];
    list.replaceChildren();
    if (!issues.length) {
        const empty = document.createElement('p');
        empty.className = 'maintenance-empty';
        empty.textContent = 'No damage or maintenance reports for this vehicle yet.';
        list.appendChild(empty);
    }
    issues.forEach((issue) => {
        const card = document.createElement('article');
        card.className = 'maintenance-issue-card';
        const status = document.createElement('span');
        status.className = `maintenance-status maintenance-status-${issue.status.toLowerCase().replaceAll(' ', '-')}`;
        status.textContent = issue.status;
        const heading = document.createElement('div');
        heading.className = 'maintenance-issue-heading';
        const meta = document.createElement('small');
        meta.textContent = `${issue.created_at || ''} · Reported by ${issue.reported_by}`;
        heading.append(status, meta);
        const details = document.createElement('p');
        details.textContent = issue.details;
        card.append(heading, details);
        if (issue.photo) {
            const photo = document.createElement('a');
            photo.href = issue.photo;
            photo.target = '_blank';
            photo.rel = 'noopener';
            photo.textContent = 'View damage photo';
            photo.className = 'maintenance-photo-link';
            card.appendChild(photo);
        }
        if (maintenanceAdmin) {
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = `<?= url('/maintenance-issues') ?>/${issue.id}`;
            form.className = 'maintenance-status-form';
            form.innerHTML = `<input type="hidden" name="_token" value="<?= htmlspecialchars(csrf_token(), ENT_QUOTES, 'UTF-8') ?>"><input type="hidden" name="_method" value="PUT"><label>Status</label><select name="status" class="form-control"><option>Reported</option><option>In Progress</option><option>Waiting for Parts</option><option>Resolved</option></select><button type="submit" class="action-btn">Update</button>`;
            form.querySelector('select').value = issue.status;
            card.appendChild(form);
        }
        list.appendChild(card);
    });
    if (maintenanceAdmin) {
        document.getElementById('maintenance-issue-form').action = `<?= url('/vehicles') ?>/${vehicleId}/maintenance-issues`;
    }
    modal.style.display = 'flex';
}
function closeMaintenanceModal() { document.getElementById('maintenance-modal').style.display = 'none'; }

function exportFleetCSV() {
    let csv = "VEHICLE ID,PLATE NO,TYPE,BRAND & MODEL,STATUS\n";
    const rows = document.querySelectorAll('#vehicle-table-body tr');
    rows.forEach(r => {
        const cols = r.querySelectorAll('td');
        if (cols.length >= 6 && !r.querySelector('td[colspan]')) {
            const rowData = [
                cols[0].innerText.trim(),
                cols[1].innerText.trim(),
                cols[2].innerText.trim(),
                `"${cols[3].innerText.trim()}"`,
                cols[4].innerText.trim()
            ];
            csv += rowData.join(",") + "\n";
        }
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.setAttribute('href', url);
    a.setAttribute('download', `Fleet_Inventory_${new Date().toISOString().slice(0,10)}.csv`);
    a.click();
}
<?php if ($errors->any() && $dashboard['isAdmin']): ?>
openAddVehicleModal();
<?php endif; ?>
</script>
