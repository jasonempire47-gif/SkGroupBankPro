<?php
declare(strict_types=1);

require_once __DIR__ . '/../inc/auth.php';
adminLogout();
redirect('index.php');