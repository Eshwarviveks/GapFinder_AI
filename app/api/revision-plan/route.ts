import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

type Topic = {
  topic: string;
  status: "Weak" | "Medium" | "Strong";
  reason: string;
  correct: number;
  total: number;
};

function normalizeText(text: string) {
  return text
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "")
    .trim();
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

    const topics = body?.topics as Topic[];
    const availableTime = Number(body?.availableTime);

    if (!Array.isArray(topics) || topics.length === 0) {
      return NextResponse.json(
        {
          error: "No gap report topics were provided.",
        },
        { status: 400 }
      );
    }

    if (!availableTime || availableTime <= 0) {
      return NextResponse.json(
        {
          error: "Please provide the available revision time.",
        },
        { status: 400 }
      );
    }

    const genai = new GoogleGenAI({
      apiKey,
    });

    const topicContext = topics
      .map(
        (topic, index) =>
          `${index + 1}. Topic: ${normalizeText(topic.topic)}
Status: ${topic.status}
Correct: ${topic.correct}/${topic.total}
Reason: ${normalizeText(topic.reason)}`
      )
      .join("\n\n");

    const prompt = `
Create a personalized revision plan using ONLY the supplied gap report.

The purpose is to help the student revise the topics they actually need to work on.

IMPORTANT RULES:
1. Prioritize Weak topics first.
2. Medium topics should come after Weak topics.
3. Strong topics should receive little or no revision time unless needed for reinforcement.
4. Use the student's available revision time.
5. Do not invent new topics.
6. Use only the topics supplied in the gap report.
7. The plan must be practical and ordered by priority.
8. Explain briefly why each topic is included.
9. Allocate the total available time across the plan.
10. Return ONLY valid JSON.

Available revision time:
${availableTime} minutes

Gap Report:
${topicContext}

Return exactly this structure:

{
  "availableTime": ${availableTime},
  "plan": [
    {
      "order": 1,
      "topic": "Topic name from gap report",
      "status": "Weak",
      "minutes": 20,
      "reason": "Why this topic should be revised first."
    }
  ]
}
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
      throw new Error("The AI did not return a revision plan.");
    }

    const parsed = JSON.parse(responseText);

    if (!Array.isArray(parsed.plan) || parsed.plan.length === 0) {
      throw new Error("No revision plan was generated.");
    }

    return NextResponse.json({
      availableTime,
      plan: parsed.plan,
    });
  } catch (error) {
    console.error("Revision plan generation error:", error);

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not generate the revision plan.",
      },
      { status: 500 }
    );
  }
}