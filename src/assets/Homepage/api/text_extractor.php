<?php
require_once __DIR__ . '/config.php';

class ResumeTextExtractor {
    public static function extract($filePath, $fileType) {
        $ext = strtolower(pathinfo($filePath, PATHINFO_EXTENSION));
        $text = '';
        
        try {
            switch ($ext) {
                case 'pdf':
                    $text = self::extractFromPDF($filePath);
                    break;
                case 'docx':
                    $text = self::extractFromDOCX($filePath);
                    break;
                case 'doc':
                    $text = self::extractFromDOC($filePath);
                    break;
                default:
                    $text = '';
            }
        } catch (Exception $e) {
            error_log("Resume extraction error: " . $e->getMessage());
            $text = '';
        }
        
        $text = self::cleanText($text);
        return $text;
    }

    private static function extractFromPDF($filePath) {
        if (!file_exists($filePath) || filesize($filePath) === 0) {
            return '';
        }

        $text = '';
        
        $content = file_get_contents($filePath);
        if (preg_match_all('/BT\s*(.*?)\s*ET/s', $content, $matches)) {
            foreach ($matches[1] as $match) {
                if (preg_match_all('/\(([^)]*)\)/', $match, $textMatches)) {
                    $text .= implode(' ', $textMatches[1]) . "\n";
                }
                if (preg_match_all('/\[([^\]]*)\]/', $match, $arrayMatches)) {
                    foreach ($arrayMatches[1] as $arr) {
                        if (preg_match_all('/\(([^)]*)\)/', $arr, $t)) {
                            $text .= implode('', $t[1]) . " ";
                        }
                    }
                }
            }
        }
        
        $text = preg_replace('/\\\\[a-zA-Z0-9]+/', ' ', $text);
        $text = preg_replace('/\s+/', ' ', $text);
        return trim($text);
    }

    private static function extractFromDOCX($filePath) {
        if (!file_exists($filePath) || filesize($filePath) === 0) {
            return '';
        }

        $text = '';
        $zip = @zip_open($filePath);
        
        if (is_resource($zip)) {
            while ($entry = zip_read($zip)) {
                $entryName = zip_entry_name($entry);
                if ($entryName === 'word/document.xml') {
                    if (zip_entry_open($zip, $entry, "r")) {
                        $content = zip_entry_read($entry, zip_entry_filesize($entry));
                        zip_entry_close($entry);
                        
                        $content = preg_replace('/<w:tab[^>]*>/', "\t", $content);
                        $content = preg_replace('/<w:br[^>]*\/>/', "\n", $content);
                        $content = preg_replace('/<\/w:p>/', "\n", $content);
                        $content = strip_tags($content);
                        $content = html_entity_decode($content, ENT_QUOTES, 'UTF-8');
                        $text .= $content;
                    }
                    break;
                }
            }
            zip_close($zip);
        }
        
        return $text;
    }

    private static function extractFromDOC($filePath) {
        if (!file_exists($filePath) || filesize($filePath) === 0) {
            return '';
        }

        $content = file_get_contents($filePath);
        $text = '';
        
        $content = substr($content, strpos($content, 'WordDocument.8') ?: 0);
        $text = preg_replace('/[^a-zA-Z0-9\s\.,;:!?@#$%&*()\-_+=\/\\\[\]{}"\'<>]/', ' ', $content);
        $text = preg_replace('/\s+/', ' ', $text);
        
        return trim($text);
    }

    private static function cleanText($text) {
        if (empty($text)) return '';
        
        $text = preg_replace('/[[:cntrl:]]/', ' ', $text);
        $text = preg_replace('/\s{2,}/', ' ', $text);
        $text = preg_replace('/[^\x20-\x7E\xC0-\xFF]/', ' ', $text);
        $text = trim($text);
        
        if (strlen($text) < 50) {
            return '';
        }
        
        return substr($text, 0, 15000);
    }
}
