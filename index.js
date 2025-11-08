#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import fs from "fs/promises";
import path from "path";

const BAMBISLEEP_DATA_PATH = "../bambisleep_data/bambisleep_structured.json";

class LLMToolshedMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: "llm-toolshed-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      }
    );

    this.setupHandlers();
    this.bambisleepData = null;
  }

  async loadBambisleepData() {
    if (!this.bambisleepData) {
      try {
        const dataPath = path.resolve(process.cwd(), BAMBISLEEP_DATA_PATH);
        const data = await fs.readFile(dataPath, "utf-8");
        this.bambisleepData = JSON.parse(data);
      } catch (error) {
        console.error("Error loading BambiSleep data:", error);
        this.bambisleepData = { error: "Data not available" };
      }
    }
    return this.bambisleepData;
  }

  setupHandlers() {
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: [
        {
          uri: "bambisleep://data/structured",
          mimeType: "application/json",
          name: "BambiSleep Structured Data",
          description: "Structured JSON data from bambisleep.info wiki",
        },
        {
          uri: "bambisleep://data/faq",
          mimeType: "text/plain",
          name: "BambiSleep FAQ",
          description: "Frequently Asked Questions",
        },
        {
          uri: "bambisleep://data/sessions",
          mimeType: "text/plain",
          name: "Session Index",
          description: "Index of BambiSleep sessions",
        },
        {
          uri: "bambisleep://data/triggers",
          mimeType: "text/plain",
          name: "Triggers",
          description: "BambiSleep triggers documentation",
        },
        {
          uri: "bambisleep://data/safety",
          mimeType: "text/plain",
          name: "Safety Information",
          description: "Risks, safety and advice",
        },
      ],
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const data = await this.loadBambisleepData();
      const uri = request.params.uri;

      if (uri === "bambisleep://data/structured") {
        return {
          contents: [
            {
              uri,
              mimeType: "application/json",
              text: JSON.stringify(data, null, 2),
            },
          ],
        };
      }

      const sectionMap = {
        "bambisleep://data/faq": "faq",
        "bambisleep://data/sessions": "sessions",
        "bambisleep://data/triggers": "triggers",
        "bambisleep://data/safety": "safety",
      };

      const section = sectionMap[uri];
      if (section && data.content && data.content[section]) {
        return {
          contents: [
            {
              uri,
              mimeType: "text/plain",
              text: data.content[section].content,
            },
          ],
        };
      }

      throw new Error(`Resource not found: ${uri}`);
    });

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "rag_query",
          description: "Perform RAG (Retrieval Augmented Generation) query on BambiSleep data",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "The query to search for in the knowledge base",
              },
              section: {
                type: "string",
                enum: ["faq", "sessions", "triggers", "safety", "transcripts", "all"],
                description: "Which section to search (default: all)",
              },
              max_results: {
                type: "number",
                description: "Maximum number of results to return",
                default: 5,
              },
            },
            required: ["query"],
          },
        },
        {
          name: "cag_context",
          description: "Build CAG (Context Augmented Generation) from BambiSleep knowledge graph",
          inputSchema: {
            type: "object",
            properties: {
              entity: {
                type: "string",
                description: "Entity to build context around (e.g., trigger name, session name)",
              },
              depth: {
                type: "number",
                description: "Depth of relationship traversal",
                default: 2,
              },
            },
            required: ["entity"],
          },
        },
        {
          name: "extract_entities",
          description: "Extract entities and relationships from BambiSleep content for knowledge graph",
          inputSchema: {
            type: "object",
            properties: {
              section: {
                type: "string",
                enum: ["faq", "sessions", "triggers", "safety", "transcripts", "all"],
                description: "Which section to extract from",
              },
            },
            required: ["section"],
          },
        },
        {
          name: "semantic_search",
          description: "Perform semantic search across BambiSleep content",
          inputSchema: {
            type: "object",
            properties: {
              query: {
                type: "string",
                description: "Search query",
              },
              threshold: {
                type: "number",
                description: "Similarity threshold (0-1)",
                default: 0.7,
              },
            },
            required: ["query"],
          },
        },
        {
          name: "get_metadata",
          description: "Get metadata about the BambiSleep knowledge base",
          inputSchema: {
            type: "object",
            properties: {},
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        const data = await this.loadBambisleepData();

        switch (name) {
          case "rag_query":
            return await this.handleRAGQuery(data, args);
          case "cag_context":
            return await this.handleCAGContext(data, args);
          case "extract_entities":
            return await this.handleExtractEntities(data, args);
          case "semantic_search":
            return await this.handleSemanticSearch(data, args);
          case "get_metadata":
            return await this.handleGetMetadata(data);
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error: ${error.message}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async handleRAGQuery(data, args) {
    const { query, section = "all", max_results = 5 } = args;
    const results = [];

    const searchInSection = (sectionName, content) => {
      if (!content) return;
      const text = content.content || content;
      const lowerQuery = query.toLowerCase();
      const lowerText = text.toLowerCase();

      if (lowerText.includes(lowerQuery)) {
        const index = lowerText.indexOf(lowerQuery);
        const start = Math.max(0, index - 100);
        const end = Math.min(text.length, index + query.length + 100);
        const excerpt = text.substring(start, end);

        results.push({
          section: sectionName,
          relevance: 0.9,
          excerpt: `...${excerpt}...`,
          full_length: content.full_length || text.length,
        });
      }
    };

    if (section === "all") {
      for (const [key, value] of Object.entries(data.content || {})) {
        searchInSection(key, value);
      }
    } else if (data.content && data.content[section]) {
      searchInSection(section, data.content[section]);
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              query,
              results: results.slice(0, max_results),
              total_found: results.length,
              rag_method: "keyword_search",
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleCAGContext(data, args) {
    const { entity, depth = 2 } = args;

    const context = {
      entity,
      depth,
      relationships: [],
      related_entities: [],
      context_summary: `Context for "${entity}" built from BambiSleep knowledge base`,
    };

    for (const [section, content] of Object.entries(data.content || {})) {
      const text = content.content || "";
      if (text.toLowerCase().includes(entity.toLowerCase())) {
        context.relationships.push({
          type: "mentioned_in",
          target: section,
          relevance: 0.8,
        });
      }
    }

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(context, null, 2),
        },
      ],
    };
  }

  async handleExtractEntities(data, args) {
    const { section } = args;
    const entities = [];

    const extractFromText = (text, sourceName) => {
      const patterns = [
        /\b(Bambi|Session \d+|Trigger|File \d+)\b/gi,
        /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g,
      ];

      patterns.forEach((pattern) => {
        const matches = text.matchAll(pattern);
        for (const match of matches) {
          entities.push({
            entity: match[0],
            type: "extracted",
            source: sourceName,
          });
        }
      });
    };

    if (section === "all") {
      for (const [key, value] of Object.entries(data.content || {})) {
        extractFromText(value.content || "", key);
      }
    } else if (data.content && data.content[section]) {
      extractFromText(data.content[section].content || "", section);
    }

    const uniqueEntities = [...new Map(entities.map((e) => [e.entity, e])).values()];

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              section,
              entities: uniqueEntities.slice(0, 50),
              total_extracted: uniqueEntities.length,
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleSemanticSearch(data, args) {
    const { query, threshold = 0.7 } = args;

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              query,
              threshold,
              message: "Semantic search using simple keyword matching (embeddings not implemented)",
              results: await this.handleRAGQuery(data, { query, max_results: 5 }),
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async handleGetMetadata(data) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              metadata: data.metadata || {},
              sections: Object.keys(data.content || {}),
              total_content_length: Object.values(data.content || {}).reduce(
                (sum, v) => sum + (v.full_length || 0),
                0
              ),
              rag_status: data.rag_vectors || {},
              cag_status: data.cag_context || {},
            },
            null,
            2
          ),
        },
      ],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("LLM Toolshed MCP Server running on stdio");
  }
}

const server = new LLMToolshedMCPServer();
server.run().catch(console.error);
