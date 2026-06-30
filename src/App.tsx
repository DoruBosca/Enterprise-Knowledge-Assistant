/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import { MessageSquare, Search, Database, Bot, HelpCircle, Sparkles } from "lucide-react";
import DocumentManager from "./components/DocumentManager";
import SemanticSearch from "./components/SemanticSearch";
import Chatbot from "./components/Chatbot";
import { DocumentMetadata } from "./types";

export default function App() {
  const [documents, setDocuments] = useState<DocumentMetadata[]>([]);
  const [activeTab, setActiveTab] = useState<"chatbot" | "search">("chatbot");
  const [activeDocId, setActiveDocId] = useState<string | null>(null);
  const [isLoadingDocs, setIsLoadingDocs] = useState(true);

  // Centralized documents fetch
  const fetchDocuments = async () => {
    try {
      setIsLoadingDocs(true);
      const response = await fetch("/api/documents");
      if (response.ok) {
        const data = await response.json();
        setDocuments(data);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setIsLoadingDocs(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  return (
    <div id="app-wrapper" className="flex flex-col h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      {/* Sleek Top Navigation Bar */}
      <header className="h-16 shrink-0 bg-white border-b border-slate-200/80 px-8 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-slate-800">Knowledge Hub</span>
            <span className="text-slate-300">/</span>
            <span className="text-sm font-bold text-indigo-600 flex items-center gap-1.5">
              Enterprise AI Assistant
              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-50 text-indigo-700 font-mono border border-indigo-100">
                v1.2.0
              </span>
            </span>
          </div>
        </div>

        {/* Navigation Tabs (Sleek Style) */}
        <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/40">
          <button
            id="tab-chatbot"
            type="button"
            onClick={() => setActiveTab("chatbot")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all cursor-pointer ${
              activeTab === "chatbot"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <MessageSquare size={13} />
            Knowledge Chatbot
          </button>
          <button
            id="tab-search"
            type="button"
            onClick={() => setActiveTab("search")}
            className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold tracking-tight transition-all cursor-pointer ${
              activeTab === "search"
                ? "bg-white text-indigo-600 shadow-sm"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            <Search size={13} />
            Semantic Search
          </button>
        </div>

        {/* Right Status Panel */}
        <div className="flex items-center gap-4">
          <div className="px-2.5 py-1 bg-green-50 text-green-700 text-[10px] font-bold rounded border border-green-200 tracking-wider">
            SYSTEM ACTIVE
          </div>
        </div>
      </header>

      {/* Main Content Layout Grid */}
      <main className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-4 p-8 gap-8 min-h-0">
        {/* Left Column - Document Ingestion Sidebar Manager (1 col) */}
        <div className="md:col-span-1 h-full min-h-0">
          <DocumentManager
            documents={documents}
            onDocumentIngested={fetchDocuments}
            onDocumentDeleted={fetchDocuments}
            activeDocId={activeDocId}
            setActiveDocId={setActiveDocId}
          />
        </div>

        {/* Right Column - Active Tool (3 cols) */}
        <div className="md:col-span-3 h-full min-h-0">
          {activeTab === "chatbot" ? (
            <Chatbot documentsCount={documents.length} />
          ) : (
            <SemanticSearch documentsCount={documents.length} />
          )}
        </div>
      </main>
    </div>
  );
}
