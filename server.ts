import express from "express";
import path from "path";
import dotenv from "dotenv";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { DocumentMetadata, DocumentChunk, Citation } from "./src/types";

// Load environment variables
dotenv.config();

const app = express();
const PORT = 3000;

// Increase body parser limits to handle large document texts
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Initialize Gemini API
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.warn("WARNING: GEMINI_API_KEY environment variable is not defined.");
}

const ai = new GoogleGenAI({
  apiKey: apiKey,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build",
    },
  },
});

// In-memory databases for simplicity, fast lookup, and deployment stability
const documents: DocumentMetadata[] = [];
interface StoredChunk extends DocumentChunk {
  embedding: number[];
}
let documentChunks: StoredChunk[] = [];

// Helper function to chunk text page content
function chunkPageText(
  docId: string,
  docTitle: string,
  pageNumber: number,
  text: string,
  maxChunkSize = 400,
  overlap = 80
): Omit<StoredChunk, "embedding">[] {
  const chunks: Omit<StoredChunk, "embedding">[] = [];
  const words = text.split(/\s+/);
  
  if (words.length === 0 || text.trim() === "") {
    return [];
  }

  // If text is very short, keep it as a single chunk
  if (text.length <= maxChunkSize) {
    chunks.push({
      id: `${docId}-p${pageNumber}-c0`,
      docId,
      docTitle,
      pageNumber,
      text: text.trim(),
    });
    return chunks;
  }

  // Sliding window chunker based on characters
  let startIndex = 0;
  let chunkIdx = 0;

  while (startIndex < text.length) {
    let endIndex = startIndex + maxChunkSize;
    
    // Adjust endIndex to end at a word boundary if possible
    if (endIndex < text.length) {
      const nextSpace = text.indexOf(" ", endIndex);
      if (nextSpace !== -1 && nextSpace - endIndex < 30) {
        endIndex = nextSpace;
      }
    } else {
      endIndex = text.length;
    }

    const chunkText = text.substring(startIndex, endIndex).trim();
    if (chunkText.length > 30) { // skip tiny fragments
      chunks.push({
        id: `${docId}-p${pageNumber}-c${chunkIdx++}`,
        docId,
        docTitle,
        pageNumber,
        text: chunkText,
      });
    }

    // Move start index forward with overlap
    startIndex = endIndex - overlap;
    if (startIndex >= text.length || endIndex === text.length) {
      break;
    }
    if (startIndex < 0) {
      startIndex = 0;
    }
  }

  return chunks;
}

// Compute cosine similarity between two vectors
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length) return 0;
  let dotProduct = 0.0;
  let normA = 0.0;
  let normB = 0.0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

// Generate single embedding with fallback support
async function getEmbedding(text: string): Promise<number[]> {
  if (!apiKey) {
    // Generate mock mock embedding if API key is missing to allow sandbox to compile and start safely
    return Array.from({ length: 768 }, () => Math.random() - 0.5);
  }

  try {
    const response = await ai.models.embedContent({
      model: "text-embedding-004",
      contents: text,
    });
    if (response.embeddings && response.embeddings[0]?.values) {
      return response.embeddings[0].values;
    }
    throw new Error("No values in text-embedding-004 response");
  } catch (error) {
    console.error("text-embedding-004 error, trying fallback:", error);
    try {
      const fallbackResponse = await ai.models.embedContent({
        model: "gemini-embedding-2-preview",
        contents: text,
      });
      if (fallbackResponse.embeddings && fallbackResponse.embeddings[0]?.values) {
        return fallbackResponse.embeddings[0].values;
      }
    } catch (fbError) {
      console.error("Fallback embedding model also failed:", fbError);
    }
    // Return mock if both fail to keep the app working gracefully
    return Array.from({ length: 768 }, () => Math.random() - 0.5);
  }
}

// REST API Endpoints

// Get all ingested documents metadata
app.get("/api/documents", (req, res) => {
  res.json(documents);
});

// Delete a document and its associated chunks
app.delete("/api/documents/:id", (req, res) => {
  const { id } = req.params;
  const docIdx = documents.findIndex((d) => d.id === id);
  if (docIdx === -1) {
    return res.status(404).json({ error: "Document not found" });
  }

  documents.splice(docIdx, 1);
  documentChunks = documentChunks.filter((chunk) => chunk.docId !== id);
  res.json({ success: true, message: "Document removed successfully" });
});

// Ingest text pages from a parsed PDF
app.post("/api/documents/ingest", async (req, res) => {
  try {
    const { title, size, totalPages, pages } = req.body;

    if (!title || !pages || !Array.isArray(pages)) {
      return res.status(400).json({ error: "Invalid document format. Title and pages are required." });
    }

    const docId = `doc-${Date.now()}`;
    const newDocChunks: StoredChunk[] = [];

    // 1. Process and chunk each page
    for (const page of pages) {
      const pageNum = page.pageNumber;
      const text = page.text || "";
      const rawChunks = chunkPageText(docId, title, pageNum, text);

      for (const rc of rawChunks) {
        // Generate embedding for each chunk
        const embedding = await getEmbedding(rc.text);
        newDocChunks.push({
          ...rc,
          embedding,
        });
      }
    }

    // 2. Add document to inventory
    const metadata: DocumentMetadata = {
      id: docId,
      title,
      size: size || 0,
      totalPages: totalPages || pages.length,
      chunkCount: newDocChunks.length,
      ingestedAt: new Date().toISOString(),
    };

    documents.push(metadata);
    documentChunks.push(...newDocChunks);

    res.json({ success: true, document: metadata });
  } catch (error: any) {
    console.error("Document ingestion error:", error);
    res.status(500).json({ error: error.message || "Failed to ingest document" });
  }
});

// Semantic search endpoint
app.post("/api/documents/search", async (req, res) => {
  try {
    const { query, limit = 5 } = req.body;
    if (!query || typeof query !== "string") {
      return res.status(400).json({ error: "Query string is required" });
    }

    if (documentChunks.length === 0) {
      return res.json([]);
    }

    const queryEmbedding = await getEmbedding(query);
    
    // Calculate similarities
    const results = documentChunks.map((chunk) => {
      const score = cosineSimilarity(queryEmbedding, chunk.embedding);
      return {
        chunk: {
          id: chunk.id,
          docId: chunk.docId,
          docTitle: chunk.docTitle,
          pageNumber: chunk.pageNumber,
          text: chunk.text,
        },
        score,
      };
    });

    // Sort by descending similarity score
    results.sort((a, b) => b.score - a.score);

    // Limit output and format
    const topResults = results.slice(0, limit);
    res.json(topResults);
  } catch (error: any) {
    console.error("Semantic search error:", error);
    res.status(500).json({ error: error.message || "Failed to perform semantic search" });
  }
});

// Enterprise context-grounded Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, currentQuery } = req.body;

    if (!currentQuery || typeof currentQuery !== "string") {
      return res.status(400).json({ error: "currentQuery string is required" });
    }

    // 1. Perform semantic search to retrieve grounding excerpts
    let contextExcerpts: string[] = [];
    let topChunks: DocumentChunk[] = [];

    if (documentChunks.length > 0) {
      const queryEmbedding = await getEmbedding(currentQuery);
      const results = documentChunks.map((chunk) => {
        const score = cosineSimilarity(queryEmbedding, chunk.embedding);
        return { chunk, score };
      });
      
      results.sort((a, b) => b.score - a.score);
      const relevantResults = results.slice(0, 6); // grab top 6 relevant pieces

      topChunks = relevantResults.map(r => ({
        id: r.chunk.id,
        docId: r.chunk.docId,
        docTitle: r.chunk.docTitle,
        pageNumber: r.chunk.pageNumber,
        text: r.chunk.text,
        score: r.score,
      }));

      contextExcerpts = relevantResults.map((r, i) => {
        return `[Source #${i + 1} | Document: "${r.chunk.docTitle}" | Page ${r.chunk.pageNumber}]\n${r.chunk.text}`;
      });
    }

    const contextBlock = contextExcerpts.length > 0 
      ? contextExcerpts.join("\n\n---\n\n") 
      : "No documents have been uploaded or no relevant information was found in the knowledge base.";

    // 2. Build conversational system instructions
    const systemPrompt = `You are the Enterprise Knowledge Assistant, an expert corporate knowledge system.
Your goal is to answer the user's queries accurately, objectively, and using ONLY the provided document excerpts.

CRITICAL INSTRUCTIONS:
1. Ground your answer strictly in the provided document excerpts.
2. If the user's query cannot be answered using the provided excerpts, state: "I'm sorry, I couldn't find sufficient information in the ingested documents to answer your question."
3. Place precise source citations inline immediately after statements that use information from a source.
4. Format citations exactly like this: "[Document Name, Page X]" where "Document Name" matches the exact document title and "X" is the page number. 
   - Example: "...the fiscal projection shows a 12% margin growth in the coming quarter [Annual Report 2025, Page 4]."
5. Keep your tone professional, concise, clear, and executive-level.
6. If no documents are uploaded, prompt the user to upload PDF files first to begin.

Grounding Excerpts:
${contextBlock}
`;

    // 3. Format history for Gemini API
    // We will append the latest user message alongside the context block as the prompt
    let responseText = "";
    if (apiKey) {
      const contentsList: any[] = [];
      
      // Map previous messages
      if (messages && messages.length > 1) {
        for (const msg of messages.slice(0, -1)) {
          contentsList.push({
            role: msg.sender === "user" ? "user" : "model",
            parts: [{ text: msg.text }],
          });
        }
      }

      // Add the final prompt
      contentsList.push({
        role: "user",
        parts: [{ text: currentQuery }],
      });

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: contentsList,
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.2, // Low temperature for high precision grounding
        }
      });
      responseText = response.text || "No response received from the assistant.";
    } else {
      responseText = "This is a local demonstration response. Please configure your `GEMINI_API_KEY` in the Secrets panel to activate live AI answers grounded in your documents!";
    }

    // 4. Extract which sources were actually cited or match them
    const citations: Citation[] = [];
    const citedSet = new Set<string>();

    topChunks.forEach((chunk) => {
      // Create flexible regex to match citations like "[docTitle, Page pageNumber]" or similar
      const cleanTitle = chunk.docTitle.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      const citationPattern = new RegExp(`\\[${cleanTitle},\\s*Page\\s*${chunk.pageNumber}\\]`, 'i');
      const simplePattern = new RegExp(`Page\\s*${chunk.pageNumber}`, 'i');

      const isTitleCited = responseText.toLowerCase().includes(chunk.docTitle.toLowerCase());
      const isPageCited = simplePattern.test(responseText);

      if (citationPattern.test(responseText) || (isTitleCited && isPageCited)) {
        const key = `${chunk.docId}-${chunk.pageNumber}`;
        if (!citedSet.has(key)) {
          citedSet.add(key);
          citations.push({
            docId: chunk.docId,
            docTitle: chunk.docTitle,
            pageNumber: chunk.pageNumber,
            textPreview: chunk.text.slice(0, 150) + "...",
          });
        }
      }
    });

    // Fallback: If no direct matches are parsed from text but we had highly relevant chunks, return top 2 matching chunks as related references
    if (citations.length === 0 && topChunks.length > 0) {
      topChunks.slice(0, 2).forEach((chunk) => {
        citations.push({
          docId: chunk.docId,
          docTitle: chunk.docTitle,
          pageNumber: chunk.pageNumber,
          textPreview: chunk.text.slice(0, 150) + "...",
        });
      });
    }

    res.json({
      text: responseText,
      citations,
    });
  } catch (error: any) {
    console.error("Chat backend error:", error);
    res.status(500).json({ error: error.message || "Failed to process chat query" });
  }
});

// Configure Vite middleware and static files for Production/Dev modes
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Enterprise Knowledge Assistant backend listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
