import { useState, useEffect, useRef } from "react";
import { Id } from "../../convex/_generated/dataModel";

interface Message {
  _id: Id<"messages">;
  content: string;
  role: string;
  provider?: string;
  model?: string;
  messageIndex: number;
  _creationTime: number;
}

interface MessageListProps {
  messages: Message[];
  onCreateBranch: (messageId: Id<"messages">) => void;
}

export function MessageList({ messages, onCreateBranch }: MessageListProps) {
  const [hoveredMessage, setHoveredMessage] = useState<Id<"messages"> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const sortedMessages = [...messages].sort((a, b) => a.messageIndex - b.messageIndex);

  // Auto-scroll to bottom when new messages are added
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="p-4 space-y-4 min-h-full">
      {sortedMessages.map((message) => (
        <div
          key={message._id}
          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
          onMouseEnter={() => setHoveredMessage(message._id)}
          onMouseLeave={() => setHoveredMessage(null)}
        >
          <div
            className={`max-w-[80%] p-4 rounded-lg relative group ${
              message.role === "user"
                ? "bg-primary text-white"
                : "bg-gray-100 text-gray-900"
            }`}
          >
            <div className="whitespace-pre-wrap">{message.content}</div>
            
            {message.provider && (
              <div className="text-xs opacity-70 mt-2">
                {message.provider} • {message.model}
              </div>
            )}

            {/* Branch button */}
            {hoveredMessage === message._id && (
              <button
                onClick={() => onCreateBranch(message._id)}
                className="absolute -right-2 -top-2 w-8 h-8 bg-white border border-gray-300 rounded-full flex items-center justify-center shadow-sm hover:shadow-md transition-shadow"
                title="Create branch from this message"
              >
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                </svg>
              </button>
            )}

            <div className="text-xs opacity-50 mt-2">
              {new Date(message._creationTime).toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
      {/* Invisible element to scroll to */}
      <div ref={messagesEndRef} />
    </div>
  );
}
