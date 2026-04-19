# Mouser MCP Server

MCP server that wraps the Mouser Electronics API. Lets Claude search for electronic components directly.

## Setup

1. Add your Mouser API key to `.env`:
   ```
   MOUSER_API_KEY=your-key-here
   ```

2. Install and build:
   ```
   npm install && npm run build
   ```

3. Add to your Claude Code MCP config (`.claude/settings.json` or project `.mcp.json`):
   ```json
   {
     "mcpServers": {
       "mouser": {
         "command": "node",
         "args": ["/absolute/path/to/mouser-mcp-server/dist/index.js"]
       }
     }
   }
   ```

## Tools

### `search_keyword`
Search Mouser by keyword (e.g. "100nf 0805 capacitor X7R"). Returns a summary with top matches and saves full results to `searches/` directory.

### `search_part_number`
Look up a specific Mouser or manufacturer part number. Same file-based output.

## How it works

Search results are written to JSON files in `searches/`. The tool response includes a brief summary (top 5 hits) and the file path. Read the file for full details including price breaks, availability, lead times, etc.
