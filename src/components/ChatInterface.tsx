import { useState, useEffect } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { ConversationList } from "./ConversationList";
import { MessageList } from "./MessageList";
import { MessageInput } from "./MessageInput";
import { SettingsPanel } from "./SettingsPanel";
import { BranchPanel } from "./BranchPanel";
import { toast } from "sonner";

interface ChatInterfaceProps {
  showSettings: boolean;
  setShowSettings: (show: boolean) => void;
}

export function ChatInterface({ showSettings, setShowSettings }: ChatInterfaceProps) {
  const [currentConversationId, setCurrentConversationId] = useState<Id<"conversations"> | null>(null);
  const [showBranches, setShowBranches] = useState(false);
  
  const conversations = useQuery(api.conversations.getUserConversations);
  const currentConversation = useQuery(
    api.conversations.getConversation,
    currentConversationId ? { conversationId: currentConversationId } : "skip"
  );
  const branches = useQuery(
    api.conversations.getBranches,
    currentConversationId ? { conversationId: currentConversationId } : "skip"
  );
  const userSettings = useQuery(api.settings.getUserSettings);
  
  const createConversation = useMutation(api.conversations.createConversation);
  const sendMessage = useAction(api.aiProviders.sendMessage);

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (conversations && conversations.length > 0 && !currentConversationId) {
      setCurrentConversationId(conversations[0]._id);
    }
  }, [conversations, currentConversationId]);

  // Clear current conversation if it was deleted
  useEffect(() => {
    if (currentConversationId && conversations && !conversations.find(c => c._id === currentConversationId)) {
      setCurrentConversationId(conversations.length > 0 ? conversations[0]._id : null);
    }
  }, [conversations, currentConversationId]);

  const handleNewConversation = async () => {
    try {
      const conversationId = await createConversation({
        title: "New Conversation",
      });
      setCurrentConversationId(conversationId);
      toast.success("New conversation created");
    } catch (error) {
      toast.error("Failed to create conversation");
    }
  };

  const handleSendMessage = async (message: string) => {
    if (!currentConversationId || !userSettings) return;

    try {
      await sendMessage({
        conversationId: currentConversationId,
        message,
        provider: userSettings.defaultProvider,
        model: userSettings.defaultModel,
      });
    } catch (error) {
      console.error("Send message error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to send message";
      
      if (errorMessage.includes("No API key found")) {
        toast.error("Please configure an API key in Settings first");
      } else if (errorMessage.includes("API Error")) {
        toast.error("API Error: Please check your API key and model selection");
      } else {
        toast.error(errorMessage);
      }
    }
  };

  const [selectedMessageForBranch, setSelectedMessageForBranch] = useState<Id<"messages"> | null>(null);

  const handleCreateBranch = (messageId: Id<"messages">) => {
    setSelectedMessageForBranch(messageId);
    setShowBranches(true);
  };

  return (
    <div className="flex h-full">
      {/* Sidebar - Fixed width with independent scrolling */}
      <div className="w-80 bg-white border-r flex flex-col">
        {/* Header - Fixed */}
        <div className="p-4 border-b bg-white">
          <button
            onClick={handleNewConversation}
            className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            New Conversation
          </button>
        </div>
        
        {/* Conversation List - Scrollable independently */}
        <div className="flex-1 overflow-y-auto">
          <ConversationList
            conversations={conversations || []}
            currentConversationId={currentConversationId}
            onSelectConversation={setCurrentConversationId}
          />
        </div>

        {/* Footer - Fixed */}
        <div className="p-4 border-t bg-white">
          <button
            onClick={() => setShowBranches(!showBranches)}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            {showBranches ? "Hide Branches" : "Show Branches"}
          </button>
          
          {conversations && conversations.length > 0 && (
            <div className="text-xs text-gray-500 text-center mt-2">
              {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
            </div>
          )}
        </div>
      </div>

      {/* Main Chat Area - Independent scrolling */}
      <div className="flex-1 flex flex-col">
        {currentConversation ? (
          <>
            {/* Chat Header - Fixed */}
            <div className="p-4 border-b bg-white">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-lg truncate">{currentConversation.conversation.title}</h2>
                  <p className="text-sm text-gray-500">
                    {currentConversation.messages.length} message{currentConversation.messages.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {userSettings && (
                    <div className="text-xs text-gray-500 text-right">
                      <div>{userSettings.defaultProvider}</div>
                      <div>{userSettings.defaultModel}</div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Messages Area - Scrollable independently */}
            <div className="flex-1 overflow-y-auto">
              <MessageList
                messages={currentConversation.messages}
                onCreateBranch={handleCreateBranch}
              />
            </div>
            
            {/* Input Area - Fixed at bottom */}
            <div className="border-t bg-white">
              <MessageInput onSendMessage={handleSendMessage} />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Welcome to ChatGPT Clone</h3>
              <p className="mb-4">Create a new conversation to get started</p>
              <button
                onClick={handleNewConversation}
                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors"
              >
                Start Chatting
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Branch Panel - Independent scrolling */}
      {showBranches && currentConversationId && (
        <div className="w-80 bg-white border-l">
          <BranchPanel
            conversationId={currentConversationId}
            branches={branches || []}
            onSelectBranch={setCurrentConversationId}
            onClose={() => {
              setShowBranches(false);
              setSelectedMessageForBranch(null);
            }}
            selectedMessageForBranch={selectedMessageForBranch}
          />
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto">
            <SettingsPanel onClose={() => setShowSettings(false)} />
          </div>
        </div>
      )}
    </div>
  );
}
