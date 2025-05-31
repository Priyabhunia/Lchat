import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

interface Conversation {
  _id: Id<"conversations">;
  title: string;
  _creationTime: number;
}

interface ConversationListProps {
  conversations: Conversation[];
  currentConversationId: Id<"conversations"> | null;
  onSelectConversation: (id: Id<"conversations">) => void;
}

export function ConversationList({
  conversations,
  currentConversationId,
  onSelectConversation,
}: ConversationListProps) {
  const [editingId, setEditingId] = useState<Id<"conversations"> | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<Id<"conversations"> | null>(null);

  const updateConversation = useMutation(api.conversations.updateConversation);
  const deleteConversation = useMutation(api.conversations.deleteConversation);

  const handleStartEdit = (conversation: Conversation) => {
    setEditingId(conversation._id);
    setEditTitle(conversation.title);
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editTitle.trim()) return;

    try {
      await updateConversation({
        conversationId: editingId,
        title: editTitle.trim(),
      });
      setEditingId(null);
      setEditTitle("");
      toast.success("Conversation renamed");
    } catch (error) {
      toast.error("Failed to rename conversation");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditTitle("");
  };

  const handleDelete = async (conversationId: Id<"conversations">) => {
    try {
      await deleteConversation({ conversationId });
      setShowDeleteConfirm(null);
      toast.success("Conversation deleted");
    } catch (error) {
      toast.error("Failed to delete conversation");
    }
  };

  const sortedConversations = [...conversations].sort((a, b) => b._creationTime - a._creationTime);

  return (
    <div className="h-full">
      <div className="space-y-1 p-2">
        {sortedConversations.map((conversation) => (
          <div
            key={conversation._id}
            className={`group relative rounded-lg transition-colors ${
              currentConversationId === conversation._id
                ? "bg-primary text-white"
                : "hover:bg-gray-100"
            }`}
          >
            {editingId === conversation._id ? (
              <div className="p-3">
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleSaveEdit();
                    if (e.key === "Escape") handleCancelEdit();
                  }}
                  className="w-full px-2 py-1 text-sm border rounded text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary"
                  autoFocus
                />
                <div className="flex gap-1 mt-2">
                  <button
                    onClick={handleSaveEdit}
                    className="px-2 py-1 text-xs bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Save
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-2 py-1 text-xs bg-gray-500 text-white rounded hover:bg-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                <button
                  onClick={() => onSelectConversation(conversation._id)}
                  className="w-full text-left p-3 rounded-lg"
                >
                  <div className="font-medium truncate pr-8">{conversation.title}</div>
                  <div className="text-sm opacity-70">
                    {new Date(conversation._creationTime).toLocaleDateString()}
                  </div>
                </button>

                {/* Action buttons */}
                <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleStartEdit(conversation);
                      }}
                      className="p-1 hover:bg-gray-200 rounded text-gray-600 hover:text-gray-800"
                      title="Rename conversation"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowDeleteConfirm(conversation._id);
                      }}
                      className="p-1 hover:bg-red-100 rounded text-red-500 hover:text-red-700"
                      title="Delete conversation"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}

        {conversations.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <p className="text-sm">No conversations yet</p>
            <p className="text-xs mt-1">Create your first conversation to get started</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm mx-4">
            <h3 className="text-lg font-semibold mb-2">Delete Conversation</h3>
            <p className="text-gray-600 mb-4">
              Are you sure you want to delete this conversation? This action cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(showDeleteConfirm)}
                className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
