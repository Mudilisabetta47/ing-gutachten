-- Haertung fuer Supabase (und jede Datenbank mit API-Rollen `anon`/`authenticated`).
--
-- Problem: Supabase stellt das Schema `public` ueber eine oeffentliche Data-API (PostgREST) bereit. Neue Tabellen
-- bekommen dort standardmaessig Rechte fuer `anon`/`authenticated`. Mit dem oeffentlichen API-Schluessel koennte
-- jeder Kundendaten lesen oder aendern, sobald Row Level Security (RLS) fehlt.
--
-- Loesung: RLS auf ALLEN Tabellen aktivieren (ohne Policies = nichts erlaubt) UND die Rechte der API-Rollen entziehen.
-- Unsere App verbindet sich als Datenbank-Eigentuemer und ist davon nicht betroffen (umgeht RLS).
-- Auf Datenbanken ohne diese Rollen (lokal, Tests) bewirkt die Funktion nichts.
--
-- Fuer JEDE kuenftige Migration, die Tabellen anlegt, am Ende:   SELECT public.ing_harden_public();

CREATE OR REPLACE FUNCTION public.ing_harden_public() RETURNS void
LANGUAGE plpgsql
AS $fn$
DECLARE
  api_roles text[] := ARRAY(SELECT rolname::text FROM pg_roles WHERE rolname IN ('anon', 'authenticated'));
  r record;
  role_list text;
BEGIN
  IF coalesce(array_length(api_roles, 1), 0) = 0 THEN
    RETURN;
  END IF;
  SELECT string_agg(quote_ident(x), ', ') INTO role_list FROM unnest(api_roles) AS x;

  FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', r.tablename);
  END LOOP;

  EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %s', role_list);
  EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %s', role_list);
  EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %s', role_list);
  -- Auch fuer kuenftig angelegte Objekte (gilt fuer die Rolle, die die Migration ausfuehrt)
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %s', role_list);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %s', role_list);
  EXECUTE format('ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON FUNCTIONS FROM %s', role_list);
END
$fn$;

-- Die Funktion selbst ist keine API (sonst waere sie per RPC aufrufbar).
REVOKE ALL ON FUNCTION public.ing_harden_public() FROM PUBLIC;

SELECT public.ing_harden_public();
