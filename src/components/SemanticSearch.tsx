/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Search, FileText, Compass, CornerDownRight, Loader2, BarChart2 } from "lucide-react";
import { SearchResult } from "../types";

interface SemanticSearchProps {
  documentsCount: number;
}

export default function SemanticSearch({ documentsCount }: SemanticSearchProps) {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setSearched(true);

    try {
      const response = await fetch("/api/documents/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit: 5 }),
      });

      if (!response.ok) {
        throw new Error("Failed to execute semantic search");
      }

      const data = await response.json();
      setResults(data);
    } catch (error) {
      console.error("Semantic search error:", error);
    } finally {
      setIsSearching(false);
    }
  };

  // Safe keyword highlighter
  const renderHighlightedText = (text: string, searchString: string) => {
    if (!searchString.trim()) return text;
    
    const words = searchString
      .split(/\s+/)
      .filter((w) => w.length > 2)
      .map((w) => w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&'));
      
    if (words.length === 0) return text;
    
    const regex = new RegExp(`(${words.join("|")})`, "gi");
    const parts = text.split(regex);
    
    return parts.map((part, i) =>
      regex.test(part) ? (
        <mark key={i} className="bg-amber-100/90 text-amber-900 font-medium px-0.5 rounded-sm">
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const getScoreColorClass = (score: number) => {
    if (score > 0.8) return "bg-emerald-50 text-emerald-700 border-emerald-100";
    if (score > 0.6) return "bg-sky-50 text-sky-700 border-sky-100";
    return "bg-slate-50 text-slate-600 border-slate-100";
  };

  return (
    <div id="semantic-search-section" className="flex flex-col h-full bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between">
        <div>
          <h2 className="font-sans font-semibold text-sm text-slate-800 tracking-tight">
            Semantic Vector Search
          </h2>
          <p className="text-[10px] text-slate-500 font-sans mt-0.5">
            Query your database using semantic concepts instead of literal keywords
          </p>
        </div>
        <Compass size={16} className="text-indigo-500" />
      </div>

      {/* Search Input Box */}
      <div className="p-6 border-b border-slate-100 bg-slate-50/50">
        <form onSubmit={handleSearch} className="relative flex items-center gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              id="search-input-field"
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={
                documentsCount > 0
                  ? "Describe what concepts you want to find across all documents..."
                  : "Ingest a document first to activate search query..."
              }
              disabled={documentsCount === 0 || isSearching}
              className="w-full bg-white border border-slate-200 rounded-lg pl-10 pr-4 py-2 text-xs font-sans placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed transition-all duration-200"
            />
          </div>
          <button
            id="search-submit-button"
            type="submit"
            disabled={documentsCount === 0 || isSearching || !query.trim()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-200 text-white disabled:text-slate-400 font-sans font-semibold text-xs rounded-lg flex items-center gap-1.5 cursor-pointer disabled:cursor-not-allowed transition-all shadow-sm"
          >
            {isSearching ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Search size={13} />
            )}
            Search
          </button>
        </form>
      </div>

      {/* Search Results Display Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">
        {isSearching ? (
          <div className="flex flex-col items-center justify-center h-full py-12">
            <Loader2 size={24} className="text-indigo-600 animate-spin mb-3" />
            <p className="text-xs font-sans text-slate-500">
              Querying vector embeddings...
            </p>
          </div>
        ) : !searched ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
            <Compass size={28} className="text-slate-300 mb-2" />
            <h4 className="text-xs font-semibold text-slate-600 font-sans">
              Conceptual matching engine
            </h4>
            <p className="text-xs text-slate-400 font-sans mt-1 max-w-[240px]">
              Type a topic, question, or conceptual phrase to search. Results are retrieved by vector similarity.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
            <Compass size={24} className="text-slate-300 mb-2" />
            <p className="text-xs font-sans text-slate-500">
              No matching vectors were found for your query. Try rephrasing.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              <span>Matching Fragments ({results.length})</span>
              <span className="flex items-center gap-1">
                <BarChart2 size={10} /> Cosine Similarity Score
              </span>
            </div>

            <div className="space-y-3">
              {results.map((res, idx) => (
                <div
                  key={res.chunk.id}
                  id={`search-result-${idx}`}
                  className="flex flex-col p-4 border border-slate-100 rounded-xl bg-white hover:border-slate-200/80 hover:shadow-xs transition-all duration-200"
                >
                  {/* Result Header info */}
                  <div className="flex items-center justify-between gap-3 mb-2.5">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <FileText size={12} className="text-indigo-500 shrink-0" />
                      <span className="text-xs font-bold text-slate-800 truncate font-sans">
                        {res.chunk.docTitle}
                      </span>
                      <CornerDownRight size={10} className="text-slate-400 shrink-0" />
                      <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-sm font-sans shrink-0">
                        Page {res.chunk.pageNumber}
                      </span>
                    </div>

                    {/* Similarity score badge */}
                    <span
                      className={`px-2 py-0.5 border rounded-full text-[9px] font-mono font-medium ${getScoreColorClass(
                        res.score
                      )}`}
                    >
                      {(res.score * 100).toFixed(1)}% match
                    </span>
                  </div>

                  {/* Excerpt with highlights */}
                  <div className="text-xs text-slate-600 leading-relaxed font-sans bg-slate-50/50 p-3 rounded-lg border border-slate-100/50">
                    "{renderHighlightedText(res.chunk.text, query)}"
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
