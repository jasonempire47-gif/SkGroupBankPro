<?php
header('Content-Type: application/json');

$input = json_decode(file_get_contents('php://input'), true);

if (!$input) {
    echo json_encode([
        'success' => false,
        'message' => 'Invalid JSON payload'
    ]);
    exit;
}

$spinPortalUrl = "https://millionaireempirereward.com/spin/api/wallet_sync.php";
$apiToken = "YOUR_SECRET_API_TOKEN";

$payload = [
    "wallet_id" => $input["wallet_id"] ?? "",
    "player_id" => $input["player_id"] ?? "",
    "name" => $input["name"] ?? "",
    "phone" => $input["phone"] ?? "",
    "website" => $input["website"] ?? "",
    "group_name" => $input["group_name"] ?? "",
    "portal_username" => $input["portal_username"] ?? "",
    "status" => $input["status"] ?? "active",
    "cash_balance" => $input["cash_balance"] ?? 0,
    "spin_token_balance" => $input["spin_token_balance"] ?? 0,
    "deposit_amount" => $input["deposit_amount"] ?? 0,
    "conversion_rule" => $input["conversion_rule"] ?? "100=1",
    "converted_tokens" => $input["converted_tokens"] ?? 0,
    "last_sync" => $input["last_sync"] ?? "",
    "api_reference" => $input["api_reference"] ?? "",
    "remarks" => $input["remarks"] ?? ""
];

$ch = curl_init($spinPortalUrl);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    "Content-Type: application/json",
    "Authorization: Bearer " . $apiToken
]);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($payload));

$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlError = curl_error($ch);

curl_close($ch);

if ($curlError) {
    echo json_encode([
        "success" => false,
        "message" => $curlError
    ]);
    exit;
}

echo json_encode([
    "success" => $httpCode >= 200 && $httpCode < 300,
    "http_code" => $httpCode,
    "portal_response" => json_decode($response, true) ?: $response
]);