-- Option 1: Combined Summary by Session
SELECT 
    s.session_id,
    s.user_id,
    pv.page_views,
    c.total_clicks,
    se.max_scroll_depth,
    s.duration as session_duration,
    pv.first_page,
    pv.last_page
FROM analytics.sessions s
LEFT JOIN (
    SELECT 
        session_id,
        COUNT(*) as page_views,
        min(page_url) as first_page,
        max(page_url) as last_page
    FROM analytics.page_views 
    GROUP BY session_id
) pv ON s.session_id = pv.session_id
LEFT JOIN (
    SELECT 
        session_id,
        COUNT(*) as total_clicks
    FROM analytics.clicks 
    GROUP BY session_id
) c ON s.session_id = c.session_id
LEFT JOIN (
    SELECT 
        session_id,
        MAX(max_scroll_depth) as max_scroll_depth
    FROM analytics.scroll_events 
    GROUP BY session_id
) se ON s.session_id = se.session_id
ORDER BY s.start_time DESC
LIMIT 10;

-- Option 2: Daily Analytics Summary
SELECT 
    toDate(timestamp) as date,
    'page_views' as event_type,
    COUNT(*) as count,
    COUNT(DISTINCT session_id) as unique_sessions,
    COUNT(DISTINCT user_id) as unique_users
FROM analytics.page_views 
WHERE timestamp >= now() - INTERVAL 7 DAY
GROUP BY toDate(timestamp)

UNION ALL

SELECT 
    toDate(timestamp) as date,
    'clicks' as event_type,
    COUNT(*) as count,
    COUNT(DISTINCT session_id) as unique_sessions,
    COUNT(DISTINCT user_id) as unique_users
FROM analytics.clicks 
WHERE timestamp >= now() - INTERVAL 7 DAY
GROUP BY toDate(timestamp)

UNION ALL

SELECT 
    toDate(timestamp) as date,
    'scroll_events' as event_type,
    COUNT(*) as count,
    COUNT(DISTINCT session_id) as unique_sessions,
    COUNT(DISTINCT user_id) as unique_users
FROM analytics.scroll_events 
WHERE timestamp >= now() - INTERVAL 7 DAY
GROUP BY toDate(timestamp)

ORDER BY date DESC, event_type;

-- Option 3: Real-time Dashboard Query
SELECT 
    (SELECT COUNT(*) FROM analytics.page_views WHERE timestamp >= now() - INTERVAL 1 HOUR) as page_views_last_hour,
    (SELECT COUNT(*) FROM analytics.clicks WHERE timestamp >= now() - INTERVAL 1 HOUR) as clicks_last_hour,
    (SELECT COUNT(*) FROM analytics.scroll_events WHERE timestamp >= now() - INTERVAL 1 HOUR) as scroll_events_last_hour,
    (SELECT COUNT(DISTINCT session_id) FROM analytics.page_views WHERE timestamp >= now() - INTERVAL 1 HOUR) as active_sessions,
    (SELECT COUNT(DISTINCT user_id) FROM analytics.page_views WHERE timestamp >= now() - INTERVAL 1 HOUR) as active_users,
    (SELECT AVG(max_scroll_depth) FROM analytics.scroll_events WHERE timestamp >= now() - INTERVAL 1 HOUR) as avg_scroll_depth;

-- Option 4: User Journey Analysis
WITH user_events AS (
    SELECT 
        session_id, 
        user_id, 
        'page_view' as event_type,
        page_url as details,
        timestamp
    FROM analytics.page_views
    
    UNION ALL
    
    SELECT 
        session_id, 
        user_id, 
        'click' as event_type,
        concat(element_type, ' - ', element_text) as details,
        timestamp
    FROM analytics.clicks
    
    UNION ALL
    
    SELECT 
        session_id, 
        user_id, 
        'scroll' as event_type,
        concat('Depth: ', toString(scroll_depth_percent), '%') as details,
        timestamp
    FROM analytics.scroll_events
)
SELECT 
    session_id,
    user_id,
    event_type,
    details,
    timestamp,
    row_number() OVER (PARTITION BY session_id ORDER BY timestamp) as event_sequence
FROM user_events
WHERE session_id = 'YOUR_SESSION_ID'  -- Replace with actual session ID
ORDER BY timestamp;

-- Option 5: Comprehensive Analytics Report
SELECT 
    'Today' as period,
    (SELECT COUNT(*) FROM analytics.page_views WHERE toDate(timestamp) = today()) as page_views,
    (SELECT COUNT(*) FROM analytics.clicks WHERE toDate(timestamp) = today()) as clicks,
    (SELECT COUNT(*) FROM analytics.scroll_events WHERE toDate(timestamp) = today()) as scroll_events,
    (SELECT COUNT(DISTINCT session_id) FROM analytics.page_views WHERE toDate(timestamp) = today()) as sessions,
    (SELECT COUNT(DISTINCT user_id) FROM analytics.page_views WHERE toDate(timestamp) = today()) as users,
    (SELECT AVG(duration) FROM analytics.sessions WHERE toDate(start_time) = today()) as avg_session_duration

UNION ALL

SELECT 
    'Yesterday' as period,
    (SELECT COUNT(*) FROM analytics.page_views WHERE toDate(timestamp) = yesterday()) as page_views,
    (SELECT COUNT(*) FROM analytics.clicks WHERE toDate(timestamp) = yesterday()) as clicks,
    (SELECT COUNT(*) FROM analytics.scroll_events WHERE toDate(timestamp) = yesterday()) as scroll_events,
    (SELECT COUNT(DISTINCT session_id) FROM analytics.page_views WHERE toDate(timestamp) = yesterday()) as sessions,
    (SELECT COUNT(DISTINCT user_id) FROM analytics.page_views WHERE toDate(timestamp) = yesterday()) as users,
    (SELECT AVG(duration) FROM analytics.sessions WHERE toDate(start_time) = yesterday()) as avg_session_duration

UNION ALL

SELECT 
    'Last 7 Days' as period,
    (SELECT COUNT(*) FROM analytics.page_views WHERE timestamp >= now() - INTERVAL 7 DAY) as page_views,
    (SELECT COUNT(*) FROM analytics.clicks WHERE timestamp >= now() - INTERVAL 7 DAY) as clicks,
    (SELECT COUNT(*) FROM analytics.scroll_events WHERE timestamp >= now() - INTERVAL 7 DAY) as scroll_events,
    (SELECT COUNT(DISTINCT session_id) FROM analytics.page_views WHERE timestamp >= now() - INTERVAL 7 DAY) as sessions,
    (SELECT COUNT(DISTINCT user_id) FROM analytics.page_views WHERE timestamp >= now() - INTERVAL 7 DAY) as users,
    (SELECT AVG(duration) FROM analytics.sessions WHERE start_time >= now() - INTERVAL 7 DAY) as avg_session_duration;