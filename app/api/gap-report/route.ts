
import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

type QuizResult = {
  id: string;
  question: string;
  options: {
    id: string;
    text: string;
  }[];
  correctAnswer: string;
  explanation: string;
  source: string;
  selectedAnswer: string | null;
  isCorrect: boolean;
};

type GapTopic = {
  topic: string;
  status: "Weak" | "Medium" | "Strong";
  reason: string;
  correct: number;
  total: number;
};

function decodeHtmlEntities(value: string) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/&#([0-9]+);/g, (_, decimal) =>
      String.fromCharCode(parseInt(decimal, 10))
    )
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function cleanText(value: string) {
  return decodeHtmlEntities(value).trim();
}

export async function POST(request: Request) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error: "GEMINI_API_KEY is not configured.",
        },
        { status: 500 }
      );
    }

    const body = await request.json();

    const results = body?.results as QuizResult[] | undefined;

    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        {
          error: "Quiz results were not provided.",
        },
        { status: 400 }
      );
    }

    const cleanedResults = results.map((result) => ({
      ...result,
      question: cleanText(result.question),
      explanation: cleanText(result.explanation),
      source: cleanText(result.source),
      selectedAnswer: result.selectedAnswer
        ? cleanText(result.selectedAnswer)
        : null,
      options: Array.isArray(result.options)
        ? result.options.map((option) => ({
            ...option,
            text: cleanText(option.text),
          }))
        : [],
    }));

    const context = cleanedResults
      .map(
        (result, index) => `
QUESTION ${index + 1}
Question: ${result.question}
Source: ${result.source}
Correct answer: ${result.correctAnswer}
Student answer: ${result.selectedAnswer ?? "Not answered"}
Correct: ${result.isCorrect ? "Yes" : "No"}
Explanation: ${result.explanation}
`
      )
      .join("\n");

    const genai = new GoogleGenAI({
      apiKey,
    });

    const prompt = `
Analyze the student's diagnostic quiz results.

The purpose is to identify learning gaps from the student's answers.

IMPORTANT RULES:

1. Use ONLY the supplied quiz results.
2. Do not use outside knowledge.
3. Do not invent topics that are unrelated to the supplied questions.
4. Use the supplied Source field to help identify the topic.
5. Group questions that belong to the same topic or source section.
6. Every topic must have a clear reason based on the student's answers.
7. A topic with mostly incorrect or unanswered questions should normally be Weak.
8. A topic with mixed correct and incorrect answers should normally be Medium.
9. A topic where the student answered the relevant questions correctly should normally be Strong.
10. Do not mark a topic Strong if the student got its questions wrong.
11. Keep the diagnosis measurable.
12. The report is a diagnosis, not a general study explanation.
13. Include the number of correct answers and total questions for each topic.
14. Return ONLY valid JSON.

Return exactly this structure:

{
  "overallScore": 0,
  "totalQuestions": 0,
  "topics": [
    {
      "topic": "Topic name",
      "status": "Weak",
      "reason": "Clear reason based on the student's answers.",
      "correct": 0,
      "total": 0
    }
  ]
}

Allowed status values:
- Weak
- Medium
- Strong

QUIZ RESULTS:
${context}
`;

    const response = await genai.models.generateContent({
      model: "gemini-3.5-flash-lite",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text;

    if (!responseText) {
      throw new Error("The AI did not return a gap report.");
    }

    const parsed = JSON.parse(responseText) as {
      overallScore: number;
      totalQuestions: number;
      topics: GapTopic[];
    };

    if (!Array.isArray(parsed.topics) || parsed.topics.length === 0) {
      throw new Error("No topic-level gap analysis was generated.");
    }

    const safeTopics = parsed.topics.map((topic) => ({
      topic: cleanText(topic.topic),
      status:
        topic.status === "Weak" ||
        topic.status === "Medium" ||
        topic.status === "Strong"
          ? topic.status
          : "Medium",
      reason: cleanText(topic.reason),
      correct: Number(topic.correct) || 0,
      total: Number(topic.total) || 0,
    }));

    return NextResponse.json({
      overallScore: Number(parsed.overallScore) || 0,
      totalQuestions:
        Number(parsed.totalQuestions) || cleanedResults.length,
      topics: safeTopics,
    });
  } catch (error) {
    console.error("Gap report error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not generate the gap report.",
      },
      { status: 500 }
    );
  }
}