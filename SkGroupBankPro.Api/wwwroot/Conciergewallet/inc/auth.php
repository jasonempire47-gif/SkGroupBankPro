<?php
declare(strict_types=1);

require_once __DIR__ . '/helpers.php';

function requireApiClient(): array
{
    $accessId = $_SERVER['HTTP_X_ACCESS_ID'] ?? '';
    $accessToken = $_SERVER['HTTP_X_ACCESS_TOKEN'] ?? '';

    if ($accessId === '' || $accessToken === '') {
        jsonResponse([
            'ok' => false,
            'message' => 'Missing API credentials'
        ], 401);
    }

    $stmt = db()->prepare("
        SELECT id, access_id, access_token, status
        FROM api_clients
        WHERE access_id = ?
        LIMIT 1
    ");
    $stmt->execute([$accessId]);
    $client = $stmt->fetch();

    if (!$client) {
        jsonResponse([
            'ok' => false,
            'message' => 'Invalid access ID'
        ], 401);
    }

    if ($client['status'] !== 'active') {
        jsonResponse([
            'ok' => false,
            'message' => 'API client inactive'
        ], 403);
    }

    if (!hash_equals((string)$client['access_token'], (string)$accessToken)) {
        jsonResponse([
            'ok' => false,
            'message' => 'Invalid access token'
        ], 401);
    }

    return $client;
}

function adminLogin(string $username, string $password): bool
{
    $stmt = db()->prepare("
        SELECT id, username, password_hash, status
        FROM admin_users
        WHERE username = ?
        LIMIT 1
    ");
    $stmt->execute([$username]);
    $admin = $stmt->fetch();

    if (!$admin || $admin['status'] !== 'active') {
        return false;
    }

    if (!password_verify($password, (string)$admin['password_hash'])) {
        return false;
    }

    session_regenerate_id(true);
    $_SESSION['cw_admin_id'] = $admin['id'];
    $_SESSION['cw_admin_username'] = $admin['username'];

    return true;
}

function requireAdmin(): void
{
    if (empty($_SESSION['cw_admin_id'])) {
        redirect('index.php');
    }
}

function adminLogout(): void
{
    $_SESSION = [];
    if (ini_get("session.use_cookies")) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000,
            $params["path"], $params["domain"],
            $params["secure"], $params["httponly"]
        );
    }
    session_destroy();
}