#!/usr/bin/env node
/**
 * bin/dopl-brain-mcp.js
 *
 * Executable entry point for the Dopl Brain MCP server.
 * This file is referenced in package.json's "bin" field and gets installed
 * globally when the package is installed with `npm install -g dopl-brain-mcp`.
 *
 * Usage:
 *   dopl-brain-mcp
 *   DOPL_BRAIN_TOKEN=dpb_sk_xxx dopl-brain-mcp
 */

require('../dist/index.js');
