/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { MessageSquare, Send, Bot, User, Loader2, Sparkles, AlertCircle, Bookmark, FileText, CornerDownRight } from "lucide-react";
import Markdown from "react-markdown";
import { Message, Citation } from "../types";

interface ChatbotProps {
  documentsCount: number;
}

export default function Chatbot({ documentsCount }: ChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "initial-msg",
      sender: "assistant",
      text: "Hello! I am your Enterprise Knowledge Assistant. Upload PDFs into the repository on the left and ask me questions — I will answer grounded in your documents and cite precise sources.",
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [activeInspection, setActiveInspection] = useState<Citation | null>(null);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSending) return;

    const queryText = input.trim();
    setInput("");
    
    // Create new user message
    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      sender: "user",
      text: queryText,
      timestamp: new Date().toISOString(),
    };

    // Placeholder assistant message
    const assistantPlaceholder: Message = {
      id: `msg-${Date.now()}-assistant`,
      sender: "assistant",
      text: "",
      timestamp: new Date().toISOString(),
      isLoading: true,
    };

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setIsSending(true);

    try {
      const chatHistory = messages
        .filter((msg) => msg.id !== "initial-msg")
        .map((msg) => ({
          sender: msg.sender,
          text: msg.text,
        }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [...chatHistory, { sender: "user", text: queryText }],
          currentQuery: queryText,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to process chat with model");
      }

      const data = await response.json();

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantPlaceholder.id
            ? {
                ...msg,
                text: data.text,
                citations: data.citations || [],
                isLoading: false,
              }
            : msg
        )
      );
    } catch (error) {
      console.error("Chat sending error:", error);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantPlaceholder.id
            ? {
                ...msg,
                text: "I encountered an error trying to process that request. Please try again.",
                isLoading: false,
              }
            : msg
        )
      );
    } finally {
      setIsSending(false);
    }
  };

  const formatTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Click handler to display cited page chunk details in secondary inspection sidebar
  const inspectSource = (citation: Citation) => {
    setActiveInspection(citation);
  };

  return (
    <div id="chatbot-container" className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-full min-h-0">
      {/* Primary Chat View (takes 2 cols if inspection pane is active, or full list otherwise) */}
      <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden transition-all duration-300 lg:col-span-2">
        {/* Chat Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-sm shadow-indigo-100 font-sans">
              AI
            </div>
            <div>
              <h2 className="font-sans font-semibold text-sm text-slate-800 tracking-tight flex items-center gap-2">
                Enterprise Grounded Bot
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-50 text-green-700 border border-green-200/50">
                  ACTIVE GROUNDING
                </span>
              </h2>
            </div>
          </div>

          <div className="text-[10px] text-slate-400 font-mono">
            {documentsCount === 0 ? "No index" : `${documentsCount} document(s)`}
          </div>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/40">
          {messages.map((msg) => (
            <div
              key={msg.id}
              id={`message-bubble-${msg.id}`}
              className={`flex gap-4 ${msg.sender === "user" ? "justify-end" : ""}`}
            >
              {/* Profile Avatar Icon for Assistant */}
              {msg.sender !== "user" && (
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold font-sans shadow-sm shadow-indigo-100">
                  AI
                </div>
              )}

              {/* Message bubble core */}
              <div className="flex flex-col max-w-[80%] min-w-0">
                <div
                  className={`p-5 rounded-2xl text-xs leading-relaxed shadow-sm border ${
                    msg.sender === "user"
                      ? "bg-slate-100 text-slate-800 border-slate-200/60 rounded-tr-none"
                      : "bg-white text-slate-700 border-slate-200/60 rounded-tl-none"
                  }`}
                >
                  {msg.isLoading ? (
                    <div className="flex items-center gap-2 py-1 text-slate-400 font-sans">
                      <Loader2 size={13} className="animate-spin" />
                      <span>Matching facts and compiling cited sources...</span>
                    </div>
                  ) : (
                    <div className="markdown-body">
                      <Markdown>{msg.text}</Markdown>
                    </div>
                  )}
                </div>

                {/* Citations metadata drawer trigger */}
                {msg.citations && msg.citations.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 mt-3">
                    <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mr-1 font-sans">
                      Sources:
                    </span>
                    {msg.citations.map((citation, idx) => (
                      <button
                        key={idx}
                        id={`btn-citation-${msg.id}-${idx}`}
                        type="button"
                        onClick={() => inspectSource(citation)}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border cursor-pointer transition-all ${
                          activeInspection?.docId === citation.docId &&
                          activeInspection?.pageNumber === citation.pageNumber
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-xs"
                            : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100/60 border-indigo-100"
                        }`}
                      >
                        <Bookmark size={9} />
                        <span className="max-w-[100px] truncate">{citation.docTitle}</span>
                        <span className="font-bold opacity-80">p. {citation.pageNumber}</span>
                      </button>
                    ))}
                  </div>
                )}

                <span
                  className={`text-[9px] text-slate-400 font-mono mt-2 ${
                    msg.sender === "user" ? "text-right" : ""
                  }`}
                >
                  {formatTime(msg.timestamp)}
                </span>
              </div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Chat input form */}
        <div className="p-6 border-t border-slate-100 bg-white">
          {documentsCount === 0 && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-start gap-2.5 text-xs text-amber-800 font-sans">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <p>
                <strong>No documents indexed:</strong> Ingest a PDF using the left-hand manager panel to allow the assistant to find factual source information.
              </p>
            </div>
          )}

          <form onSubmit={handleSend} className="max-w-3xl mx-auto flex items-center gap-3 p-1.5 bg-slate-50 border border-slate-200 rounded-xl">
            <input
              id="chat-input-field"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                documentsCount > 0
                  ? "Ask anything about the ingested documents..."
                  : "Ingest a PDF to begin conversations..."
              }
              disabled={documentsCount === 0 || isSending}
              className="w-full bg-transparent border-none text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-0 pl-3.5 py-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              id="chat-submit-button"
              type="submit"
              disabled={documentsCount === 0 || isSending || !input.trim()}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-sans font-semibold text-xs rounded-lg flex items-center gap-1.5 shrink-0 cursor-pointer disabled:cursor-not-allowed shadow-sm transition-colors"
            >
              {isSending ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <>
                  <span>Send</span>
                  <Send size={11} />
                </>
              )}
            </button>
          </form>
          <p className="text-center mt-3 text-[9px] text-slate-400 uppercase tracking-widest font-bold">
            Grounded on corporate repository assets
          </p>
        </div>
      </div>

      {/* Citation / Source Inspection Panel */}
      <div className="flex flex-col h-full bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden lg:col-span-1">
        <div className="px-6 py-5 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
          <div>
            <h3 className="font-sans font-semibold text-sm text-slate-800 tracking-tight">
              Source Inspection
            </h3>
            <p className="text-[10px] text-slate-500 font-sans mt-0.5">
              Verify grounding fact excerpts
            </p>
          </div>
          <Bookmark size={16} className="text-indigo-500" />
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeInspection ? (
            <div id="active-citation-inspect" className="space-y-4">
              <div className="flex items-center gap-1.5 p-3.5 bg-indigo-50/40 rounded-xl border border-indigo-100/50">
                <FileText size={16} className="text-indigo-600 shrink-0" />
                <div className="min-w-0">
                  <h4 className="text-xs font-bold text-slate-800 truncate font-sans">
                    {activeInspection.docTitle}
                  </h4>
                  <p className="text-[10px] text-slate-500 font-sans mt-0.5">
                    Citation mapped to page: <strong>{activeInspection.pageNumber}</strong>
                  </p>
                </div>
              </div>

              <div>
                <span className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider font-sans block mb-2">
                  Document Excerpt
                </span>
                <div className="text-xs text-slate-600 leading-relaxed font-sans bg-slate-50 border border-slate-100 p-4 rounded-xl relative before:content-['“'] before:text-slate-300 before:text-3xl before:font-serif before:absolute before:top-2 before:left-2 pl-7.5">
                  {activeInspection.textPreview}
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setActiveInspection(null)}
                  className="w-full py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 font-sans font-semibold text-xs rounded-xl border border-slate-200 transition-colors cursor-pointer"
                >
                  Clear Inspection
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4 bg-slate-50/20">
              <Bookmark size={24} className="text-slate-300 mb-2" />
              <h4 className="text-xs font-semibold text-slate-600 font-sans">
                No active source citation
              </h4>
              <p className="text-xs text-slate-400 font-sans mt-1 max-w-[240px]">
                Click on any citation badge in the chatbot answers to inspect the exact grounding text.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
