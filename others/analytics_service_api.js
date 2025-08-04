const express = require('express');
const { createClient } = require('@clickhouse/client');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 8080;

// ClickHouse client setup
const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://clickhouse-service:8123'
});

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Analytics endpoint
app.post('/api/analytics', async (req, res) => {
    try {
        const eventData = req.body;
        const { type } = eventData;

        switch (type) {
            case 'page_view':
                await insertPageView(eventData);
                break;
            case 'click':
                await insertClick(eventData);
                break;
            case 'scroll':
                await insertScrollEvent(eventData);
                break;
            case 'session_end':
                await insertOrUpdateSession(eventData);
                break;
            default:
                console.log('Unknown event type:', type);
        }

        res.json({ success: true, message: 'Event tracked successfully' });
    } catch (error) {
        console.error('Error tracking event:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Insert page view
async function insertPageView(data) {
    const query = `
        INSERT INTO analytics.page_views 
        (session_id, user_id, page_url, page_title, referrer, user_agent, ip_address, load_time)
        VALUES ({session_id:String}, {user_id:String}, {page_url:String}, {page_title:String}, 
                {referrer:String}, {user_agent:String}, {ip_address:String}, {load_time:Float32})
    `;
    
    await clickhouse.exec({
        query,
        values: {
            session_id: data.session_id,
            user_id: data.user_id,
            page_url: data.page_url,
            page_title: data.page_title,
            referrer: data.referrer || '',
            user_agent: data.user_agent,
            ip_address: data.ip_address || '0.0.0.0',
            load_time: data.load_time || 0
        }
    });
}

// Insert click event
async function insertClick(data) {
    const query = `
        INSERT INTO analytics.clicks 
        (session_id, user_id, page_url, element_type, element_id, element_class, 
         element_text, click_x, click_y)
        VALUES ({session_id:String}, {user_id:String}, {page_url:String}, {element_type:String},
                {element_id:String}, {element_class:String}, {element_text:String}, 
                {click_x:Int32}, {click_y:Int32})
    `;
    
    await clickhouse.exec({
        query,
        values: {
            session_id: data.session_id,
            user_id: data.user_id,
            page_url: data.page_url,
            element_type: data.element_type,
            element_id: data.element_id || '',
            element_class: data.element_class || '',
            element_text: data.element_text || '',
            click_x: data.click_x,
            click_y: data.click_y
        }
    });
}

// Insert scroll event
async function insertScrollEvent(data) {
    const query = `
        INSERT INTO analytics.scroll_events 
        (session_id, user_id, page_url, scroll_depth_percent, max_scroll_depth, 
         page_height, viewport_height)
        VALUES ({session_id:String}, {user_id:String}, {page_url:String}, 
                {scroll_depth_percent:Float32}, {max_scroll_depth:Float32}, 
                {page_height:Int32}, {viewport_height:Int32})
    `;
    
    await clickhouse.exec({
        query,
        values: {
            session_id: data.session_id,
            user_id: data.user_id,
            page_url: data.page_url,
            scroll_depth_percent: data.scroll_depth_percent,
            max_scroll_depth: data.max_scroll_depth,
            page_height: data.page_height,
            viewport_height: data.viewport_height
        }
    });
}

// Insert or update session
async function insertOrUpdateSession(data) {
    const query = `
        INSERT INTO analytics.sessions 
        (session_id, user_id, start_time, end_time, duration, page_count, total_clicks)
        VALUES ({session_id:String}, {user_id:String}, {start_time:DateTime}, 
                {end_time:DateTime}, {duration:Int32}, {page_count:Int32}, {total_clicks:Int32})
    `;
    
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - (data.duration * 1000));
    
    await clickhouse.exec({
        query,
        values: {
            session_id: data.session_id,
            user_id: data.user_id,
            start_time: startTime.toISOString(),
            end_time: endTime.toISOString(),
            duration: data.duration,
            page_count: 1, // You can track this more accurately
            total_clicks: data.click_count
        }
    });
}

// Analytics dashboard endpoint
app.get('/api/dashboard', async (req, res) => {
    try {
        const [pageViews, topPages, clickStats, scrollStats] = await Promise.all([
            getPageViewStats(),
            getTopPages(),
            getClickStats(),
            getScrollStats()
        ]);

        res.json({
            pageViews,
            topPages,
            clickStats,
            scrollStats
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: error.message });
    }
});

async function getPageViewStats() {
    const result = await clickhouse.query({
        query: `
            SELECT 
                COUNT(*) as total_views,
                COUNT(DISTINCT session_id) as unique_sessions,
                COUNT(DISTINCT user_id) as unique_users
            FROM analytics.page_views 
            WHERE timestamp >= now() - INTERVAL 24 HOUR
        `
    });
    return await result.json();
}

async function getTopPages() {
    const result = await clickhouse.query({
        query: `
            SELECT 
                page_url,
                COUNT(*) as views
            FROM analytics.page_views 
            WHERE timestamp >= now() - INTERVAL 24 HOUR
            GROUP BY page_url 
            ORDER BY views DESC 
            LIMIT 10
        `
    });
    return await result.json();
}

async function getClickStats() {
    const result = await clickhouse.query({
        query: `
            SELECT 
                element_type,
                COUNT(*) as clicks
            FROM analytics.clicks 
            WHERE timestamp >= now() - INTERVAL 24 HOUR
            GROUP BY element_type 
            ORDER BY clicks DESC
        `
    });
    return await result.json();
}

async function getScrollStats() {
    const result = await clickhouse.query({
        query: `
            SELECT 
                AVG(max_scroll_depth) as avg_scroll_depth,
                COUNT(*) as scroll_events
            FROM analytics.scroll_events 
            WHERE timestamp >= now() - INTERVAL 24 HOUR
        `
    });
    return await result.json();
}

app.listen(port, () => {
    console.log(`Analytics service running on port ${port}`);
    console.log(`ClickHouse URL: ${process.env.CLICKHOUSE_URL || 'http://clickhouse-service:8123'}`);
});