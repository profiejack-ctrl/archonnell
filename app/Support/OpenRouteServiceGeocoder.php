<?php

namespace App\Support;

class OpenRouteServiceGeocoder
{
    public function hasValidLatitude(mixed $latitude): bool
    {
        return is_numeric($latitude)
            && is_finite((float) $latitude)
            && (float) $latitude >= -90
            && (float) $latitude <= 90;
    }

    public function hasValidLongitude(mixed $longitude): bool
    {
        return is_numeric($longitude)
            && is_finite((float) $longitude)
            && (float) $longitude >= -180
            && (float) $longitude <= 180;
    }

    public function hasValidCoordinates(mixed $latitude, mixed $longitude): bool
    {
        return $this->hasValidLatitude($latitude) && $this->hasValidLongitude($longitude);
    }

    public function geocode(string $address): ?array
    {
        $address = trim($address);
        $apiKey = getenv('OPENROUTESERVICE_API_KEY');
        if ($address === '' || $apiKey === false || trim($apiKey) === '' || !function_exists('curl_init')) {
            return null;
        }

        try {
            $url = 'https://api.heigit.org/pelias/v1/search?'
                . http_build_query([
                    'api_key' => $apiKey,
                    'size' => 1,
                    'text' => $address,
                ]);
            $curl = curl_init($url);
            if ($curl === false) {
                return null;
            }

            curl_setopt_array($curl, [
                CURLOPT_HTTPHEADER => ['Accept: application/json'],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_CONNECTTIMEOUT => 10,
                CURLOPT_TIMEOUT => 20,
            ]);

            $responseBody = curl_exec($curl);
            $httpStatus = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
            curl_close($curl);

            if (!is_string($responseBody) || $httpStatus < 200 || $httpStatus >= 300) {
                return null;
            }

            $response = json_decode($responseBody, true);
            $coordinates = $response['features'][0]['geometry']['coordinates'] ?? null;
            if (!is_array($coordinates) || !is_numeric($coordinates[0] ?? null) || !is_numeric($coordinates[1] ?? null)) {
                return null;
            }

            $longitude = (float) $coordinates[0];
            $latitude = (float) $coordinates[1];
            if (!$this->hasValidCoordinates($latitude, $longitude)) {
                return null;
            }

            return ['lat' => $latitude, 'lng' => $longitude];
        } catch (\Throwable) {
            return null;
        }
    }
    public function search(string $query, int $limit = 5): array
    {
        $query = trim($query);
        $apiKey = getenv('OPENROUTESERVICE_API_KEY');
        if (mb_strlen($query) < 2 || $apiKey === false || trim($apiKey) === '' || !function_exists('curl_init')) {
            return [];
        }

        try {
            $url = 'https://api.heigit.org/pelias/v1/autocomplete?' . http_build_query([
                'api_key' => $apiKey,
                'size' => 20,
                'text' => $query,
                'boundary.country' => 'PHL',
            ]);
            $curl = curl_init($url);
            if ($curl === false) return [];
            curl_setopt_array($curl, [CURLOPT_HTTPHEADER => ['Accept: application/json'], CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 5, CURLOPT_TIMEOUT => 10]);
            $body = curl_exec($curl);
            $status = (int) curl_getinfo($curl, CURLINFO_HTTP_CODE);
            curl_close($curl);
            if (!is_string($body) || $status < 200 || $status >= 300) return [];
            $json = json_decode($body, true);
            $results = [];
            foreach (($json['features'] ?? []) as $feature) {
                $coords = $feature['geometry']['coordinates'] ?? null;
                $props = $feature['properties'] ?? [];
                if (!is_array($coords) || !$this->hasValidCoordinates($coords[1] ?? null, $coords[0] ?? null)) continue;
                $label = trim((string) ($props['label'] ?? $props['name'] ?? ''));
                if ($label === '') continue;
                $results[] = ['label' => $label, 'lat' => (float) $coords[1], 'lng' => (float) $coords[0]];
            }
            return $results;
        } catch (\Throwable) {
            return [];
        }
    }

}
