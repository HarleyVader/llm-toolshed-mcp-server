# LLM Toolshed MCP Server

An MCP (Model Context Protocol) server providing RAG (Retrieval Augmented Generation) and CAG (Context Augmented Generation) capabilities for BambiSleep knowledge base.

## Features

### Tools
- **rag_query**: Perform RAG queries on BambiSleep data
- **cag_context**: Build context-augmented generation from knowledge graph
- **extract_entities**: Extract entities and relationships for knowledge graph
- **semantic_search**: Semantic search across content
- **get_metadata**: Get knowledge base metadata

### Resources
- `bambisleep://data/structured` - Full structured JSON data
- `bambisleep://data/faq` - FAQ content
- `bambisleep://data/sessions` - Session index
- `bambisleep://data/triggers` - Triggers documentation
- `bambisleep://data/safety` - Safety information

## Installation

```bash
cd llm-toolshed-mcp-server
npm install
```

## Usage

### Run the server
```bash
npm start
```

### Configure in Claude Desktop

Add to your Claude Desktop config (`~/Library/Application Support/Claude/claude_desktop_config.json` on macOS):

```json
{
  "mcpServers": {
    "llm-toolshed": {
      "command": "node",
      "args": ["/home/melkanea/llm-toolshed-mcp-server/index.js"]
    }
  }
}
```

## Data Structure

The server works with structured JSON data from bambisleep.info:

```json
{
  "metadata": {
    "source": "bambisleep.info",
    "fetched_at": "timestamp",
    "type": "bambi_sleep_wiki_content",
    "version": "1.0"
  },
  "content": {
    "faq": {...},
    "sessions": {...},
    "triggers": {...},
    "safety": {...},
    "transcripts": {...}
  },
  "rag_vectors": {...},
  "cag_context": {...}
}
```

## Example Queries

### RAG Query
```javascript
{
  "name": "rag_query",
  "arguments": {
    "query": "what is bambi sleep",
    "section": "faq",
    "max_results": 5
  }
}
```

### CAG Context
```javascript
{
  "name": "cag_context",
  "arguments": {
    "entity": "Bambi",
    "depth": 2
  }
}
```

### Extract Entities
```javascript
{
  "name": "extract_entities",
  "arguments": {
    "section": "triggers"
  }
}
```

## Architecture

- **MCP SDK**: Uses @modelcontextprotocol/sdk for server implementation
- **Resources**: Exposes BambiSleep data as MCP resources
- **Tools**: Provides RAG/CAG tools for LLM agents
- **Transport**: Stdio-based communication

## License

MIT
