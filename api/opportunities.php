<?php
require_once 'db.php';

header('Content-Type: application/json');

$id = $_GET['id'] ?? null;
$keyword = $_GET['keyword'] ?? '';
$type = $_GET['type'] ?? '';
$location = $_GET['location'] ?? '';

if ($id) {
    $stmt = $pdo->prepare("SELECT * FROM opportunities WHERE id = ?");
    $stmt->execute([$id]);
    $opportunity = $stmt->fetch();

    if ($opportunity) {
        $opportunity['requirements'] = explode("\n", $opportunity['requirements']);
        echo json_encode(['success' => true, 'opportunity' => $opportunity]);
    } else {
        echo json_encode(['success' => false, 'message' => 'Opportunity not found']);
    }
} else {
    $query = "SELECT * FROM opportunities WHERE 1=1";
    $params = [];

    if ($keyword) {
        $query .= " AND (title ILIKE ? OR company ILIKE ? OR description ILIKE ?)";
        $params[] = "%$keyword%";
        $params[] = "%$keyword%";
        $params[] = "%$keyword%";
    }
    if ($type) {
        $query .= " AND type = ?";
        $params[] = $type;
    }
    if ($location) {
        $query .= " AND location ILIKE ?";
        $params[] = "%$location%";
    }

    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $opportunities = $stmt->fetchAll();

    foreach ($opportunities as &$o) {
        $o['requirements'] = explode("\n", $o['requirements']);
    }

    echo json_encode(['success' => true, 'opportunities' => $opportunities]);
}
?>
