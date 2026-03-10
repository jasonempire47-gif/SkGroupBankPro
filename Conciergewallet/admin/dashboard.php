<?php
declare(strict_types=1);

require_once __DIR__ . '/../inc/auth.php';
require_once __DIR__ . '/../inc/wallet_engine.php';

requireAdmin();

$users = getUsersList();
$transactions = getTransactionsList();

$totalUsers = count($users);
$totalBalance = 0;
$totalCredit = 0;
$totalDebit = 0;

foreach ($users as $user) {
    $totalBalance += (float)$user['token_balance'];
    $totalCredit += (float)$user['total_credit'];
    $totalDebit += (float)$user['total_debit'];
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dashboard - <?= e(APP_NAME) ?></title>
    <style>
        body{font-family:Arial,sans-serif;background:#f5f7fb;margin:0}
        .nav{background:#0b72b9;padding:14px 24px;color:#fff}
        .nav a{color:#fff;margin-right:18px;text-decoration:none}
        .wrap{padding:24px}
        .cards{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}
        .card{background:#fff;padding:18px;border-radius:12px;box-shadow:0 8px 24px rgba(0,0,0,.06)}
        @media(max-width:900px){.cards{grid-template-columns:1fr 1fr}}
        @media(max-width:600px){.cards{grid-template-columns:1fr}}
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
    <h2>Dashboard</h2>
    <div class="cards">
        <div class="card">
            <h3><?= $totalUsers ?></h3>
            <div>Total Users</div>
        </div>
        <div class="card">
            <h3><?= moneyFormat($totalBalance) ?></h3>
            <div>Total Token Balance</div>
        </div>
        <div class="card">
            <h3><?= moneyFormat($totalCredit) ?></h3>
            <div>Total Credit</div>
        </div>
        <div class="card">
            <h3><?= moneyFormat($totalDebit) ?></h3>
            <div>Total Debit</div>
        </div>
    </div>

    <div class="card" style="margin-top:20px">
        <h3>Spin Rule</h3>
        <p>1 spin = <?= moneyFormat(getSpinCostTokens()) ?> tokens</p>
    </div>

    <div class="card" style="margin-top:20px">
        <h3>Recent Transactions</h3>
        <table width="100%" cellpadding="10" cellspacing="0" border="1" style="border-collapse:collapse">
            <tr>
                <th>ID</th>
                <th>User</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Reference</th>
                <th>Date</th>
            </tr>
            <?php foreach (array_slice($transactions, 0, 10) as $txn): ?>
                <tr>
                    <td><?= e($txn['transaction_id']) ?></td>
                    <td><?= e($txn['wallet_user_id']) ?></td>
                    <td><?= e($txn['txn_type']) ?></td>
                    <td><?= moneyFormat((float)$txn['amount']) ?></td>
                    <td><?= e((string)$txn['reference']) ?></td>
                    <td><?= e($txn['created_at']) ?></td>
                </tr>
            <?php endforeach; ?>
        </table>
    </div>
</div>
</body>
</html>