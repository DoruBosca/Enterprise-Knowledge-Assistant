/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from "react";
import { Upload, FileText, CheckCircle, Trash2, ShieldAlert, Loader2 } from "lucide-react";
import { DocumentMetadata } from "../types";

interface DocumentManagerProps {
  documents: DocumentMetadata[];
  onDocumentIngested: () => void;
  onDocumentDeleted: () => void;
  activeDocId: string | null;
  setActiveDocId: (id: string | null) => void;
}

export default function DocumentManager({
  documents,
  onDocumentIngested,
  onDocumentDeleted,
  activeDocId,
  setActiveDocId,
}: DocumentManagerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<"idle" | "extracting" | "ingesting" | "success" | "error">("idle");
  const [progress, setProgress] = useState(0);
  const [currentFile, setCurrentFile] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    if (file.type !== "application/pdf") {
      setErrorMessage("Only PDF files are supported for enterprise ingestion.");
      setUploadStatus("error");
      return;
    }

    setUploadStatus("extracting");
    setProgress(0);
    setCurrentFile(file.name);
    setErrorMessage(null);

    try {
      // @ts-ignore
      const pdfjsLib = window.pdfjsLib;
      if (!pdfjsLib) {
        throw new Error("PDF parser library could not be loaded. Please refresh the page.");
      }

      // Read PDF file into ArrayBuffer
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const totalPages = pdf.numPages;
      const pages: { pageNumber: number; text: string }[] = [];

      // Extract page by page
      for (let i = 1; i <= totalPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          // @ts-ignore
          .map((item) => item.str)
          .join(" ");

        pages.push({
          pageNumber: i,
          text: pageText,
        });

        setProgress(Math.round((i / totalPages) * 100));
      }

      // Upload parsed pages to backend for chunking & embedding
      setUploadStatus("ingesting");
      const response = await fetch("/api/documents/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: file.name,
          size: file.size,
          totalPages,
          pages,
        }),
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || "Failed to index the document in the knowledge base.");
      }

      setUploadStatus("success");
      onDocumentIngested();
      setTimeout(() => {
        setUploadStatus("idle");
        setProgress(0);
        setCurrentFile(null);
      }, 3000);
    } catch (error: any) {
      console.error("PDF Processing Error:", error);
      setErrorMessage(error.message || "An unexpected error occurred while parsing the PDF.");
      setUploadStatus("error");
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to remove this document from the enterprise index?")) {
      return;
    }

    try {
      const response = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete document");
      }

      onDocumentDeleted();
      if (activeDocId === id) {
        setActiveDocId(null);
      }
    } catch (error: any) {
      alert("Error deleting document: " + error.message);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div id="document-manager-section" className="flex flex-col h-full bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
      {/* Sleek Sidebar Header with brand */}
      <div className="p-6 border-b border-slate-100 shrink-0">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white font-bold font-sans shadow-sm shadow-indigo-100">
            E
          </div>
          <h2 className="text-base font-bold tracking-tight text-slate-800">
            Enterprise AI
          </h2>
        </div>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-2.5 px-4 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold transition-colors border border-indigo-100 cursor-pointer flex items-center justify-center gap-1.5"
        >
          <Upload size={13} />
          Upload Documents
        </button>
      </div>

      {/* PDF Upload Dropzone (Compact & Sleek) */}
      <div className="px-6 py-3 border-b border-slate-100 bg-slate-50/50 shrink-0">
        <div
          id="pdf-dropzone"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={`border border-dashed rounded-lg p-3 text-center transition-all cursor-pointer ${
            isDragging
              ? "border-indigo-500 bg-indigo-50/30"
              : "border-slate-200 bg-white hover:border-slate-300"
          }`}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".pdf"
            className="hidden"
          />

          {uploadStatus === "idle" && (
            <p className="text-[10px] text-slate-400 font-sans">
              Drag & drop a PDF file here to ingest
            </p>
          )}

          {(uploadStatus === "extracting" || uploadStatus === "ingesting") && (
            <div className="flex flex-col items-center">
              <Loader2 size={13} className="text-indigo-600 animate-spin mb-1" />
              <p className="text-[9px] font-medium text-slate-600 font-sans truncate max-w-[180px]">
                {uploadStatus === "extracting" ? "Extracting text..." : "Generating vector index..."}
              </p>
              <div className="w-full bg-slate-100 h-1 rounded-full mt-2 overflow-hidden">
                <div className="bg-indigo-600 h-full transition-all" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          {uploadStatus === "success" && (
            <p className="text-[10px] text-emerald-600 font-semibold font-sans">
              ✓ Document vectorized!
            </p>
          )}

          {uploadStatus === "error" && (
            <div>
              <p className="text-[10px] text-rose-600 font-semibold font-sans">
                ✕ Ingestion failed
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setUploadStatus("idle");
                }}
                className="text-[9px] text-indigo-600 underline font-sans mt-0.5"
              >
                Try again
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Ingested Documents List (Sleek Style) */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-3">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest font-sans">
            Ingested Library
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[180px] text-center border border-dashed border-slate-200/60 rounded-xl px-4">
            <FileText size={22} className="text-slate-300 mb-2" />
            <p className="text-xs font-sans text-slate-400">
              No corporate assets indexed.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => {
              const isActive = activeDocId === doc.id;
              return (
                <div
                  key={doc.id}
                  id={`doc-card-${doc.id}`}
                  onClick={() => setActiveDocId(isActive ? null : doc.id)}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer group ${
                    isActive
                      ? "bg-indigo-50/50 border-indigo-200 shadow-xs"
                      : "bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {/* PDF design badge */}
                  <div className="w-8 h-8 bg-white border border-slate-200 rounded flex items-center justify-center text-red-500 text-[10px] font-bold shrink-0">
                    PDF
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate font-sans">
                      {doc.title}
                    </p>
                    <p className="text-[9px] text-slate-500 uppercase font-semibold tracking-tight mt-0.5">
                      Ready • {formatSize(doc.size)}
                    </p>
                  </div>

                  {/* Action Button */}
                  <button
                    id={`btn-delete-${doc.id}`}
                    type="button"
                    onClick={(e) => handleDelete(doc.id, e)}
                    className="p-1.5 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 shrink-0"
                    title="Delete document"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sleek bottom User Profile */}
      <div className="p-6 border-t border-slate-100 bg-slate-50/30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-indigo-600 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shadow-sm font-sans">
            MC
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-slate-800 truncate">Marcus Chen</p>
            <p className="text-[10px] text-slate-500 font-mono truncate">dorubosca@gmail.com</p>
          </div>
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" title="Admin Active" />
        </div>
      </div>
    </div>
  );
}
