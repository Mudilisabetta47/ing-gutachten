-- Datei-Import (CSV/JSON) als interne Quelle, damit Importläufe einer Quelle zugeordnet werden können
INSERT INTO "vehicle_providers" ("key", "name", "kind", "description", "enabled", "license_status", "updated_at")
VALUES ('IMPORT_FILE', 'Datei-Import', 'internal', 'Vom Betreiber bereitgestellte CSV-/JSON-Dateien. Datensätze bleiben „nicht verifiziert“, bis sie geprüft sind.', true, 'LICENSED', now())
ON CONFLICT ("key") DO NOTHING;
