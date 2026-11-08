<?php
$user = $dashboard['user'];
$prefs = $user['preferences'] ?? ['theme' => 'light', 'date_format' => 'M d, Y', 'locale' => 'en'];
?>
<section class="panel settings-page">
    <div class="panel-header">
        <div>
            <p class="eyebrow">Your workspace</p>
            <h3>Settings</h3>
            <p class="settings-intro">Manage your profile, sign-in security, and display preferences.</p>
        </div>
    </div>

    <?php if (session('status')): ?>
        <div class="alert-banner status-approved" role="status" style="padding:10px 14px;border-radius:12px;margin-bottom:14px;font-weight:600;">
            <?= htmlspecialchars(session('status'), ENT_QUOTES, 'UTF-8') ?>
        </div>
    <?php endif; ?>
    <?php if ($errors->any()): ?>
        <div class="alert-banner" role="alert" style="padding:10px 14px;border-radius:12px;margin-bottom:14px;font-weight:600;background:rgba(231,76,60,0.12);color:#e74c3c;">
            <?= htmlspecialchars($errors->first(), ENT_QUOTES, 'UTF-8') ?>
        </div>
    <?php endif; ?>

    <div class="settings-grid">
        <section class="settings-card" aria-labelledby="profile-heading">
            <div class="settings-card-heading">
                <span class="settings-icon" aria-hidden="true">👤</span>
                <div><h4 id="profile-heading">Profile</h4><p>Manage your profile picture and account details.</p></div>
            </div>
            <div class="profile-picture-row">
                <div class="profile-picture-preview">
                    <?php if (!empty($user['profilePhotoUrl'])): ?>
                        <img src="<?= htmlspecialchars($user['profilePhotoUrl'], ENT_QUOTES, 'UTF-8') ?>" alt="Current profile picture">
                    <?php else: ?>
                        <span><?= htmlspecialchars($user['initials'] ?? '', ENT_QUOTES, 'UTF-8') ?></span>
                    <?php endif; ?>
                </div>
                <div class="profile-picture-content">
                    <strong>Profile picture</strong>
                    <p>Choose a photo to personalize your account across FleetOps.</p>
                    <form method="POST" action="<?= route('settings.profile-photo') ?>" enctype="multipart/form-data" class="profile-photo-form">
                        <?= csrf_field() ?>
                        <label class="profile-photo-picker" for="profile-photo">Choose photo</label>
                        <input type="file" id="profile-photo" name="profile_photo" accept="image/jpeg,image/png,image/webp" required>
                        <button type="submit" class="btn-secondary">Upload picture</button>
                        <small class="settings-help">JPG, PNG, or WebP. Maximum 5 MB.</small>
                    </form>
                </div>
            </div>
            <?php if ($dashboard['isAdmin']): ?>
            <form method="POST" action="<?= route('settings.profile') ?>" class="settings-form">
                <?= csrf_field() ?>
                <?= method_field('PUT') ?>
                <div class="form-group">
                    <label for="profile-name">Full name</label>
                    <input class="form-control" type="text" id="profile-name" name="name" autocomplete="name" required maxlength="100" value="<?= htmlspecialchars($user['name'] ?? '', ENT_QUOTES, 'UTF-8') ?>">
                </div>
                <div class="form-group">
                    <label for="profile-email">Email address</label>
                    <input class="form-control" type="email" id="profile-email" name="email" autocomplete="email" required maxlength="100" value="<?= htmlspecialchars($user['email'] ?? '', ENT_QUOTES, 'UTF-8') ?>">
                    <small class="settings-help">Used for sign-in and account notices.</small>
                </div>
                <button type="submit" class="btn-primary">Save profile</button>
            </form>
            <?php else: ?>
            <div class="profile-summary">
                <div><small>Full name</small><strong><?= htmlspecialchars($user['name'] ?? '', ENT_QUOTES, 'UTF-8') ?></strong></div>
                <div><small>Email address</small><strong><?= htmlspecialchars($user['email'] ?? '', ENT_QUOTES, 'UTF-8') ?></strong></div>
            </div>
            <?php endif; ?>
        </section>

        <?php if ($dashboard['isAdmin']): ?>
        <section class="settings-card" aria-labelledby="security-heading">
            <div class="settings-card-heading">
                <span class="settings-icon" aria-hidden="true">🔒</span>
                <div><h4 id="security-heading">Security</h4><p>Choose a new password for your account.</p></div>
            </div>
            <form method="POST" action="<?= route('settings.password') ?>" class="settings-form">
                <?= csrf_field() ?>
                <?= method_field('PUT') ?>
                <fieldset style="display:contents;border:0;padding:0;" <?= $dashboard['isAdmin'] ? '' : 'disabled' ?>>
                <div class="form-group">
                    <label for="current-password">Current password</label>
                    <input class="form-control" type="password" id="current-password" name="current_password" autocomplete="current-password" required>
                </div>
                <div class="form-group">
                    <label for="new-password">New password</label>
                    <input class="form-control" type="password" id="new-password" name="password" autocomplete="new-password" required minlength="8">
                    <small class="settings-help">Use at least 8 characters.</small>
                </div>
                <div class="form-group">
                    <label for="new-password-confirm">Confirm new password</label>
                    <input class="form-control" type="password" id="new-password-confirm" name="password_confirmation" autocomplete="new-password" required minlength="8">
                </div>
                <?php if ($dashboard['isAdmin']): ?><button type="submit" class="btn-primary">Update password</button><?php endif; ?>
                </fieldset>
            </form>
            <p class="settings-note">Two-factor email verification is required at every sign-in.</p>
        </section>
        <?php endif; ?>

        <section class="settings-card settings-card-wide" aria-labelledby="preferences-heading">
            <div class="settings-card-heading">
                <span class="settings-icon" aria-hidden="true">⚙️</span>
                <div><h4 id="preferences-heading">Display preferences</h4><p>Choose how the dashboard looks and displays dates.</p></div>
            </div>
            <form method="POST" action="<?= route('settings.preferences') ?>" class="settings-form settings-preferences-form">
                <?= csrf_field() ?>
                <?= method_field('PUT') ?>
                <fieldset style="display:contents;border:0;padding:0;" <?= $dashboard['isAdmin'] ? '' : 'disabled' ?>>
                <div class="form-group">
                    <label for="settings-theme">Color theme</label>
                    <select class="form-control" id="settings-theme" name="theme" required>
                        <option value="light" <?= ($prefs['theme'] ?? 'light') === 'light' ? 'selected' : '' ?>>Light</option>
                        <option value="dark" <?= ($prefs['theme'] ?? '') === 'dark' ? 'selected' : '' ?>>Dark</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="settings-date-format">Date format</label>
                    <select class="form-control" id="settings-date-format" name="date_format" required>
                        <option value="M d, Y" <?= ($prefs['date_format'] ?? 'M d, Y') === 'M d, Y' ? 'selected' : '' ?>>Sep 29, 2026</option>
                        <option value="d/m/Y" <?= ($prefs['date_format'] ?? '') === 'd/m/Y' ? 'selected' : '' ?>>29/09/2026</option>
                        <option value="Y-m-d" <?= ($prefs['date_format'] ?? '') === 'Y-m-d' ? 'selected' : '' ?>>2026-09-29</option>
                    </select>
                </div>
                <div class="form-group">
                    <label for="settings-language">Language</label>
                    <select class="form-control" id="settings-language" name="locale" required>
                        <option value="en" <?= ($prefs['locale'] ?? 'en') === 'en' ? 'selected' : '' ?>>English</option>
                        <option value="fil" <?= ($prefs['locale'] ?? '') === 'fil' ? 'selected' : '' ?>>Filipino</option>
                    </select>
                </div>
                <?php if ($dashboard['isAdmin']): ?><button type="submit" class="btn-primary">Save preferences</button><?php endif; ?>
                </fieldset>
            </form>
            <p class="settings-note">Date and language choices are saved to your account. Language changes take effect where translations are available.</p>
        </section>
    </div>
</section>

<style>
    .settings-intro { margin: 6px 0 0; color: var(--muted); font-size: .9rem; }
    .settings-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .settings-card { min-width: 0; padding: 20px; border: 1px solid var(--border); border-radius: 16px; background: var(--surface); }
    .settings-card-wide { grid-column: 1 / -1; }
    .settings-card-heading { display: flex; align-items: flex-start; gap: 12px; margin-bottom: 18px; }
    .settings-icon { display: grid; place-items: center; flex: 0 0 40px; height: 40px; border-radius: 12px; background: var(--accent-light); font-size: 1.1rem; }
    .settings-card-heading h4 { margin: 0 0 4px; color: var(--text); font-size: 1rem; }
    .settings-card-heading p, .settings-note { margin: 0; color: var(--muted); font-size: .84rem; line-height: 1.5; }
    .settings-form { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
    .settings-form .form-group { width: 100%; margin: 0; }
    .settings-form .form-control { width: 100%; margin-top: 6px; }
    .settings-help { display: block; margin-top: 5px; color: var(--muted); font-size: .78rem; }
    .profile-picture-row { display:flex; align-items:center; gap:16px; margin-bottom:20px; padding:15px; border:1px solid var(--border); border-radius:14px; background:var(--bg); }
    .profile-picture-preview { display:grid; place-items:center; flex:0 0 72px; width:72px; height:72px; overflow:hidden; border-radius:50%; background:linear-gradient(135deg,#4361ee,#7b2ff7); color:#fff; font-size:1.2rem; font-weight:800; }
    .profile-picture-preview img { width:100%; height:100%; object-fit:cover; }
    .profile-picture-content { min-width:0; }
    .profile-picture-content > strong { color:var(--text); }
    .profile-picture-content > p { margin:4px 0 10px; color:var(--muted); font-size:.82rem; }
    .profile-summary { display:grid; gap:11px; }
    .profile-summary small { display:block; margin-bottom:3px; color:var(--muted); font-size:.76rem; }
    .profile-summary strong { color:var(--text); font-size:.9rem; }
    .profile-photo-form { display:flex; align-items:center; flex-wrap:wrap; gap:8px; }
    .profile-photo-form input[type=file] { position:absolute; width:1px; height:1px; overflow:hidden; clip:rect(0,0,0,0); white-space:nowrap; clip-path:inset(50%); }
    .profile-photo-picker { display:inline-flex; align-items:center; min-height:38px; padding:0 12px; border:1px solid var(--border); border-radius:9px; background:var(--surface); color:var(--text); font-size:.82rem; font-weight:700; cursor:pointer; }
    .profile-photo-form .settings-help { flex-basis:100%; margin:0; }
    .settings-note { margin-top: 14px; }
    .settings-preferences-form { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); align-items: end; gap: 14px; }
    @media (max-width: 760px) {
        .settings-grid { grid-template-columns: 1fr; }
        .settings-card-wide { grid-column: auto; }
        .settings-preferences-form { grid-template-columns: 1fr; }
        .profile-picture-row { align-items:flex-start; }
    }
</style>
