import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

// Get all conversations for a user
export const getUserConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const conversations = await ctx.db
      .query("conversations")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();

    return conversations;
  },
});

// Get a specific conversation with its messages
export const getConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    return { conversation, messages };
  },
});

// Create a new conversation
export const createConversation = mutation({
  args: { 
    title: v.string(),
    parentBranchId: v.optional(v.id("branches")),
    branchFromMessageId: v.optional(v.id("messages"))
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    return await ctx.db.insert("conversations", {
      userId,
      title: args.title,
      parentBranchId: args.parentBranchId,
      branchFromMessageId: args.branchFromMessageId,
    });
  },
});

// Update conversation title
export const updateConversation = mutation({
  args: {
    conversationId: v.id("conversations"),
    title: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    await ctx.db.patch(args.conversationId, {
      title: args.title,
    });
  },
});

// Add a message to a conversation
export const addMessage = mutation({
  args: {
    conversationId: v.id("conversations"),
    content: v.string(),
    role: v.string(),
    provider: v.optional(v.string()),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify conversation belongs to user
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    // Get the next message index
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    const messageIndex = messages.length;

    // Auto-update conversation title based on first user message
    if (messageIndex === 0 && args.role === "user" && conversation.title === "New Conversation") {
      const title = args.content.length > 50 
        ? args.content.substring(0, 50) + "..."
        : args.content;
      
      await ctx.db.patch(args.conversationId, { title });
    }

    return await ctx.db.insert("messages", {
      conversationId: args.conversationId,
      content: args.content,
      role: args.role,
      provider: args.provider,
      model: args.model,
      messageIndex,
    });
  },
});

// Create a branch from a specific message
export const createBranch = mutation({
  args: {
    parentConversationId: v.id("conversations"),
    branchFromMessageId: v.id("messages"),
    branchName: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    // Verify parent conversation belongs to user
    const parentConversation = await ctx.db.get(args.parentConversationId);
    if (!parentConversation || parentConversation.userId !== userId) {
      throw new Error("Parent conversation not found");
    }

    // Get the message we're branching from
    const branchMessage = await ctx.db.get(args.branchFromMessageId);
    if (!branchMessage || branchMessage.conversationId !== args.parentConversationId) {
      throw new Error("Branch message not found");
    }

    // Create new conversation for the branch
    const branchConversationId = await ctx.db.insert("conversations", {
      userId,
      title: `${parentConversation.title} - ${args.branchName}`,
      branchFromMessageId: args.branchFromMessageId,
    });

    // Copy messages up to the branch point
    const parentMessages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.parentConversationId))
      .collect();

    const messagesToCopy = parentMessages
      .filter(msg => msg.messageIndex <= branchMessage.messageIndex)
      .sort((a, b) => a.messageIndex - b.messageIndex);

    for (const msg of messagesToCopy) {
      await ctx.db.insert("messages", {
        conversationId: branchConversationId,
        content: msg.content,
        role: msg.role,
        provider: msg.provider,
        model: msg.model,
        messageIndex: msg.messageIndex,
      });
    }

    // Create branch record
    const branchId = await ctx.db.insert("branches", {
      userId,
      parentConversationId: args.parentConversationId,
      branchConversationId,
      branchFromMessageId: args.branchFromMessageId,
      name: args.branchName,
      isActive: true,
    });

    return { branchId, branchConversationId };
  },
});

// Get branches for a conversation
export const getBranches = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const branches = await ctx.db
      .query("branches")
      .withIndex("by_parent", (q) => q.eq("parentConversationId", args.conversationId))
      .collect();

    return branches;
  },
});

// Delete a conversation
export const deleteConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    // Delete all messages in the conversation
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete all branches that point to this conversation
    const branches = await ctx.db
      .query("branches")
      .withIndex("by_parent", (q) => q.eq("parentConversationId", args.conversationId))
      .collect();

    for (const branch of branches) {
      // Delete the branch conversation and its messages
      const branchMessages = await ctx.db
        .query("messages")
        .withIndex("by_conversation", (q) => q.eq("conversationId", branch.branchConversationId))
        .collect();

      for (const message of branchMessages) {
        await ctx.db.delete(message._id);
      }

      await ctx.db.delete(branch.branchConversationId);
      await ctx.db.delete(branch._id);
    }

    // Delete the conversation
    await ctx.db.delete(args.conversationId);
  },
});

// Duplicate a conversation
export const duplicateConversation = mutation({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation || conversation.userId !== userId) {
      throw new Error("Conversation not found");
    }

    // Create new conversation
    const newConversationId = await ctx.db.insert("conversations", {
      userId,
      title: `${conversation.title} (Copy)`,
    });

    // Copy all messages
    const messages = await ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    const sortedMessages = messages.sort((a, b) => a.messageIndex - b.messageIndex);

    for (const msg of sortedMessages) {
      await ctx.db.insert("messages", {
        conversationId: newConversationId,
        content: msg.content,
        role: msg.role,
        provider: msg.provider,
        model: msg.model,
        messageIndex: msg.messageIndex,
      });
    }

    return newConversationId;
  },
});
