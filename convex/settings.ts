import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get user settings
export const getUserSettings = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const settings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    return settings || {
      defaultProvider: "google",
      defaultModel: "gemini-2.0-flash",
      temperature: 0.7,
      maxTokens: 2000,
      systemPrompt: "",
      theme: "light",
    };
  },
});

// Update user settings
export const updateUserSettings = mutation({
  args: {
    defaultProvider: v.string(),
    defaultModel: v.string(),
    temperature: v.number(),
    maxTokens: v.number(),
    systemPrompt: v.optional(v.string()),
    theme: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const existingSettings = await ctx.db
      .query("userSettings")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .first();

    if (existingSettings) {
      await ctx.db.patch(existingSettings._id, {
        defaultProvider: args.defaultProvider,
        defaultModel: args.defaultModel,
        temperature: args.temperature,
        maxTokens: args.maxTokens,
        systemPrompt: args.systemPrompt,
        theme: args.theme,
      });
    } else {
      await ctx.db.insert("userSettings", {
        userId,
        defaultProvider: args.defaultProvider,
        defaultModel: args.defaultModel,
        temperature: args.temperature,
        maxTokens: args.maxTokens,
        systemPrompt: args.systemPrompt,
        theme: args.theme,
      });
    }
  },
});

// Get API keys for user
export const getApiKeys = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const apiKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    // Don't return the actual API keys, just the providers
    return apiKeys.map(key => ({
      _id: key._id,
      provider: key.provider,
      isActive: key.isActive,
    }));
  },
});

// Get specific API key for a provider
export const getApiKey = query({
  args: { provider: v.string() },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const apiKey = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("provider"), args.provider))
      .filter((q) => q.eq(q.field("isActive"), true))
      .first();

    return apiKey;
  },
});

// Save API key
export const saveApiKey = mutation({
  args: {
    provider: v.string(),
    apiKey: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Deactivate existing API keys for this provider
    const existingKeys = await ctx.db
      .query("apiKeys")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .filter((q) => q.eq(q.field("provider"), args.provider))
      .collect();

    for (const key of existingKeys) {
      await ctx.db.patch(key._id, { isActive: false });
    }

    // Add new API key
    return await ctx.db.insert("apiKeys", {
      userId,
      provider: args.provider,
      apiKey: args.apiKey, // In production, this should be encrypted
      isActive: true,
    });
  },
});

// Delete API key
export const deleteApiKey = mutation({
  args: { keyId: v.id("apiKeys") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const apiKey = await ctx.db.get(args.keyId);
    if (!apiKey || apiKey.userId !== userId) {
      throw new Error("API key not found");
    }

    await ctx.db.delete(args.keyId);
  },
});
