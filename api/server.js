const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');

// Create a simple MCP-compatible server
const app = express();
app.use(cors());
app.use(express.json());

// For test endpoint
app.get('/test', (req, res) => {
  return res.json({
    status: 'ok',
    message: 'Notion API proxy is running',
    env_var_exists: !!process.env.OPENAPI_MCP_HEADERS
  });
});

// Simple SSE handler for MCP
app.get('/sse', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  
  // Send initial connection message
  res.write(`data: ${JSON.stringify({ type: 'connection_established' })}\n\n`);
  
  // Keep connection alive
  const intervalId = setInterval(() => {
    res.write(`data: ${JSON.stringify({ type: 'ping' })}\n\n`);
  }, 30000);
  
  // Handle client messages
  req.on('data', async (chunk) => {
    try {
      const data = JSON.parse(chunk.toString());
      
      // Handle MCP call
      if (data.type === 'function_call' && data.payload && data.payload.name === 'notion-api') {
        const params = data.payload.parameters || {};
        const { path, method = 'GET', body } = params;
        
        // Get headers from environment variables
        const headersJson = process.env.OPENAPI_MCP_HEADERS || '{}';
        const headers = JSON.parse(headersJson);
        
        // Call Notion API
        const response = await fetch(`https://api.notion.com/v1${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: body ? JSON.stringify(body) : undefined
        });
        
        // Get response data
        const responseData = await response.json();
        
        // Send response back to client
        res.write(`data: ${JSON.stringify({
          type: 'function_response',
          id: data.id,
          payload: { data: responseData }
        })}\n\n`);
      }
    } catch (error) {
      console.error('Error processing request:', error);
      res.write(`data: ${JSON.stringify({
        type: 'error',
        payload: { message: error.message }
      })}\n\n`);
    }
  });
  
  // Handle client disconnect
  req.on('close', () => {
    clearInterval(intervalId);
  });
});

// For Vercel serverless functions
module.exports = app;

// For local development
if (require.main === module) {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
