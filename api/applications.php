<?php
session_start();
require_once 'db.php';

header('Content-Type: application/json');

// Authorization: Ensure user is logged in to apply
if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['success' => false, 'message' => 'Unauthorized. Please log in to submit an application.']);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['success' => false, 'message' => 'Invalid request method']);
    exit;
}

$opportunityId = $_POST['opportunityId'] ?? null;
$name = $_POST['name'] ?? '';
$email = $_POST['email'] ?? '';
$course = $_POST['course'] ?? '';
$phone = $_POST['phone'] ?? '';
$motivation = $_POST['motivation'] ?? '';

if (!$opportunityId || !$name || !$email || !$course || !$phone || !$motivation || !isset($_FILES['resume'])) {
    echo json_encode(['success' => false, 'message' => 'Missing required fields']);
    exit;
}

$resume = $_FILES['resume'];
$uploadDir = '../uploads/';
if (!is_dir($uploadDir)) {
    mkdir($uploadDir, 0777, true);
}

$fileName = time() . '_' . basename($resume['name']);
$targetPath = $uploadDir . $fileName;

// Validation (similar to JS but on backend)
if ($resume['size'] > 5 * 1024 * 1024) {
    echo json_encode(['success' => false, 'message' => 'File size exceeds 5MB']);
    exit;
}

$allowedExtensions = ['pdf', 'doc', 'docx'];
$fileExt = strtolower(pathinfo($resume['name'], PATHINFO_EXTENSION));
if (!in_array($fileExt, $allowedExtensions)) {
    echo json_encode(['success' => false, 'message' => 'Invalid file type. Only PDF, DOC, DOCX are allowed.']);
    exit;
}

if (move_uploaded_file($resume['tmp_name'], $targetPath)) {
    try {
        $stmt = $pdo->prepare("INSERT INTO applications (opportunityId, name, email, course, phone, motivation, resumePath) VALUES (?, ?, ?, ?, ?, ?, ?)");
        $stmt->execute([$opportunityId, $name, $email, $course, $phone, $motivation, $fileName]);

        echo json_encode(['success' => true, 'message' => 'Application submitted successfully!']);
    } catch (PDOException $e) {
        echo json_encode(['success' => false, 'message' => 'Database error: ' . $e->getMessage()]);
    }
} else {
    echo json_encode(['success' => false, 'message' => 'Failed to upload resume.']);
}
?>
