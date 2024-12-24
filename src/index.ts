#!/usr/bin/env node

import dotenv from "dotenv";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

import OpenAI from 'openai';
import { APIError } from 'openai/error.js';

dotenv.config();

// Common model names that work with OpenAI-compatible APIs
const COMMON_MODELS = [
  'gpt-3.5-turbo',
  'gpt-4-turbo-preview',
  'gpt-4',
  'gpt-4-0125-preview',
  'claude-3-opus-20240229',
  'claude-3-sonnet-20240229',
  'claude-2.1',
  'gpt-4o-mini'
];

const AI_CHAT_BASE_URL = process.env.AI_CHAT_BASE_URL;
const AI_CHAT_KEY = process.env.AI_CHAT_KEY;
const AI_CHAT_MODEL = process.env.AI_CHAT_MODEL;
const AI_CHAT_NAME = process.env.AI_CHAT_NAME;

if (!AI_CHAT_BASE_URL) {
  throw new Error("AI_CHAT_BASE_URL is required")
}

if (!AI_CHAT_KEY) {
  throw new Error("AI_CHAT_KEY is required")
}

if (!AI_CHAT_MODEL) {
  throw new Error("AI_CHAT_MODEL is required")
}

if (!AI_CHAT_NAME) {
  throw new Error("AI_CHAT_NAME is required")
}
const AI_CHAT_NAME_CLEAN = AI_CHAT_NAME.toLowerCase().replace(' ', '-')

const server = new Server(
  {
    name: "any-chat-completions-mcp",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
      prompts: {},
    },
  }
);

/**
 * Handler for listing resources.
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  return {
    resources: [],
  };
});

/**
 * Handler for reading the contents of a specific resource.
 */
server.setRequestHandler(ReadResourceRequestSchema, async () => {
    throw new Error(`Resource not found`);

});

/**
 * Handler that lists available tools.
 * Exposes a single "chat" tool that lets clients chat with another AI.
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: `chat-with-${AI_CHAT_NAME_CLEAN}`,
        description: `Text chat with ${AI_CHAT_NAME}`,
        inputSchema: {
          type: "object",
          properties: {
            content: {
              type: "string",
              description: `The content of the chat to send to ${AI_CHAT_NAME}`,
            }
          },
          required: ["content"]
        }
      }
    ]
  };
});

/**
 * Handler for the chat tool.
 * Connects to an OpenAI SDK compatible AI Integration.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case `chat-with-${AI_CHAT_NAME_CLEAN}`: {
      const content = String(request.params.arguments?.content)
      if (!content) {
        throw new Error("Content is required")
      }

      // Basic model validation
      if (!AI_CHAT_MODEL || !COMMON_MODELS.includes(AI_CHAT_MODEL)) {
        console.warn(`Warning: Model ${AI_CHAT_MODEL} is not in list of common models. This may still work if your provider supports it.`);
      }

      const client = new OpenAI({
        apiKey: AI_CHAT_KEY,
        baseURL: AI_CHAT_BASE_URL,
      });

      try {
        const chatCompletion = await client.chat.completions.create({
          messages: [{ role: 'user', content: content }],
          model: AI_CHAT_MODEL,
        });

        return {
          content: [
            {
              type: "text",
              text: chatCompletion.choices[0]?.message?.content
            }
          ]
        }
      } catch (error) {
        if (error instanceof APIError) {
          switch (error.status) {
            case 404:
              throw new Error(
                `Model '${AI_CHAT_MODEL}' not found or not accessible. Check:\n` +
                `1. Your API key has access to this model\n` +
                `2. The model name is correct for your provider\n` +
                `3. Your provider supports this model\n` +
                `Common models: ${COMMON_MODELS.join(', ')}`
              );
            case 429:
              throw new Error(
                `API rate limit exceeded. Check:\n` +
                `1. Your current API quota and billing status\n` +
                `2. Implement rate limiting in your application\n` +
                `3. Consider using a different model or provider`
              );
            default:
              throw new Error(`API Error (${error.status}): ${error.message}`);
          }
        }
        // Re-throw unknown errors
        throw error;
      }
    }

    default:
      throw new Error("Unknown tool");
  }
});

/**
 * Handler that lists available prompts.
 */
server.setRequestHandler(ListPromptsRequestSchema, async () => {
  return {
    prompts: []
  };
});

/**
 * Handler for the get prompt.
 */
server.setRequestHandler(GetPromptRequestSchema, async () => {
  throw new Error("Unknown prompt");
});

/**
 * Start the server using stdio transport.
 * This allows the server to communicate via standard input/output streams.
 */
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});


