"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";
import { api } from "./_generated/api";

// AI Provider configurations
const PROVIDERS = {
  openai: {
    baseURL: "https://api.openai.com/v1",
    models: ["gpt-4o-mini", "gpt-3.5-turbo"],
  },
  google: {
    baseURL: "https://generativelanguage.googleapis.com/v1beta",
    models: ["gemini-2.0-flash", "gemini-1.5-flash"],
  },
  groq: {
    baseURL: "https://api.groq.com/openai/v1",
    models: ["llama-3.1-8b-instant", "mixtral-8x7b-32768", "gemma2-9b-it"],
  },
  deepseek: {
    baseURL: "https://api.deepseek.com/v1",
    models: ["deepseek-chat"],
  },
};

export const sendMessage = action({
  args: {
    conversationId: v.id("conversations"),
    message: v.string(),
    provider: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Get user's API key for the provider
    const apiKeyRecord = await ctx.runQuery(api.settings.getApiKey, {
      provider: args.provider,
    });

    if (!apiKeyRecord) {
      throw new Error(`No API key found for provider: ${args.provider}`);
    }

    // Add user message to conversation
    await ctx.runMutation(api.conversations.addMessage, {
      conversationId: args.conversationId,
      content: args.message,
      role: "user",
    });

    // Get conversation history for context
    const { messages } = await ctx.runQuery(api.conversations.getConversation, {
      conversationId: args.conversationId,
    });

    // Prepare messages for AI API
    const apiMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    // Add the new user message
    apiMessages.push({
      role: "user",
      content: args.message,
    });

    try {
      let response;

      if (args.provider === "openai" || args.provider === "groq" || args.provider === "deepseek") {
        response = await callOpenAICompatibleAPI(
          PROVIDERS[args.provider as keyof typeof PROVIDERS].baseURL,
          apiKeyRecord.apiKey,
          args.model,
          apiMessages
        );
      } else if (args.provider === "google") {
        response = await callGoogleAPI(
          apiKeyRecord.apiKey,
          args.model,
          apiMessages
        );
      } else {
        throw new Error(`Unsupported provider: ${args.provider}`);
      }

      // Add AI response to conversation
      await ctx.runMutation(api.conversations.addMessage, {
        conversationId: args.conversationId,
        content: response,
        role: "assistant",
        provider: args.provider,
        model: args.model,
      });

      return response;
    } catch (error) {
      console.error("AI API Error:", error);
      throw new Error(`Failed to get response from ${args.provider}: ${error}`);
    }
  },
});

async function callOpenAICompatibleAPI(
  baseURL: string,
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>
) {
  const response = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.7,
      max_tokens: 2000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API Error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.choices[0].message.content;
}

async function callGoogleAPI(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string }>
) {
  // Convert messages to Google's format
  const contents = messages.map(msg => ({
    role: msg.role === "assistant" ? "model" : "user",
    parts: [{ text: msg.content }],
  }));

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 2000,
        },
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google API Error: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

export const testApiKey = action({
  args: {
    provider: v.string(),
    apiKey: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    try {
      const testMessages = [
        { role: "user", content: "Hello, this is a test message." }
      ];

      if (args.provider === "openai" || args.provider === "groq" || args.provider === "deepseek") {
        await callOpenAICompatibleAPI(
          PROVIDERS[args.provider as keyof typeof PROVIDERS].baseURL,
          args.apiKey,
          args.model,
          testMessages
        );
      } else if (args.provider === "google") {
        await callGoogleAPI(args.apiKey, args.model, testMessages);
      }

      return { success: true, message: "API key is valid" };
    } catch (error) {
      return { success: false, message: `API key test failed: ${error}` };
    }
  },
});
