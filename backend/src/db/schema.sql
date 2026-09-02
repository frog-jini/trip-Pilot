CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 구글/카카오 같은 소셜 로그인 계정 식별자. 이메일/비밀번호로 가입한 계정은 둘 다 NULL이다.
-- provider_id는 각 서비스가 발급하는 고유 사용자 ID(구글의 "sub" 등)로, 이메일이 바뀌어도 값이
-- 유지되므로 이 조합으로 계정을 찾는다.
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS provider_id TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS users_provider_identity_idx ON users(provider, provider_id) WHERE provider IS NOT NULL;

-- 구글의 name/카카오의 nickname을 그대로 저장해둔다. 이메일/비밀번호 가입 계정은 NULL — 화면은
-- nickname이 있으면 그걸, 없으면 email로 대신 표시한다(Header.tsx 참고).
ALTER TABLE users ADD COLUMN IF NOT EXISTS nickname TEXT;

CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  itinerary JSONB NOT NULL,
  form_values JSONB NOT NULL,
  history JSONB NOT NULL,
  costs JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS trips_user_id_idx ON trips(user_id);

-- 활동별로 사용자가 직접 지정한 시간: { [일자]: { [활동명]: "HH:MM" } }.
-- 값이 없는 활동은 프론트에서 자동 계산한 시간으로 표시된다.
ALTER TABLE trips ADD COLUMN IF NOT EXISTS times JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS favorites (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  destination TEXT NOT NULL,
  activity TEXT NOT NULL,
  UNIQUE (user_id, destination, activity)
);

CREATE INDEX IF NOT EXISTS favorites_user_id_idx ON favorites(user_id);

CREATE TABLE IF NOT EXISTS community_trip_likes (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  community_trip_id TEXT NOT NULL,
  PRIMARY KEY (user_id, community_trip_id)
);

CREATE TABLE IF NOT EXISTS community_trip_views (
  community_trip_id TEXT PRIMARY KEY,
  view_count INTEGER NOT NULL DEFAULT 0
);

-- A user's own trip, shared to the community. community_trip_likes/views intentionally keep
-- referencing community_trip_id as a plain TEXT (no FK here) rather than being tied to this
-- table, since likes/views also need to work for future non-DB-backed sample trips.
CREATE TABLE IF NOT EXISTS community_trips (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  source_trip_id TEXT REFERENCES trips(id) ON DELETE SET NULL,
  author TEXT NOT NULL,
  tag TEXT NOT NULL,
  itinerary JSONB NOT NULL,
  seed_likes INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (source_trip_id)
);

CREATE INDEX IF NOT EXISTS community_trips_user_id_idx ON community_trips(user_id);

ALTER TABLE community_trips ADD COLUMN IF NOT EXISTS seed_likes INTEGER NOT NULL DEFAULT 0;
