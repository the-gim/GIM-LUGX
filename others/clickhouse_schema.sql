-- Connect to ClickHouse and run these commands
-- kubectl exec -it deployment/clickhouse -- clickhouse-client

-- Create database
CREATE DATABASE IF NOT EXISTS analytics;
USE analytics;

-- Page Views Table
CREATE TABLE IF NOT EXISTS page_views (
    id UUID DEFAULT generateUUIDv4(),
    session_id String,
    user_id String,
    page_url String,
    page_title String,
    referrer String,
    user_agent String,
    ip_address String,
    timestamp DateTime DEFAULT now(),
    load_time Float32
) ENGINE = MergeTree()
ORDER BY (timestamp, session_id)
PARTITION BY toYYYYMM(timestamp);

-- Clicks Table
CREATE TABLE IF NOT EXISTS clicks (
    id UUID DEFAULT generateUUIDv4(),
    session_id String,
    user_id String,
    page_url String,
    element_type String,
    element_id String,
    element_class String,
    element_text String,
    click_x Int32,
    click_y Int32,
    timestamp DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (timestamp, session_id)
PARTITION BY toYYYYMM(timestamp);

-- Scroll Depth Table
CREATE TABLE IF NOT EXISTS scroll_events (
    id UUID DEFAULT generateUUIDv4(),
    session_id String,
    user_id String,
    page_url String,
    scroll_depth_percent Float32,
    max_scroll_depth Float32,
    page_height Int32,
    viewport_height Int32,
    timestamp DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (timestamp, session_id)
PARTITION BY toYYYYMM(timestamp);

-- Session Analytics Table
CREATE TABLE IF NOT EXISTS sessions (
    session_id String,
    user_id String,
    start_time DateTime,
    end_time DateTime,
    duration Int32,
    page_count Int32,
    total_clicks Int32,
    bounce_rate Float32,
    device_type String,
    browser String,
    os String,
    country String
) ENGINE = ReplacingMergeTree()
ORDER BY session_id
PARTITION BY toYYYYMM(start_time);