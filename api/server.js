const { createServer } = require('@modelcontextprotocol/sdk');
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Only handle SSE requests
  if (req.method === 'GET') {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Get headers from environment variables with fallback for testing
    const openApiMcpHeadersJson = process.env.OPENAPI_MCP_HEADERS || '{"Authorization": "Bearer test_token", "Notion-Version": "2022-06-28"}';
    
    try {
      // Parse headers from environment variable
      const openApiMcpHeaders = JSON.parse(openApiMcpHeadersJson);
      
      // Create MCP server
      const server = createServer({
        tools: [
          {
            name: 'notion-api',
            description: 'Access the Notion API',
            parameters: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'The Notion API path'
                },
                method: {
                  type: 'string',
                  enum: ['GET', 'POST', 'PATCH', 'DELETE'],
                  default: 'GET',
                  description: 'The HTTP method'
                },
                body: {
                  type: 'object',
                  description: 'The request body for POST and PATCH requests'
                }
              },
              required: ['path']
            },
            handler: async ({ path, method = 'GET', body }) => {
              try {
                // Forward request to Notion API with proper headers
                const response = await fetch(`https://api.notion.com/v1${path}`, {
                  method,
                  headers: {
                    'Content-Type': 'application/json',
                    ...openApiMcpHeaders
                  },
                  body: body ? JSON.stringify(body) : undefined
                });
                
                // Return response from Notion API
                const data = await response.json();
                return { data };
              } catch (error) {
                console.error('Error calling Notion API:', error);
                return { error: error.message };
              }
            }
          }
        ]
      });
      
      // Handle SSE connection
      server.handleSseConnection(req, res);
    } catch (error) {
      console.error('Server creation error:', error);
      res.status(500).send(`Server creation error: ${error.message}`);
    }
  } else {
    res.status(405).send('Method Not Allowed');
  }
};
