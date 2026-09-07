<?php
session_start();
require_once 'db.php';

header('Content-Type: application/json');

$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true);

if ($action === 'register') {
    $fullName = $input['fullName'] ?? '';
    $email = $input['email'] ?? '';
    $course = $input['course'] ?? '';
    $phone = $input['phone'] ?? '';
    $password = $input['password'] ?? '';

    if (!$fullName || !$email || !$course || !$phone || !$password) {
        echo json_encode(['success' => false, 'message' => 'Missing fields']);
        exit;
    }

    $hashedPassword = password_hash($password, PASSWORD_DEFAULT);

    try {
        $stmt = $pdo->prepare("INSERT INTO users (fullName, email, course, phone, password) VALUES (?, ?, ?, ?, ?) RETURNING id");
        $stmt->execute([$fullName, $email, $course, $phone, $hashedPassword]);

        $userId = $stmt->fetchColumn();
        $_SESSION['user_id'] = $userId;
        $_SESSION['email'] = $email;

        echo json_encode(['success' => true, 'message' => 'Registration successful']);
    } catch (PDOException $e) {
        // PostgreSQL unique violation code is 23505
        if ($e->getCode() == '23505') {
            echo json_encode(['success' => false, 'message' => 'Email already registered']);
        } else {
            echo json_encode(['success' => false, 'message' => 'Registration failed: ' . $e->getMessage()]);
        }
    }
} elseif ($action === 'login') {
    $email = $input['email'] ?? '';
    $password = $input['password'] ?? '';

    if (!$email || !$password) {
        echo json_encode(['success' => false, 'message' => 'Missing fields']);
        exit;
    }

    $stmt = $pdo->prepare("SELECT * FROM users WHERE email = ?");
    $stmt->execute([$email]);
    $user = $stmt->fetch();

    if ($user && password_verify($password, $user['password'])) {
        $_SESSION['user_id'] = $user['id'];
        $_SESSION['email'] = $user['email'];
        echo json_encode(['success' => true, 'message' => 'Login successful']);
    } else {
        echo json_encode(['success' => false, 'message' => 'Invalid email or password']);
    }
} elseif ($action === 'me') {
    if (isset($_SESSION['user_id'])) {
        $stmt = $pdo->prepare("SELECT fullName, email, course, phone FROM users WHERE id = ?");
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
        echo json_encode(['loggedIn' => true, 'user' => $user]);
    } else {
        echo json_encode(['loggedIn' => false]);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Invalid action']);
}
?>
