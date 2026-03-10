<?php
declare(strict_types=1);

require_once __DIR__ . '/../inc/auth.php';
require_once __DIR__ . '/../inc/wallet_engine.php';

requireAdmin();

$message = '';
$error = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = trim((string)($_POST['action_type'] ?? 'deposit'));
    $walletUserId = trim((string)($_POST['wallet_user_id'] ?? ''));
    $amount = (float)($_POST['amount'] ?? 0);
    $reference = trim((string)($_POST['reference'] ?? ''));
    $remarks = trim((string)($_POST['remarks'] ?? ''));

    try {
        if ($action === 'deposit') {
            depositTokens($walletUserId, $amount, $reference, $remarks ?: 'Admin top up', (string)$_SESSION['cw_admin_username']);
            $message = 'Deposit successful';
        } elseif ($action === 'debit') {
            debitTokens($walletUserId, $amount, $reference, $remarks ?: 'Admin debit', (string)$_SESSION['cw_admin_username']);
            $message = 'Debit successful';
        } else {
            throw new RuntimeException('Invalid action');
        }
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
    <title>Top Up / Debit - <?= e(APP_NAME) ?></title>
    <style>
        body{font-family:Arial,sans-serif;background:#f5f7fb;margin:0}
        .nav{background:#0b72b9;padding:14px 24px;color:#fff}
        .nav a{color:#fff;margin-right:18px;text-decoration:none}
        .wrap{padding:24px}
        .card{background:#fff;padding:20px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.06);margin-bottom:20px}
        input,select{width:100%;padding:10px;margin:6px 0 12px;border:1px solid #d6dce5;border-radius:8px;box-sizing:border-box}
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
        <h2>Top Up / Debit</h2>
        <?php if ($message): ?><div class="ok"><?= e($message) ?></div><?php endif; ?>
        <?php if ($error): ?><div class="err"><?= e($error) ?></div><?php endif; ?>

        <form method="post">
            <label>Action</label>
            <select name="action_type" required>
                <option value="deposit">Deposit</option>
                <option value="debit">Debit</option>
            </select>

            <label>Wallet User</label>
            <select name="wallet_user_id" required>
                <option value="">Select user</option>
                <?php foreach ($users as $user): ?>
                    <option value="<?= e($user['wallet_user_id']) ?>">
                        <?= e($user['wallet_user_id'] . ' - ' . $user['full_name']) ?>
                    </option>
                <?php endforeach; ?>
            </select>

            <label>Amount</label>
            <input type="number" step="0.01" name="amount" required>

            <label>Reference</label>
            <input type="text" name="reference">

            <label>Remarks</label>
            <input type="text" name="remarks">

            <button type="submit">Submit</button>
        </form>
    </div>
</div>
</body>
</html>