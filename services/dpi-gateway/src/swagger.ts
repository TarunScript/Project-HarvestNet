/**
 * Swagger UI setup for dpi-gateway.
 * Section 8: "Publish this as a live Swagger UI page"
 *
 * Serves the OpenAPI 3.0 spec as interactive documentation at /docs.
 */

import type { Express } from 'express';
import fs from 'fs';

/**
 * Setup Swagger UI to serve the OpenAPI spec.
 *
 * Uses a lightweight HTML page that loads SwaggerUI from CDN
 * and renders the openapi.yaml spec.
 */
export function setupSwagger(app: Express, openapiPath: string): void {
  // Serve the raw OpenAPI spec
  app.get('/openapi.yaml', (_req, res) => {
    try {
      if (fs.existsSync(openapiPath)) {
        res.type('text/yaml').send(fs.readFileSync(openapiPath, 'utf-8'));
      } else {
        res.status(404).json({ error: 'OpenAPI spec not found' });
      }
    } catch {
      res.status(500).json({ error: 'Failed to read OpenAPI spec' });
    }
  });

  // Serve Swagger UI
  app.get('/docs', (_req, res) => {
    res.type('text/html').send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Project-HarvestNet — API Documentation</title>
  <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5/swagger-ui.css">
  <style>
    body { margin: 0; padding: 0; }
    #swagger-ui { max-width: 1200px; margin: 0 auto; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
  <script>
    SwaggerUIBundle({
      url: '/openapi.yaml',
      dom_id: '#swagger-ui',
      presets: [
        SwaggerUIBundle.presets.apis,
        SwaggerUIBundle.SwaggerUIStandalonePreset
      ],
      layout: 'BaseLayout',
      deepLinking: true,
    });
  </script>
</body>
</html>`);
  });
}
