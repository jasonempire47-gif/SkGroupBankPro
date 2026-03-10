<?php
declare(strict_types=1);

require_once __DIR__ . '/inc/helpers.php';
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title><?= e(APP_NAME) ?></title>
    <style>
        body{font-family:Arial,sans-serif;background:#f5f7fb;margin:0;padding:40px;color:#1d2433}
        .box{max-width:900px;margin:0 auto;background:#fff;padding:30px;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.08)}
        a{color:#0b72b9;text-decoration:none}
        code{background:#eef3f8;padding:2px 6px;border-radius:4px}
    </style>
</head>
<body>
<div class="box">
    <h1><?= e(APP_NAME) ?></h1>
    <p>Standalone wallet provider system.</p>
    <p><a href="admin/index.php">Open Admin Panel</a></p>

    <h3>API Base</h3>
    <p><code>/api/</code></p>

    <h3>Endpoints</h3>
    <ul>
        <li>POST <code>/api/create_user.php</code></li>
        <li>GET <code>/api/user.php?wallet_user_id=CWxxxxx</code></li>
        <li>GET <code>/api/balance.php?wallet_user_id=CWxxxxx</code></li>
        <li>POST <code>/api/deposit.php</code></li>
        <li>POST <code>/api/debit.php</code></li>
        <li>GET <code>/api/transaction.php?transaction_id=CTXN-xxxxx</code></li>
        <li>GET <code>/api/auth_validate.php</code></li>
    </ul>
</div>
</body>
</html>