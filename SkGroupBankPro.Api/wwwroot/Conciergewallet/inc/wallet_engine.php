<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function getSpinCostTokens(): float
{
    return (float)getSetting('spin_cost_tokens', '100');
}

function findWalletUser(string $walletUserId): ?array
{
    $stmt = db()->prepare("
        SELECT u.*, a.token_balance, a.total_credit, a.total_debit, a.updated_at AS account_updated_at
        FROM wallet_users u
        LEFT JOIN wallet_accounts a ON a.wallet_user_id = u.wallet_user_id
        WHERE u.wallet_user_id = ?
        LIMIT 1
    ");
    $stmt->execute([$walletUserId]);
    $row = $stmt->fetch();

    return $row ?: null;
}

function createWalletUser(array $input): array
{
    $pdo = db();

    $walletUserId = trim((string)($input['wallet_user_id'] ?? ''));
    $fullName = trim((string)($input['full_name'] ?? ''));
    $mobile = trim((string)($input['mobile'] ?? ''));
    $email = trim((string)($input['email'] ?? ''));

    if ($walletUserId === '') {
        $walletUserId = generateWalletUserId();
    }

    if ($fullName === '') {
        throw new RuntimeException('full_name is required');
    }

    $check = $pdo->prepare("SELECT id FROM wallet_users WHERE wallet_user_id = ? LIMIT 1");
    $check->execute([$walletUserId]);
    if ($check->fetch()) {
        throw new RuntimeException('wallet_user_id already exists');
    }

    $pdo->beginTransaction();

    try {
        $stmt = $pdo->prepare("
            INSERT INTO wallet_users (
                wallet_user_id, full_name, mobile, email, status, created_at, updated_at
            ) VALUES (?, ?, ?, ?, 'active', NOW(), NOW())
        ");
        $stmt->execute([$walletUserId, $fullName, $mobile, $email]);

        $stmt = $pdo->prepare("
            INSERT INTO wallet_accounts (
                wallet_user_id, token_balance, total_credit, total_debit, created_at, updated_at
            ) VALUES (?, 0, 0, 0, NOW(), NOW())
        ");
        $stmt->execute([$walletUserId]);

        $pdo->commit();
        return findWalletUser($walletUserId);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function getWalletBalance(string $walletUserId): array
{
    $user = findWalletUser($walletUserId);
    if (!$user) {
        throw new RuntimeException('User not found');
    }

    $spinCost = getSpinCostTokens();
    $tokenBalance = (float)$user['token_balance'];
    $availableSpins = $spinCost > 0 ? (int)floor($tokenBalance / $spinCost) : 0;

    return [
        'wallet_user_id' => $user['wallet_user_id'],
        'full_name' => $user['full_name'],
        'token_balance' => $tokenBalance,
        'available_spins' => $availableSpins,
        'spin_cost_tokens' => $spinCost,
        'currency' => APP_CURRENCY,
        'total_credit' => (float)$user['total_credit'],
        'total_debit' => (float)$user['total_debit'],
        'status' => $user['status'],
    ];
}

function createWalletTransaction(
    string $walletUserId,
    string $txnType,
    float $amount,
    string $reference,
    string $remarks,
    string $status,
    string $createdBy
): array {
    $pdo = db();

    if ($amount <= 0) {
        throw new RuntimeException('amount must be greater than 0');
    }

    $user = findWalletUser($walletUserId);
    if (!$user) {
        throw new RuntimeException('User not found');
    }

    $txnId = generateTransactionId();

    $stmt = $pdo->prepare("
        INSERT INTO wallet_transactions (
            transaction_id, wallet_user_id, txn_type, amount, currency, reference,
            status, remarks, created_by, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
    ");

    $stmt->execute([
        $txnId,
        $walletUserId,
        $txnType,
        $amount,
        APP_CURRENCY,
        $reference,
        $status,
        $remarks,
        $createdBy
    ]);

    $stmt = $pdo->prepare("SELECT * FROM wallet_transactions WHERE transaction_id = ? LIMIT 1");
    $stmt->execute([$txnId]);

    return $stmt->fetch();
}

function depositTokens(
    string $walletUserId,
    float $amount,
    string $reference = '',
    string $remarks = 'Wallet deposit',
    string $createdBy = 'system'
): array {
    $pdo = db();

    if ($amount <= 0) {
        throw new RuntimeException('amount must be greater than 0');
    }

    $user = findWalletUser($walletUserId);
    if (!$user) {
        throw new RuntimeException('User not found');
    }

    $pdo->beginTransaction();

    try {
        $txn = createWalletTransaction(
            $walletUserId,
            'deposit',
            $amount,
            $reference,
            $remarks,
            'SUCCESS',
            $createdBy
        );

        $stmt = $pdo->prepare("
            UPDATE wallet_accounts
            SET token_balance = token_balance + ?,
                total_credit = total_credit + ?,
                updated_at = NOW()
            WHERE wallet_user_id = ?
        ");
        $stmt->execute([$amount, $amount, $walletUserId]);

        $pdo->commit();

        return [
            'transaction' => $txn,
            'balance' => getWalletBalance($walletUserId)
        ];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function debitTokens(
    string $walletUserId,
    float $amount,
    string $reference = '',
    string $remarks = 'Wallet debit',
    string $createdBy = 'system'
): array {
    $pdo = db();

    if ($amount <= 0) {
        throw new RuntimeException('amount must be greater than 0');
    }

    $pdo->beginTransaction();

    try {
        $stmt = $pdo->prepare("
            SELECT token_balance
            FROM wallet_accounts
            WHERE wallet_user_id = ?
            FOR UPDATE
        ");
        $stmt->execute([$walletUserId]);
        $account = $stmt->fetch();

        if (!$account) {
            throw new RuntimeException('Wallet account not found');
        }

        $currentBalance = (float)$account['token_balance'];
        if ($currentBalance < $amount) {
            throw new RuntimeException('Insufficient wallet balance');
        }

        $txn = createWalletTransaction(
            $walletUserId,
            'debit',
            $amount,
            $reference,
            $remarks,
            'SUCCESS',
            $createdBy
        );

        $stmt = $pdo->prepare("
            UPDATE wallet_accounts
            SET token_balance = token_balance - ?,
                total_debit = total_debit + ?,
                updated_at = NOW()
            WHERE wallet_user_id = ?
        ");
        $stmt->execute([$amount, $amount, $walletUserId]);

        $pdo->commit();

        return [
            'transaction' => $txn,
            'balance' => getWalletBalance($walletUserId)
        ];
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
        throw $e;
    }
}

function getTransaction(string $transactionId): ?array
{
    $stmt = db()->prepare("
        SELECT *
        FROM wallet_transactions
        WHERE transaction_id = ?
        LIMIT 1
    ");
    $stmt->execute([$transactionId]);
    $row = $stmt->fetch();

    return $row ?: null;
}

function getUsersList(): array
{
    $stmt = db()->query("
        SELECT u.wallet_user_id, u.full_name, u.mobile, u.email, u.status,
               a.token_balance, a.total_credit, a.total_debit
        FROM wallet_users u
        LEFT JOIN wallet_accounts a ON a.wallet_user_id = u.wallet_user_id
        ORDER BY u.id DESC
    ");

    return $stmt->fetchAll();
}

function getTransactionsList(): array
{
    $stmt = db()->query("
        SELECT *
        FROM wallet_transactions
        ORDER BY id DESC
        LIMIT 300
    ");

    return $stmt->fetchAll();
}