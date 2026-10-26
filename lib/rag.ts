import { GoogleGenAI } from "@google/genai";
import { createClient } from "@/lib/supabase/server";

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_DIMENSIONS = 768;
const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 200;

export type RetrievedChunk = {
  id: number;
  source_name: string;
  chunk_index: number;
  content: string;
  similarity: number;
};

function normalizeText(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .trim();
}

export function chunkText(text: string) {
  const normalized = normalizeText(text);
  const chunks: string[] = [];

  for (
    let start = 0;
    start < normalized.length;
    start += CHUNK_SIZE - CHUNK_OVERLAP
  ) {
    const chunk = normalized.slice(start, start + CHUNK_SIZE).trim();

    if (chunk) {
      chunks.push(chunk);
    }
  }

  return chunks;
}

async function embedTexts(ai: GoogleGenAI, texts: string[]) {
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: texts,
    config: {
      taskType: "RETRIEVAL_DOCUMENT",
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  });

  const embeddings = (response.embeddings ?? []).map(
    (embedding) => embedding.values ?? []
  );

  if (embeddings.length !== texts.length) {
    throw new Error("The embedding service returned an unexpected number of vectors.");
  }

  return embeddings;
}

async function embedQuery(ai: GoogleGenAI, query: string) {
  const response = await ai.models.embedContent({
    model: EMBEDDING_MODEL,
    contents: query,
    config: {
      taskType: "RETRIEVAL_QUERY",
      outputDimensionality: EMBEDDING_DIMENSIONS,
    },
  });

  const embedding = response.embeddings?.[0]?.values;

  if (!embedding) {
    throw new Error("The embedding service did not return a query vector.");
  }

  return embedding;
}

export async function indexAndRetrieveMaterial({
  ai,
  userId,
  sourceName,
  text,
}: {
  ai: GoogleGenAI;
  userId: string;
  sourceName: string;
  text: string;
}) {
  const chunks = chunkText(text);

  if (chunks.length === 0) {
    throw new Error("No readable content was available for RAG indexing.");
  }

  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("document_chunks")
    .delete()
    .eq("user_id", userId)
    .eq("source_name", sourceName);

  if (deleteError) {
    throw new Error(`Could not prepare the RAG index: ${deleteError.message}`);
  }

  const embeddings = await embedTexts(ai, chunks);

  const rows = chunks.map((content, index) => ({
    user_id: userId,
    source_name: sourceName,
    chunk_index: index,
    content,
    embedding: embeddings[index],
  }));

  const { error: insertError } = await supabase
    .from("document_chunks")
    .insert(rows);

  if (insertError) {
    throw new Error(`Could not store RAG embeddings: ${insertError.message}`);
  }

  const diagnosticQuery =
    "Important concepts, definitions, principles, processes, methods, applications, and relationships needed to test a student's understanding of this material.";

  const queryEmbedding = await embedQuery(ai, diagnosticQuery);

  const { data, error: retrievalError } = await supabase.rpc(
    "match_document_chunks",
    {
      query_embedding: queryEmbedding,
      match_user_id: userId,
      match_source_name: sourceName,
      match_threshold: 0.25,
      match_count: 8,
    }
  );

  if (retrievalError) {
    throw new Error(`Could not retrieve RAG context: ${retrievalError.message}`);
  }

  const retrievedChunks = (data ?? []) as RetrievedChunk[];

  if (retrievedChunks.length === 0) {
    throw new Error("No relevant material was found by vector retrieval.");
  }

  return retrievedChunks;
}
