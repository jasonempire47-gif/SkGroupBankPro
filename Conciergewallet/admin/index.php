<?php
declare(strict_types=1);

require_once __DIR__ . '/../inc/auth.php';

$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $username = trim((string)($_POST['username'] ?? ''));
    $password = (string)($_POST['password'] ?? '');

    if (adminLogin($username, $password)) {
        redirect('dashboard.php');
    }

    $error = 'Invalid username or password';
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Admin Login - <?= e(APP_NAME) ?></title>
    <style>
        body{font-family:Arial,sans-serif;background:#f2f5fa;margin:0;padding:40px}
        .box{max-width:420px;margin:40px auto;background:#fff;padding:28px;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,.08)}
        input{width:100%;padding:12px;margin:8px 0 14px;border:1px solid #d6dce5;border-radius:8px;box-sizing:border-box}
        button{width:100%;padding:12px;background:#0b72b9;border:0;color:#fff;border-radius:8px;cursor:pointer}
        .error{color:#c62828;margin-bottom:14px}
    </style>
</head>
<body>
<div class="box">
    <h2><?= e(APP_NAME) ?> Admin</h2>
    <?php if ($error !== ''): ?>
        <div class="error"><?= e($error) ?></div>
    <?php endif; ?>
    <form method="post">
        <label>Username</label>
        <input type="text" name="username" required>

        <label>Password</label>
        <input type="password" name="password" required>

        <button type="submit">Login</button>
    </form>
    <p style="margin-top:12px;font-size:12px;color:#666">Default: admin / admin123</p>
</div>
</body>
</html>