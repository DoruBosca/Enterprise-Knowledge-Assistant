/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface DocumentMetadata {
  id: string;
  title: string;
  size: number;
  totalPages: number;
  chunkCount: number;
  ingestedAt: string;
}

export interface DocumentChunk {
  id: string;
  docId: string;
  docTitle: string;
  pageNumber: number;
  text: string;
  score?: number; // similarity score
}

export interface Citation {
  docId: string;
  docTitle: string;
  pageNumber: number;
  textPreview: string;
}

export interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  timestamp: string;
  citations?: Citation[];
  isLoading?: boolean;
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}
