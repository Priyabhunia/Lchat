import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  // API Keys for different providers
  apiKeys: defineTable({
    userId: v.id("users"),
    provider: v.string(), // "openai", "google", "groq", "deepseek"
    apiKey: v.string(), // encrypted
    isActive: v.boolean(),
  }).index("by_user", ["userId"]),

  // Main conversations
  conversations: defineTable({
    userId: v.id("users"),
    title: v.string(),
    parentBranchId: v.optional(v.id("branches")), // null for main conversation
    branchFromMessageId: v.optional(v.id("messages")), // which message this branched from
  }).index("by_user", ["userId"]),

  // Messages within conversations
  messages: defineTable({
    conversationId: v.id("conversations"),
    content: v.string(),
    role: v.string(), // "user" or "assistant"
    provider: v.optional(v.string()), // which AI provider generated this
    model: v.optional(v.string()), // which model was used
    messageIndex: v.number(), // order in conversation
    parentMessageId: v.optional(v.id("messages")), // for threading
  }).index("by_conversation", ["conversationId", "messageIndex"]),

  // Branch management
  branches: defineTable({
    userId: v.id("users"),
    parentConversationId: v.id("conversations"),
    branchConversationId: v.id("conversations"),
    branchFromMessageId: v.id("messages"),
    name: v.string(),
    isActive: v.boolean(),
  }).index("by_user", ["userId"])
    .index("by_parent", ["parentConversationId"]),

  // User settings
  userSettings: defineTable({
    userId: v.id("users"),
    defaultProvider: v.string(),
    defaultModel: v.string(),
    temperature: v.number(),
    maxTokens: v.number(),
    systemPrompt: v.optional(v.string()),
    theme: v.string(), // "light" or "dark"
  }).index("by_user", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
