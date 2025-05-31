import { useState, useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";

interface Branch {
  _id: Id<"branches">;
  name: string;
  branchConversationId: Id<"conversations">;
  branchFromMessageId: Id<"messages">;
  isActive: boolean;
  _creationTime: number;
}

interface BranchPanelProps {
  conversationId: Id<"conversations">;
  branches: Branch[];
  onSelectBranch: (conversationId: Id<"conversations">) => void;
  onClose: () => void;
  selectedMessageForBranch?: Id<"messages"> | null;
}

export function BranchPanel({ conversationId, branches, onSelectBranch, onClose, selectedMessageForBranch }: BranchPanelProps) {
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [selectedMessageId, setSelectedMessageId] = useState<Id<"messages"> | null>(selectedMessageForBranch || null);

  const createBranch = useMutation(api.conversations.createBranch);

  // Auto-open create form if a message was selected for branching
  useEffect(() => {
    if (selectedMessageForBranch) {
      setSelectedMessageId(selectedMessageForBranch);
      setShowCreateForm(true);
    }
  }, [selectedMessageForBranch]);

  const handleCreateBranch = async () => {
    if (!branchName.trim()) {
      toast.error("Please enter a branch name");
      return;
    }

    if (!selectedMessageId) {
      toast.error("Please select a message to branch from");
      return;
    }

    try {
      const result = await createBranch({
        parentConversationId: conversationId,
        branchFromMessageId: selectedMessageId,
        branchName: branchName.trim(),
      });

      setBranchName("");
      setSelectedMessageId(null);
      setShowCreateForm(false);
      onSelectBranch(result.branchConversationId);
      toast.success("Branch created successfully");
    } catch (error) {
      toast.error("Failed to create branch");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b flex justify-between items-center">
        <h3 className="font-semibold">Conversation Branches</h3>
        <button
          onClick={onClose}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Create Branch Form */}
        {showCreateForm && (
          <div className="mb-4 p-3 border rounded-lg bg-gray-50">
            <h4 className="font-medium mb-2">Create New Branch</h4>
            
            {selectedMessageId ? (
              <div className="mb-2 p-2 bg-white border rounded text-sm">
                <span className="text-gray-600">Branching from message:</span>
                <div className="text-green-600 font-medium">✓ Message selected</div>
              </div>
            ) : (
              <div className="mb-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm text-yellow-700">
                Click the branch icon (↗) next to any message to select it for branching
              </div>
            )}
            
            <input
              type="text"
              placeholder="Branch name (e.g., 'Alternative approach')"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              className="w-full px-3 py-2 border rounded mb-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateBranch}
                disabled={!branchName.trim() || !selectedMessageId}
                className="px-3 py-1 bg-primary text-white rounded text-sm hover:bg-primary-hover disabled:opacity-50"
              >
                Create Branch
              </button>
              <button
                onClick={() => {
                  setShowCreateForm(false);
                  setBranchName("");
                  setSelectedMessageId(null);
                }}
                className="px-3 py-1 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Branch List */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <h4 className="font-medium text-sm text-gray-600">Active Branches</h4>
            <button
              onClick={() => setShowCreateForm(true)}
              className="text-sm text-primary hover:underline"
            >
              + New Branch
            </button>
          </div>

          {branches.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-4">
              No branches yet. Create a branch by clicking the branch icon next to any message.
            </p>
          ) : (
            branches.map((branch) => (
              <div
                key={branch._id}
                className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer"
                onClick={() => onSelectBranch(branch.branchConversationId)}
              >
                <div className="font-medium text-sm">{branch.name}</div>
                <div className="text-xs text-gray-500">
                  Created {new Date(branch._creationTime).toLocaleDateString()}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Branch Tree Visualization */}
        <div className="mt-6">
          <h4 className="font-medium text-sm text-gray-600 mb-2">Branch Tree</h4>
          <div className="space-y-1">
            <div className="flex items-center text-sm">
              <div className="w-2 h-2 bg-primary rounded-full mr-2"></div>
              Main Conversation
            </div>
            {branches.map((branch, index) => (
              <div key={branch._id} className="flex items-center text-sm ml-4">
                <div className="w-1 h-4 border-l border-gray-300 mr-2"></div>
                <div className="w-2 h-2 bg-blue-400 rounded-full mr-2"></div>
                {branch.name}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
