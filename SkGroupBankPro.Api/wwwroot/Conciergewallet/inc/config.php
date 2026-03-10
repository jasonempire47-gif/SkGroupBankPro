<?php
declare(strict_types=1);

define('APP_NAME', 'ConciergeWallet');

define('DB_HOST', 'localhost');
define('DB_NAME', 'conciergewallet_db');
define('DB_USER', 'root');
define('DB_PASS', '');

define('APP_TIMEZONE', 'Asia/Manila');
define('APP_CURRENCY', 'PHP');

define('API_LOGGING_ENABLED', true);

date_default_timezone_set(APP_TIMEZONE);
session_start();