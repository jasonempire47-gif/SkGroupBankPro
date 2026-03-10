<?php
declare(strict_types=1);

require_once __DIR__ . '/../inc/auth.php';
require_once __DIR__ . '/../inc/wallet_engine.php';

requireAdmin();

$message = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    try {
        createWalletUser([
            'wallet_user_id' => trim((string)($_POST['wallet_user_id'] ?? '')),
            'full_name'      => trim((string)($_POST['full_name'] ?? '')),
            'mobile'         => trim((string)($_POST['mobile'] ?? '')),
            'email'          => trim((string)($_POST['email'] ?? '')),
        ]);
        $message = 'User created successfully';
    } catch (Throwable $e) {
        $error = $e->getMessage();
    }
}

$users = getUsersList();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Users - <?= e(APP_NAME) ?></title>
    <style>
        body{font-family:Arial,sans-serif;background:#f5f7fb;margin:0}
        .nav{background:#0b72b9;padding:14px 24px;color:#fff}
        .nav a{color:#fff;margin-right:18px;text-decoration:none}
        .wrap{padding:24px}
        .card{background:#fff;padding:20px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.06);margin-bottom:20px}
        input{width:100%;padding:10px;margin:6px 0 12px;border:1px solid #d6dce5;border-radius:8px;box-sizing:border-box}
        button{padding:10px 16px;background:#0b72b9;border:0;color:#fff;border-radius:8px;cursor:pointer}
        .ok{color:#0a7a33}.err{color:#c62828}
    </style>
</head>
<body>
<div class="nav">
    <strong><?= e(APP_NAME) ?></strong>
    <a href="dashboard.php">Dashboard</a>
    <a href="users.php">Users</a>
    <a href="topup.php">Top Up / Debit</a>
    <a href="transactions.php">Transactions</a>
    <a href="logout.php">Logout</a>
</div>

<div class="wrap">
    <div class="card">
        <h2>Create User</h2>
        <?php if ($message): ?><div class="ok"><?= e($message) ?></div><?php endif; ?>
        <?php if ($error): ?><div class="err"><?= e($error) ?></div><?php endif; ?>

        <form method="post">
            <label>Wallet User ID (optional)</label>
            <input type="text" name="wallet_user_id" placeholder="Auto-generated if blank">

            <label>Full Name</label>
            <input type="text" name="full_name" required>

            <label>Mobile</label>
            <input type="text" name="mobile">

            <label>Email</label>
            <input type="email" name="email">

            <button type="submit">Create User</button>
        </form>
    </div>

    <div class="card">
        <h2>Users</h2>
        <table width="100%" cellpadding="10" cellspacing="0" border="1" style="border-collapse:collapse">
            <tr>
                <th>Wallet ID</th>
                <th>Name</th>
                <th>Mobile</th>
                <th>Email</th>
                <th>Balance</th>
                <th>Status</th>
            </tr>
            <?php foreach ($users as $user): ?>
                <tr>
                    <td><?= e($user['wallet_user_id']) ?></td>
                    <td><?= e($user['full_name']) ?></td>
                    <td><?= e((string)$user['mobile']) ?></td>
                    <td><?= e((string)$user['email']) ?></td>
                    <td><?= moneyFormat((float)$user['token_balance']) ?></td>
                    <td><?= e($user['status']) ?></td>
                </tr>
            <?php endforeach; ?>
        </table>
    </div>
</div>
</body>
</html>