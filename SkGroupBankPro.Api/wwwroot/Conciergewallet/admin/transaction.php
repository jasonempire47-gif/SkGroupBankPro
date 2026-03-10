<?php
declare(strict_types=1);

require_once __DIR__ . '/../inc/auth.php';
require_once __DIR__ . '/../inc/wallet_engine.php';

requireAdmin();
$transactions = getTransactionsList();
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Transactions - <?= e(APP_NAME) ?></title>
    <style>
        body{font-family:Arial,sans-serif;background:#f5f7fb;margin:0}
        .nav{background:#0b72b9;padding:14px 24px;color:#fff}
        .nav a{color:#fff;margin-right:18px;text-decoration:none}
        .wrap{padding:24px}
        .card{background:#fff;padding:20px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.06)}
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
        <h2>Transactions</h2>
        <table width="100%" cellpadding="10" cellspacing="0" border="1" style="border-collapse:collapse">
            <tr>
                <th>Transaction ID</th>
                <th>User</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Currency</th>
                <th>Reference</th>
                <th>Status</th>
                <th>Remarks</th>
                <th>Created By</th>
                <th>Date</th>
            </tr>
            <?php foreach ($transactions as $txn): ?>
                <tr>
                    <td><?= e($txn['transaction_id']) ?></td>
                    <td><?= e($txn['wallet_user_id']) ?></td>
                    <td><?= e($txn['txn_type']) ?></td>
                    <td><?= moneyFormat((float)$txn['amount']) ?></td>
                    <td><?= e($txn['currency']) ?></td>
                    <td><?= e((string)$txn['reference']) ?></td>
                    <td><?= e($txn['status']) ?></td>
                    <td><?= e((string)$txn['remarks']) ?></td>
                    <td><?= e((string)$txn['created_by']) ?></td>
                    <td><?= e($txn['created_at']) ?></td>
                </tr>
            <?php endforeach; ?>
        </table>
    </div>
</div>
</body>
</html>