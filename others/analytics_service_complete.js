const express = require('express');
const cors = require('cors');
const { createClient } = require('@clickhouse/client');

const app = express();
const port = process.env.PORT || 8080;

// ClickHouse client
const clickhouse = createClient({
    url: process.env.CLICKHOUSE_URL || 'http://clickhouse-service:8123'
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.text());

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        clickhouse_url: process.env.CLICKHOUSE_URL || 'http://clickhouse-service:8123'
    });
});

// Test ClickHouse connection
app.get('/test-clickhouse', async (req, res) => {
    try {
        const result = await clickhouse.query({
            query: 'SELECT version()'
        });
        const data = await result.json();
        res.json({ success: true, clickhouse_version: data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Analytics endpoint
app.post('/api/analytics', async (req, res) => {
    try {
        const eventData = req.body;
        console.log('Received analytics event:', eventData.type, eventData);

        switch (eventData.type) {
            case 'page_view':
                await insertPageView(eventData);
                break;
            case 'click':
                await insertClick(eventData);
                break;
            case 'scroll':
                await insertScrollEvent(eventData);
                break;
            default:
                console.log('Unknown event type:', eventData.type);
        }

        res.json({ success: true, message: 'Event tracked' });
    } catch (error) {
        console.error('Analytics error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Direct ClickHouse insert endpoint (for testing)
app.post('/direct-insert', async (req, res) => {
    try {
        const query = req.body;
        await clickhouse.exec({ query });
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Insert functions
async function insertPageView(data) {
    const query = `
        INSERT INTO analytics.page_views 
        (session_id, user_id, page_url, page_title, referrer, user_agent, timestamp)
        VALUES ('${data.session_id}', '${data.user_id}', '${data.page_url}', 
                '${data.page_title}', '${data.referrer || ''}', '${data.user_agent || ''}', now())
    `;
    await clickhouse.exec({ query });
    console.log('Page view inserted:', data.session_id);
}

async function insertClick(data) {
    const query = `
        INSERT INTO analytics.clicks 
        (session_id, user_id, page_url, element_type, element_text, click_x, click_y, timestamp)
        VALUES ('${data.session_id}', '${data.user_id}', '${data.page_url}', 
                '${data.element_type}', '${data.element_text || ''}', ${data.click_x}, ${data.click_y}, now())
    `;
    await clickhouse.exec({ query });
    console.log('Click inserted:', data.session_id);
}

async function insertScrollEvent(data) {
    const query = `
        INSERT INTO analytics.scroll_events 
        (session_id, user_id, page_url, scroll_depth_percent, page_height, viewport_height, timestamp)
        VALUES ('${data.session_id}', '${data.user_id}', '${data.page_url}', 
                ${data.scroll_depth_percent}, ${data.page_height}, ${data.viewport_height}, now())
    `;
    await clickhouse.exec({ query });
    console.log('Scroll event inserted:', data.session_id);
}

// Dashboard endpoint
app.get('/api/dashboard', async (req, res) => {
    try {
        const stats = await getDashboardStats();
        res.json(stats);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

async function getDashboardStats() {
    const query = `
        SELECT 
            (SELECT COUNT(*) FROM analytics.page_views) as total_page_views,
            (SELECT COUNT(*) FROM analytics.clicks) as total_clicks,
            (SELECT COUNT(*) FROM analytics.scroll_events) as total_scroll_events,
            (SELECT COUNT(DISTINCT session_id) FROM analytics.page_views) as total_sessions,
            (SELECT COUNT(DISTINCT user_id) FROM analytics.page_views) as total_users
    `;
    
    const result = await clickhouse.query({ query });
    const data = await result.json();
    return data.data[0];
}

app.listen(port, () => {
    console.log(`Analytics service running on port ${port}`);
    console.log(`ClickHouse URL: ${process.env.CLICKHOUSE_URL || 'http://clickhouse-service:8123'}`);
});