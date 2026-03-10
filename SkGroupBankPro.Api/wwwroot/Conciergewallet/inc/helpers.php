<?php
declare(strict_types=1);

require_once __DIR__ . '/db.php';

function e(string $value): string
{
    return htmlspecialchars($value, ENT_QUOTES, 'UTF-8');
}

function jsonResponse(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function requireMethod(string $method): void
{
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') !== strtoupper($method)) {
        jsonResponse([
            'ok' => false,
            'message' => 'Method not allowed'
        ], 405);
    }
}

function getJsonInput(): array
{
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

function getAllHeadersSafe(): array
{
    if (function_exists('getallheaders')) {
        $headers = getallheaders();
        if (is_array($headers)) {
            return $headers;
        }
    }

    $headers = [];
    foreach ($_SERVER as $key => $value) {
        if (substr($key, 0, 5) === 'HTTP_') {
            $name = str_replace('_', '-', strtolower(substr($key, 5)));
            $name = ucwords($name, '-');
            $headers[$name] = $value;
        }
    }

    return $headers;
}

function generateWalletUserId(): string
{
    return 'CW' . date('ymd') . strtoupper(bin2hex(random_bytes(3)));
}

function generateTransactionId(): string
{
    return 'CTXN-' . date('YmdHis') . '-' . strtoupper(bin2hex(random_bytes(4)));
}

function moneyFormat(float $amount): string
{
    return number_format($amount, 2);
}

function getSetting(string $key, ?string $default = null): ?string
{
    $stmt = db()->prepare("SELECT setting_value FROM wallet_settings WHERE setting_key = ? LIMIT 1");
    $stmt->execute([$key]);
    $row = $stmt->fetch();
    return $row['setting_value'] ?? $default;
}

function writeApiLog(
    string $endpoint,
    string $requestMethod,
    array $requestHeaders,
    array $requestBody,
    int $responseCode,
    array $responseBody,
    ?string $clientAccessId
): void {
    if (!API_LOGGING_ENABLED) {
        return;
    }

    $stmt = db()->prepare("
        INSERT INTO api_logs (
            endpoint, request_method, request_headers, request_body,
            response_code, response_body, client_access_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    ");

    $stmt->execute([
        $endpoint,
        $requestMethod,
        json_encode($requestHeaders, JSON_UNESCAPED_UNICODE),
        json_encode($requestBody, JSON_UNESCAPED_UNICODE),
        $responseCode,
        json_encode($responseBody, JSON_UNESCAPED_UNICODE),
        $clientAccessId
    ]);
}

function redirect(string $url): void
{
    header('Location: ' . $url);
    exit;
}