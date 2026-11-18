<?php
require_once __DIR__ . '/config.php';

class Database {
    private static $instance = null;
    private $pdo;
    private $connectionError = null;

    private static function connect(string $database): PDO {
        $dsn = "pgsql:host=" . DB_HOST . ";port=" . DB_PORT . ";dbname=" . $database;
        $pdo = new PDO($dsn, DB_USER, (string)DB_PASS, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES => false,
            PDO::ATTR_PERSISTENT => false,
        ]);
        $pdo->exec("SET TIME ZONE 'Asia/Manila'");
        return $pdo;
    }

    private function __construct() {
        try {
            $this->pdo = self::connect(DB_NAME);
        } catch (PDOException $e) {
            // SQLSTATE 3D000 = database does not exist (MySQL: "Unknown database").
            if ($e->getCode() === '3D000' || strpos($e->getMessage(), 'does not exist') !== false) {
                try {
                    $admin = self::connect('postgres');
                    $admin->exec('CREATE DATABASE "' . str_replace('"', '""', DB_NAME) . "\" ENCODING 'UTF8' TEMPLATE template0");
                    $admin->exec('ALTER DATABASE "' . str_replace('"', '""', DB_NAME) . "\" SET timezone TO 'Asia/Manila'");
                    $admin = null;
                    $this->pdo = self::connect(DB_NAME);
                } catch (PDOException $e2) {
                    $this->connectionError = $e2->getMessage();
                    error_log("Database connection failed: " . $e2->getMessage());
                    if (is_ajax_request()) {
                        while (ob_get_level()) { ob_end_clean(); }
                        header('Content-Type: application/json');
                        echo json_encode([
                            'success' => false,
                            'message' => 'Database connection failed. Please contact administrator or run setup.php.'
                        ]);
                        exit;
                    }
                }
            } else {
                $this->connectionError = $e->getMessage();
                error_log("Database connection failed: " . $e->getMessage());
                if (is_ajax_request()) {
                    while (ob_get_level()) { ob_end_clean(); }
                    header('Content-Type: application/json');
                    echo json_encode([
                        'success' => false,
                        'message' => 'Database connection failed. Please contact administrator or run setup.php.'
                    ]);
                    exit;
                }
            }
        }
    }

    public function hasError() {
        return $this->connectionError !== null;
    }

    public function getError() {
        return $this->connectionError;
    }

    public static function getInstance() {
        if (self::$instance === null) {
            self::$instance = new self();
        }
        return self::$instance;
    }

    public function getConnection() {
        if ($this->pdo === null) {
            if (is_ajax_request()) {
                while (ob_get_level()) { ob_end_clean(); }
                header('Content-Type: application/json');
                echo json_encode([
                    'success' => false,
                    'message' => 'Database connection unavailable. Please run setup.php or contact administrator.'
                ]);
                exit;
            }
            throw new Exception("Database connection unavailable: " . ($this->connectionError ?? 'Unknown error'));
        }
        return $this->pdo;
    }

    public function beginTransaction() {
        return $this->pdo->beginTransaction();
    }

    public function commit() {
        return $this->pdo->commit();
    }

    public function rollBack() {
        return $this->pdo->rollBack();
    }

    public function query($sql, $params = []) {
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        return $stmt;
    }

    public function fetchAll($sql, $params = []) {
        $stmt = $this->query($sql, $params);
        return $stmt->fetchAll();
    }

    public function fetchOne($sql, $params = []) {
        $stmt = $this->query($sql, $params);
        return $stmt->fetch();
    }

    public function insert($table, $data) {
        $fields = array_keys($data);
        $placeholders = array_map(function($f) { return ':' . $f; }, $fields);
        $sql = "INSERT INTO {$table} (" . implode(', ', $fields) . ") VALUES (" . implode(', ', $placeholders) . ")";
        $this->query($sql, $data);
        return $this->pdo->lastInsertId();
    }

    public function update($table, $data, $where, $whereParams = []) {
        $fields = array_keys($data);
        $set = implode(' = ?, ', $fields) . ' = ?';
        $sql = "UPDATE {$table} SET {$set} WHERE {$where}";
        $params = array_values($data);
        foreach ($whereParams as $wp) {
            $params[] = $wp;
        }
        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute($params);
    }

    public function delete($table, $where, $params = []) {
        $sql = "DELETE FROM {$table} WHERE {$where}";
        $stmt = $this->pdo->prepare($sql);
        return $stmt->execute($params);
    }
}

function db() {
    return Database::getInstance();
}

function pdo() {
    return Database::getInstance()->getConnection();
}
