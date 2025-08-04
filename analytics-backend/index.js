// index.js
const express = require('express');
const cors = require('cors');
const { createClient } = require('@clickhouse/client');

const app = express();

// Enable CORS for all origins (restrict in production)
app.use(cors({
  origin: '*',  // Change to your frontend URL in production
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// ClickHouse client configuration
const clickhouseClient = createClient({
  url: `http://${process.env.CLICKHOUSE_HOST || 'acfc5e0349f8f4ff4955f1b0ce258b29-1078777489.us-east-1.elb.amazonaws.com'}:${process.env.CLICKHOUSE_PORT || 8123}`,
  database: 'analytics',
  username: process.env.CLICKHOUSE_USER || 'default',
  password: process.env.CLICKHOUSE_PASSWORD || 'password',
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Backend is running',
    timestamp: new Date().toISOString()
  });
});

// Check table schema endpoint
app.get('/table-schema', async (req, res) => {
  try {
    const result = await clickhouseClient.query({
      query: 'DESCRIBE TABLE analytics.clicks',
      format: 'JSONEachRow'
    });
    
    const schema = await result.json();
    res.json({ 
      status: 'OK',
      schema: schema
    });
    
  } catch (error) {
    console.error('Error fetching table schema:', error);
    res.status(500).json({ 
      message: 'Failed to fetch table schema',
      error: error.message
    });
  }
});

// Track events endpoint
app.post('/track', async (req, res) => {
  try {
    console.log('Received tracking request:', req.body);
    
    const event = req.body;

    // Validate required fields
    if (!event.eventType || !event.sessionId || !event.pageUrl) {
      console.log('Missing required fields:', event);
      return res.status(400).json({ 
        message: 'Missing required fields: eventType, sessionId, pageUrl',
        received: event
      });
    }

    // Prepare data for insertion - match your ClickHouse table schema
    const eventData = {
      eventName: event.eventType,  // maps to eventName column
      userId: event.sessionId,     // maps to userId column
      // timestamp will use DEFAULT now() from ClickHouse
    };

    console.log('Inserting data:', eventData);

    // Try different insertion methods based on your table schema
    try {
      // Method 1: Using JSONEachRow format
      await clickhouseClient.insert({
        table: 'clicks',
        values: [eventData],
        format: 'JSONEachRow',
      });
    } catch (insertError) {
      console.log('JSONEachRow failed, trying raw SQL...', insertError.message);
      
      // Method 2: Using raw SQL query (fallback)
      const query = `
        INSERT INTO analytics.clicks 
        (eventName, userId) 
        VALUES 
        ('${eventData.eventName}', '${eventData.userId}')
      `;
      
      await clickhouseClient.query({
        query: query
      });
    }

    console.log('Event successfully inserted');
    
    res.status(200).json({ 
      message: 'Event tracked successfully',
      data: eventData
    });

  } catch (error) {
    console.error('Error inserting event:', error);
    
    // More detailed error response
    res.status(500).json({ 
      message: 'Internal server error',
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get analytics data endpoint
app.get('/analytics', async (req, res) => {
  try {
    const result = await clickhouseClient.query({
      query: 'SELECT * FROM clicks ORDER BY timestamp DESC LIMIT 100',
      format: 'JSONEachRow'
    });
    
    const data = await result.json();
    res.json({ 
      status: 'OK',
      count: data.length,
      data: data
    });
    
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ 
      message: 'Failed to fetch analytics data',
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: err.message
  });
});

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({ 
    message: 'Route not found',
    path: req.originalUrl
  });
});

const PORT = process.env.PORT || 8080;

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Test DB: http://localhost:${PORT}/test-db`);
});