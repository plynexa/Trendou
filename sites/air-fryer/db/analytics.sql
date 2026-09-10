-- Run once in the Neon SQL Editor before enabling analytics.
CREATE TABLE IF NOT EXISTS trendou_visits (
 id uuid PRIMARY KEY, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(),
 source varchar(80) NOT NULL, campaign varchar(80) NOT NULL, creative varchar(80) NOT NULL,
 device varchar(12) NOT NULL, active_seconds integer NOT NULL DEFAULT 0 CHECK(active_seconds BETWEEN 0 AND 7200),
 scroll integer NOT NULL DEFAULT 0 CHECK(scroll BETWEEN 0 AND 100),
 sections jsonb NOT NULL DEFAULT '[]', clicks jsonb NOT NULL DEFAULT '[]', checkout boolean NOT NULL DEFAULT false,
 updates integer NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS trendou_visits_created ON trendou_visits(created_at);
-- Only the backend's dedicated database role should access this table.
REVOKE ALL ON trendou_visits FROM PUBLIC;
