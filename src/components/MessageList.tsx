import React from "react";
import { ChatMessage } from "../types";
import { formatMessageTime } from "../utils/formatting";
import { LuMousePointerClick } from "react-icons/lu";
import { IoChatbubbleEllipsesOutline } from "react-icons/io5";
import { SiTicktick } from "react-icons/si";
import MarketrixLogo from "../assets/marketrix-icon.png";

interface MessageListProps {
  messages: ChatMessage[];
  isLoading: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
  onSendMessage?: (message: string, mode?: 'show' | 'tell' | 'do') => void;
  onSetMode?: (mode: 'show' | 'tell' | 'do') => void;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  isLoading,
  messagesEndRef,
  onSendMessage,
  onSetMode,
}) => {
  // Suggested actions to show when no messages
  const suggestedActions = [
    {
      text: "Show me how to create an invoice",
      icon: <LuMousePointerClick className="w-6 h-6" />,
      type: "show",
      isShow: true,
    },
    {
      text: "Show me how to set up automated invoice reminders",
      icon: <LuMousePointerClick className="w-6 h-6" />,
      type: "show",
      isShow: true,
    },
    {
      text: "What is deferred revenue and how should I report it in QuickBooks?",
      icon: <IoChatbubbleEllipsesOutline className="w-5 h-5" />,
      type: "tell",
      isShow: false,
    },
  ];

  const handleSuggestedActionClick = (action: (typeof suggestedActions)[0], event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    
    // Set the mode based on action type FIRST
    if (onSetMode && action.type) {
      console.log('Setting mode to:', action.type);
      onSetMode(action.type as 'show' | 'tell' | 'do');
    }
    
    // Send message with the correct mode directly
    if (onSendMessage) {
      console.log('Sending message with mode:', action.type, action.text);
      onSendMessage(action.text, action.type as 'show' | 'tell' | 'do');
    }
  };

  return (
    <div
      className={`
        h-full overflow-y-auto px-6 space-y-3
        bg-transparent
      `}
    >
      {messages.length === 0 && !isLoading && (
        <div className="space-y-3">
          {/* Welcome message */}
          <div className="flex justify-start">
            <div className="w-full ">
              <div className="flex gap-2">
              <img src={MarketrixLogo} alt="Marketrix Logo" className="w-6 h-6 object-cover" />
              <div className=" font-inter font-normal text-sm bg-white text-black px-3 py-2 gradient-border">
                Hey! 👋 I'm Marketrix AI, How can I help you
              </div>
              </div>
              <div className="flex items-center justify-between mt-1.5 text-sm font-medium text-[#1D2939]">
                <span>Marketrix AI</span>
                <span className="text-[#667085] text-xs font-normal">
                  {new Date().toLocaleDateString("en-US", { weekday: "long" })}{" "}
                  {new Date().toLocaleTimeString("en-US", {
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Suggested actions - always show */}
      {!isLoading && (
        <div className="space-y-2">
          {suggestedActions.map((action, index) => (
            <div key={index} className="flex justify-start">
              <button
                onClick={(e) => handleSuggestedActionClick(action, e)}
                className={`
                  w-full font-inter font-normal text-sm px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 text-left hover:shadow-md
                  ${
                    action.isShow
                      ? "bg-white border border-gray-200 hover:bg-gray-50"
                      : "bg-white border border-gray-200 hover:bg-gray-50"
                  }
                `}
              >
                <div className="text-sm text-black flex items-center space-x-2">
                  <span className="text-black">{action.icon}</span>
                  <span className="font-normal">
                    {action.type === "show" ? (
                      <>
                        <span className="font-bold">Show me</span>
                        {action.text.replace("Show me", "")}
                      </>
                    ) : (
                      action.text
                    )}
                  </span>
                </div>
              </button>
            </div>
          ))}
        </div>
      )}

      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex flex-col gap-1 ${
            message.sender === "user" ? "justify-end" : "justify-start"
          }`}
        >
          <div
            className={`flex flex-col gap-2 justify-between
              w-full px-3 py-3 rounded-l-md rounded-b-md shadow-sm border
              ${
                message.sender === "user"
                  ? "bg-[#101828] text-white"
                  : "bg-white text-black border-gray-200"
              }
            `}
          >
             {message.sender === "user" && message.mode && (
               <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#6941C6] text-white text-xs font-medium rounded-2xl w-fit">
                 {message.mode === "show" ? (
                   <LuMousePointerClick className="w-3 h-3" />
                 ) : message.mode === "tell" ? (
                   <IoChatbubbleEllipsesOutline className="w-3 h-3" />
                 ) : message.mode === "do" ? (
                   <SiTicktick className="w-3 h-3" />
                 ) : null}
                 {message.mode === "show"
                   ? "Show"
                   : message.mode === "tell"
                   ? "Tell"
                   : message.mode === "do"
                   ? "Do"
                   : message.mode}
               </span>
             )}
            {/* Message content */}
            <div className="text-sm font-inter font-normal whitespace-pre-wrap break-words">
              {message.content}
            </div>

            {/* Message metadata */}
            {/* <div
              className={`
              flex items-center justify-between mt-1.5 text-xs
              ${message.sender === "user" ? "text-purple-100" : "text-gray-500"}
            `}
            ></div> */}
          </div>
          <div className="flex items-center justify-between text-xs font-inter font-normal">
            <div className="items-center gap-2">
              <span>{message.sender === "user" ? "You" : "Marketrix AI"}</span>
            </div>
            <span>{formatMessageTime(message.timestamp)}</span>
          </div>
        </div>
      ))}

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex justify-start">
          <div className="w-full px-3 py-2 rounded-2xl bg-white shadow-sm border border-gray-200">
            <div className="flex items-center space-x-2">
              <div className="flex space-x-1">
                <div className="w-2 h-2 bg-gradient-to-r from-green-400 to-purple-500 rounded-full animate-bounce"></div>
                <div
                  className="w-2 h-2 bg-gradient-to-r from-green-400 to-purple-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.1s" }}
                ></div>
                <div
                  className="w-2 h-2 bg-gradient-to-r from-green-400 to-purple-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                ></div>
              </div>
              <span className="text-xs text-gray-500">Typing...</span>
            </div>
          </div>
        </div>
      )}

      {/* Auto-scroll anchor */}
      <div ref={messagesEndRef} />
    </div>
  );
};
