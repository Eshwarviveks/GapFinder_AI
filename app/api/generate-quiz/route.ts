import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { extractText, getDocumentProxy } from "unpdf";
import { createClient } from "@/lib/supabase/server";
import { indexAndRetrieveMaterial } from "@/lib/rag";

type QuizQuestion = {
  id: string;
  question: string;
  options: {
    id: string;
    text: string;
  }[];
  correctAnswer: string;
  explanation: string;
  source: string;
};

function normalizeText(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .trim();
}

async function extractUploadedText(file: File) {
  const fileName = file.name.toLowerCase();
  const buffer = await file.arrayBuffer();

  if (fileName.endsWith(".txt")) {
    return new TextDecoder().decode(buffer);
  }

  if (fileName.endsWith(".pdf")) {
    const pdf = await getDocumentProxy(new Uint8Array(buffer));

    const result = await extractText(pdf, {
      mergePages: true,
    });

    return result.text;
  }

  throw new Error("Only PDF and TXT files are supported.");
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured." },
        { status: 500 }
      );
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json(
        { error: "Please log in before generating a diagnostic quiz." },
        { status: 401 }
      );
    }

    const genai = new GoogleGenAI({ apiKey });
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "No material file was provided." },
        { status: 400 }
      );
    }

    const extractedText = await extractUploadedText(file);
    const text = normalizeText(extractedText);

    if (!text) {
      return NextResponse.json(
        { error: "No readable text was found in the material." },
        { status: 400 }
      );
    }

    // RAG pipeline:
    // 1. chunk the uploaded material
    // 2. generate Gemini document embeddings
    // 3. store vectors in Supabase pgvector
    // 4. embed a diagnostic retrieval query
    // 5. retrieve the most relevant chunks with vector similarity
    const retrievedChunks = await indexAndRetrieveMaterial({
      ai: genai,
      userId: user.id,
      sourceName: file.name,
      text,
    });

    const context = retrievedChunks
      .map(
        (chunk, index) =>
          `RETRIEVED SOURCE ${index + 1}\nFile: ${chunk.source_name}\nChunk: ${chunk.chunk_index + 1}\nSimilarity: ${chunk.similarity.toFixed(3)}\nContent:\n${chunk.content}`
      )
      .join("\n\n");

    const prompt = `
Generate a diagnostic quiz using ONLY the retrieved material below.

IMPORTANT RULES:
1. Use only information contained in the retrieved material.
2. Do not use outside knowledge.
3. Do not invent facts.
4. Do not ask about information that is not present in the retrieved material.
5. Create exactly 5 multiple-choice questions when enough information is available.
6. Each question must have exactly 4 options.
7. Each question must have exactly one correct answer.
8. Explain why the correct answer is correct.
9. Include a source citation for every question.
10. The source citation must identify the file and retrieved chunk used to create the question.
11. Questions should cover different retrieved chunks where possible.
12. Questions should test understanding rather than simply copying a sentence.
13. If the retrieved material does not contain enough information for 5 valid questions, create fewer valid questions rather than inventing information.
14. Return ONLY valid JSON.
15. The JSON must follow exactly this structure:

{
  "questions": [
    {
      "id": "q1",
      "question": "Question text",
      "options": [
        { "id": "A", "text": "Option A" },
        { "id": "B", "text": "Option B" },
        { "id": "C", "text": "Option C" },
        { "id": "D", "text": "Option D" }
      ],
      "correctAnswer": "A",
      "explanation": "Why this answer is correct.",
      "source": "filename.pdf — retrieved chunk 3"
    }
  ]
}

This is a diagnostic quiz, so questions should help identify whether the student understands important topics from the retrieved material.

RETRIEVED MATERIAL:
${context}
`;

    let response;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        response = await genai.models.generateContent({
          model: "gemini-3.5-flash-lite",
          contents: prompt,
          config: {
            responseMimeType: "application/json",
          },
        });
        break;
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message.toLowerCase()
            : String(error).toLowerCase();

        const isTemporaryError =
          message.includes("503") ||
          message.includes("unavailable") ||
          message.includes("high demand") ||
          message.includes("temporarily");

        if (!isTemporaryError || attempt === 3) {
          throw error;
        }

        await new Promise((resolve) =>
          setTimeout(resolve, attempt * 2000)
        );
      }
    }

    if (!response) {
      throw new Error("The AI did not return a quiz.");
    }

    const responseText = response.text;

    if (!responseText) {
      throw new Error("The AI did not return a quiz.");
    }

    const parsed = JSON.parse(responseText) as {
      questions: QuizQuestion[];
    };

    if (
      !Array.isArray(parsed.questions) ||
      parsed.questions.length === 0
    ) {
      throw new Error("No quiz questions were generated.");
    }

    return NextResponse.json({
      questions: parsed.questions,
    });
  } catch (error) {
    console.error("Quiz generation error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not generate the diagnostic quiz.",
      },
      { status: 500 }
    );
  }
}
