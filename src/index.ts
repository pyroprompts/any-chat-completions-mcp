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

dotenv.config();

const AI_CHAT_BASE_URL = process.env.AI_CHAT_BASE_URL;
const AI_CHAT_KEY = process.env.AI_CHAT_KEY;
const AI_CHAT_MODEL = process.env.AI_CHAT_MODEL;
const AI_CHAT_NAME = process.env.AI_CHAT_NAME;
const AI_CHAT_TIMEOUT = process.env.AI_CHAT_TIMEOUT || 30000;
const AI_CHAT_SYSTEM_PROMPT = process.env.AI_CHAT_SYSTEM_PROMPT;

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

      const client = new OpenAI({
        apiKey: AI_CHAT_KEY,
        baseURL: AI_CHAT_BASE_URL,
        timeout: parseInt(AI_CHAT_TIMEOUT, 10),
      });

      try {
        const chatCompletion = await client.chat.completions.create({
          messages: [
            ...(AI_CHAT_SYSTEM_PROMPT ? [{ role: 'system', content: AI_CHAT_SYSTEM_PROMPT }] : []),
            { role: 'user', content: content }
          ],
          model: AI_CHAT_MODEL.trim(), // Trim to remove any whitespace
        });

        const responseContent = chatCompletion.choices[0]?.message?.content;
        
        if (!responseContent) {
          throw new Error('No response content received from API');
        }

        return {
          content: [
            {
              type: "text",
              text: responseContent
            }
          ]
        };
      } catch (error: any) {
        const errorMessage = error.response?.data?.error?.message || error.message || 'Unknown error occurred';
        console.error('Chat completion error:', errorMessage);
        
        return {
          content: [
            {
              type: "text",
              text: `Error: ${errorMessage}`
            }
          ],
          isError: true
        };
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


