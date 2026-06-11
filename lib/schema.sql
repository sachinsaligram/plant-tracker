CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT,
  email TEXT UNIQUE NOT NULL,
  image TEXT
);

CREATE TABLE IF NOT EXISTS soils (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  brand TEXT,
  type TEXT NOT NULL CHECK(type IN ('potting mix','cactus mix','orchid mix','custom')),
  mix_description TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS plants (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  common_name TEXT NOT NULL,
  scientific_name TEXT,
  soil_id TEXT REFERENCES soils(id),
  location TEXT NOT NULL CHECK(location IN ('indoor','outdoor','balcony','greenhouse')),
  watering_interval_days INTEGER NOT NULL,
  repotting_interval_days INTEGER NOT NULL,
  fertilizing_interval_days INTEGER NOT NULL,
  last_watered_at TEXT,
  last_repotted_at TEXT,
  last_fertilized_at TEXT,
  next_watering_at TEXT,
  next_repotting_at TEXT,
  next_fertilizing_at TEXT,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS plant_photos (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  blob_url TEXT NOT NULL,
  taken_at TEXT NOT NULL DEFAULT (datetime('now')),
  is_primary INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS care_logs (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK(type IN ('water','repot')),
  logged_at TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS fertilizers (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  brand TEXT,
  product_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('liquid','granular','slow-release','organic','spike')),
  npk_ratio TEXT,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS fertilizer_logs (
  id TEXT PRIMARY KEY,
  plant_id TEXT NOT NULL REFERENCES plants(id) ON DELETE CASCADE,
  fertilizer_id TEXT REFERENCES fertilizers(id),
  fed_at TEXT NOT NULL DEFAULT (datetime('now')),
  dosage REAL,
  dosage_unit TEXT CHECK(dosage_unit IN ('ml','g','tsp')),
  notes TEXT
);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
