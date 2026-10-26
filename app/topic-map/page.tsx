
"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Material = {
  name: string;
  path: string;
};

type Topic = {
  number: string;
  title: string;
  subtopics: string[];
};

type ExtractResponse = {
  text?: string;
  error?: string;
};

/* ----------------------------- Text cleanup ----------------------------- */

function normalizeWhitespace(value: string) {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .trim();
}

function cleanLine(value: string) {
  let line = normalizeWhitespace(value);

  // Remove common PDF extraction artifacts.
  line = line.replace(/^\uFEFF/, "");

  // Remove trailing standalone page numbers.
  line = line.replace(/\s+\d{1,4}$/, "");

  // Remove TOC leader dots.
  line = line.replace(/\.{3,}\s*\d{1,4}$/, "");

  return line.trim();
}

/* ------------------------------ Noise filter ----------------------------- */

function isNoiseLine(value: string) {
  const line = normalizeWhitespace(value);

  if (!line) return true;

  if (line.length < 2) return true;

  // Standalone page numbers.
  if (/^\d{1,4}$/.test(line)) return true;

  // Common PDF/bookmark artifacts.
  if (
    /^(bookmark|bookmarks|contents|table of contents)$/i.test(line)
  ) {
    return false;
  }

  if (
    /^(error!|click install|click open|download and installation)$/i.test(
      line
    )
  ) {
    return true;
  }

  if (
    /^https?:\/\//i.test(line) ||
    /^www\./i.test(line)
  ) {
    return true;
  }

  // Obvious page/header/footer noise.
  if (
    /^(page|chapter)\s+\d+$/i.test(line)
  ) {
    return true;
  }

  // Very long lines are usually paragraphs rather than headings.
  if (line.length > 220) return true;

  return false;
}

/* -------------------------- Heading quality checks ----------------------- */

function isReasonableHeadingTitle(value: string) {
  const title = normalizeWhitespace(value);

  if (!title) return false;

  if (title.length < 2 || title.length > 180) {
    return false;
  }

  if (isNoiseLine(title)) {
    return false;
  }

  // Do not treat questions/instructions as topics.
  if (isQuestionOrInstruction(title)) {
    return false;
  }

  // Avoid obvious sentences/paragraphs.
  const words = title.split(/\s+/);

  if (words.length > 22) {
    return false;
  }

  return true;
}

/* ------------------------- Question/instruction filter ------------------- */

function isQuestionOrInstruction(value: string) {
  const line = normalizeWhitespace(value);

  if (!line) return true;

  if (/[?]$/.test(line)) {
    return true;
  }

  if (
    /^(what|why|how|when|where|who|which|explain|describe|discuss|define|write|state|list|mention|identify|compare|differentiate|give|find|calculate|prove|show|derive|solve|answer|read|complete|fill|choose|select|match|click|install|download|open)\b/i.test(
      line
    )
  ) {
    return true;
  }

  return false;
}

/* ----------------------------- Main headings ----------------------------- */

function parseMainHeading(value: string) {
  const line = cleanLine(value);

  if (!line || isNoiseLine(line)) {
    return null;
  }

  /*
   * IMPORTANT:
   *
   * Reject 1.1 / 1.2 / 1.1.1 before checking
   * for a main heading.
   *
   * Without this, "1.1 Problem Statement"
   * can accidentally become:
   *
   * number = "1"
   * title  = "1 Problem Statement"
   */
  if (
    /^\d{1,2}\.\d{1,3}(?:\.\d{1,3})*/.test(line)
  ) {
    return null;
  }

  let match = line.match(
    /^(\d{1,2})(?:\.\s+|:\s+|-\s+|\s+)(.+)$/i
  );

  if (match) {
    const number = match[1];
    const title = normalizeWhitespace(match[2]);

    if (!isReasonableHeadingTitle(title)) {
      return null;
    }

    return {
      number,
      title,
    };
  }

  // Support forms such as:
  // Chapter 1 Introduction
  // Chapter 1: Introduction
  // Chapter 1 - Introduction
  match = line.match(
    /^chapter\s+(\d{1,2})(?:\s*[:.-]\s*|\s+)(.+)$/i
  );

  if (match) {
    const number = match[1];
    const title = normalizeWhitespace(match[2]);

    if (!isReasonableHeadingTitle(title)) {
      return null;
    }

    return {
      number,
      title,
    };
  }

  return null;
}

/* ------------------------------ Subtopics -------------------------------- */

function parseSubtopic(value: string) {
  const line = cleanLine(value);

  if (!line || isNoiseLine(line)) {
    return null;
  }

  /*
   * Supports:
   *
   * 1.1 Problem Statement
   * 1.2 Objective
   * 2.1 Survey of Major Area Relevant to Project
   * 3.1 System Architecture
   * 3.2 UML Diagrams and System Flow/Data Flow
   *
   * Also supports:
   *
   * 1.1.1 Detailed Topic
   */
  const match = line.match(
    /^(\d{1,2})\.(\d{1,3}(?:\.\d{1,3})*)\.?\s+(.+)$/i
  );

  if (!match) {
    return null;
  }

  const parentNumber = match[1];
  const childNumber = match[2];
  const title = normalizeWhitespace(match[3]);

  if (!isReasonableHeadingTitle(title)) {
    return null;
  }

  if (isQuestionOrInstruction(title)) {
    return null;
  }

  return {
    number: `${parentNumber}.${childNumber}`,
    title,
  };
}

/* ----------------------- Educational textbook sections ------------------ */

function parseEducationalLetterSection(value: string) {
  const line = cleanLine(value);

  if (!line || isNoiseLine(line)) {
    return null;
  }

  /*
   * Some school textbooks use forms such as:
   *
   * A. Reading
   * B. Writing
   * C. Grammar
   *
   * Only accept short, clearly section-like headings.
   */
  const match = line.match(
    /^([A-Z])[\.\):\-]\s+(.+)$/i
  );

  if (!match) {
    return null;
  }

  const title = normalizeWhitespace(match[2]);

  if (!isReasonableHeadingTitle(title)) {
    return null;
  }

  return {
    number: match[1].toUpperCase(),
    title,
  };
}

/* ------------------------------ Index find ------------------------------- */

function findIndexStart(lines: string[]) {
  for (let i = 0; i < lines.length; i++) {
    const line = normalizeWhitespace(lines[i]);

    if (
      /^(table of contents|contents|index)$/i.test(line)
    ) {
      return i;
    }
  }

  return -1;
}

/* ---------------------------- Build from index -------------------------- */

function buildFromIndex(lines: string[]) {
  const topics: Topic[] = [];

  let currentTopic: Topic | null = null;

  /*
   * Only accept a coherent chapter sequence.
   * This prevents random numbered content from becoming chapters.
   */
  let expectedChapter = 1;

  for (let i = 0; i < lines.length; i++) {
    const raw = cleanLine(lines[i]);

    if (!raw || isNoiseLine(raw)) {
      continue;
    }

    const mainHeading = parseMainHeading(raw);

    if (mainHeading) {
      const chapterNumber = Number(mainHeading.number);

      /*
       * We primarily want the natural sequence:
       * 1, 2, 3, 4...
       *
       * Allow the first detected heading to establish
       * the sequence.
       */
      if (topics.length === 0) {
        if (chapterNumber > 20) {
          continue;
        }

        currentTopic = {
          number: mainHeading.number,
          title: mainHeading.title,
          subtopics: [],
        };

        topics.push(currentTopic);
        expectedChapter = chapterNumber + 1;
        continue;
      }

      if (chapterNumber === expectedChapter) {
        currentTopic = {
          number: mainHeading.number,
          title: mainHeading.title,
          subtopics: [],
        };

        topics.push(currentTopic);
        expectedChapter = chapterNumber + 1;
        continue;
      }

      /*
       * Sometimes the index may skip a chapter.
       * Still allow a forward chapter number if it is close.
       */
      if (
        chapterNumber > expectedChapter &&
        chapterNumber <= expectedChapter + 2
      ) {
        currentTopic = {
          number: mainHeading.number,
          title: mainHeading.title,
          subtopics: [],
        };

        topics.push(currentTopic);
        expectedChapter = chapterNumber + 1;
        continue;
      }

      continue;
    }

    const subtopic = parseSubtopic(raw);

    if (subtopic && currentTopic) {
      const belongsToCurrentTopic =
        subtopic.number.startsWith(
          `${currentTopic.number}.`
        );

      if (!belongsToCurrentTopic) {
        continue;
      }

      const alreadyExists = currentTopic.subtopics.some(
        (existing) =>
          existing.toLowerCase() ===
          subtopic.title.toLowerCase()
      );

      if (!alreadyExists) {
        currentTopic.subtopics.push(
          subtopic.title
        );
      }

      continue;
    }
  }

  return topics;
}

/* ----------------------------- Body parser ------------------------------- */

function buildFromBody(lines: string[]) {
  const topics: Topic[] = [];

  let currentTopic: Topic | null = null;

  let lastMainNumber = 0;

  for (let i = 0; i < lines.length; i++) {
    const raw = cleanLine(lines[i]);

    if (!raw || isNoiseLine(raw)) {
      continue;
    }

    const mainHeading = parseMainHeading(raw);

    if (mainHeading) {
      const number = Number(mainHeading.number);

      /*
       * Ignore cover-page numbering or random numbered
       * instructions that appear before the actual sequence.
       */
      if (
        topics.length === 0 &&
        number !== 1
      ) {
        continue;
      }

      /*
       * Require a forward chapter sequence.
       */
      if (
        topics.length > 0 &&
        number !== lastMainNumber + 1
      ) {
        continue;
      }

      currentTopic = {
        number: mainHeading.number,
        title: mainHeading.title,
        subtopics: [],
      };

      topics.push(currentTopic);
      lastMainNumber = number;

      continue;
    }

    const subtopic = parseSubtopic(raw);

    if (subtopic && currentTopic) {
      const parentNumber = Number(
        subtopic.number.split(".")[0]
      );

      if (
        parentNumber !==
        Number(currentTopic.number)
      ) {
        continue;
      }

      const exists = currentTopic.subtopics.some(
        (existing) =>
          existing.toLowerCase() ===
          subtopic.title.toLowerCase()
      );

      if (!exists) {
        currentTopic.subtopics.push(
          subtopic.title
        );
      }

      continue;
    }

    /*
     * Support simple educational letter sections
     * only when a topic already exists.
     */
    const educationalSection =
      parseEducationalLetterSection(raw);

    if (
      educationalSection &&
      currentTopic
    ) {
      const exists = currentTopic.subtopics.some(
        (existing) =>
          existing.toLowerCase() ===
          educationalSection.title.toLowerCase()
      );

      if (!exists) {
        currentTopic.subtopics.push(
          educationalSection.title
        );
      }
    }
  }

  return topics;
}

/* ----------------------------- Topic builder ----------------------------- */

function buildTopicMap(text: string) {
  const lines = text
    .split("\n")
    .map(cleanLine)
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return [];
  }

  /*
   * First try the contents/index because it is normally
   * the most reliable structural source.
   */
  const indexStart = findIndexStart(lines);

  if (indexStart !== -1) {
    const indexLines = lines.slice(
      indexStart + 1
    );

    const indexTopics =
      buildFromIndex(indexLines);

    if (indexTopics.length >= 2) {
      return indexTopics;
    }
  }

  /*
   * Otherwise infer the structure from the document body.
   */
  return buildFromBody(lines);
}

/* ------------------------------- Component ------------------------------- */

export default function TopicMapPage() {
  const supabase = useMemo(
    () => createClient(),
    []
  );

  const [materials, setMaterials] =
    useState<Material[]>([]);

  const [selectedMaterial, setSelectedMaterial] =
    useState("");

  const [topics, setTopics] =
    useState<Topic[]>([]);

  const [loadingMaterials, setLoadingMaterials] =
    useState(true);

  const [loadingTopics, setLoadingTopics] =
    useState(false);

  const [error, setError] =
    useState("");

  /* ------------------------- Load materials ------------------------- */

  useEffect(() => {
    async function loadMaterials() {
      setLoadingMaterials(true);
      setError("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        setError(userError.message);
        setLoadingMaterials(false);
        return;
      }

      if (!user) {
        setError(
          "Please log in to view your uploaded materials."
        );
        setLoadingMaterials(false);
        return;
      }

      const { data, error: storageError } =
        await supabase.storage
          .from("materials")
          .list(user.id, {
            limit: 100,
            sortBy: {
              column: "created_at",
              order: "desc",
            },
          });

      if (storageError) {
        setError(storageError.message);
        setLoadingMaterials(false);
        return;
      }

      const materialList: Material[] =
        (data ?? [])
          .filter(
            (item) =>
              item.name &&
              /\.(pdf|txt)$/i.test(item.name)
          )
          .map((item) => ({
            name: item.name,
            path: `${user.id}/${item.name}`,
          }));

      setMaterials(materialList);

      if (materialList.length > 0) {
        setSelectedMaterial(
          materialList[0].path
        );
      }

      setLoadingMaterials(false);
    }

    loadMaterials();
  }, [supabase]);

  /* ------------------------- Generate topic map ------------------------- */

  async function generateTopicMap() {
    if (!selectedMaterial) {
      setError(
        "Please select a material first."
      );
      return;
    }

    setLoadingTopics(true);
    setError("");
    setTopics([]);

    try {
      const { data: fileData, error: downloadError } =
        await supabase.storage
          .from("materials")
          .download(selectedMaterial);

      if (downloadError) {
        throw new Error(
          downloadError.message
        );
      }

      if (!fileData) {
        throw new Error(
          "The selected material could not be downloaded."
        );
      }

      const fileName =
        selectedMaterial.split("/").pop() ||
        "material";

      const file = new File(
        [fileData],
        fileName,
        {
          type:
            fileData.type ||
            "application/octet-stream",
        }
      );

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "/api/extract-text",
        {
          method: "POST",
          body: formData,
        }
      );

      const result =
        (await response.json()) as ExtractResponse;

      if (!response.ok) {
        throw new Error(
          result.error ||
            "Could not extract text from the material."
        );
      }

      if (
        !result.text ||
        !result.text.trim()
      ) {
        throw new Error(
          "No readable text was found in the material."
        );
      }

      const topicMap =
        buildTopicMap(result.text);

      if (topicMap.length === 0) {
        throw new Error(
          "No clear topic structure could be identified in this material."
        );
      }

      setTopics(topicMap);
    } catch (err) {
      console.error(
        "Topic map generation error:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while building the topic map."
      );
    } finally {
      setLoadingTopics(false);
    }
  }

  /* ------------------------------- UI -------------------------------- */

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Header */}

        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <button
              type="button"
              onClick={() => {
                window.location.href = "/";
              }}
              className="mb-4 text-sm font-medium text-slate-500 transition hover:text-slate-900"
            >
              ← Back to Dashboard
            </button>

            <h1 className="text-3xl font-bold tracking-tight text-slate-950">
              Topic Map
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Build a structured topic map from
              your uploaded study material.
            </p>
          </div>
        </div>

        {/* Material selector */}

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-5 md:grid-cols-[1fr_auto] md:items-end">
            <div>
              <label
                htmlFor="material"
                className="mb-2 block text-sm font-semibold text-slate-800"
              >
                Select Material
              </label>

              {loadingMaterials ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Loading uploaded materials...
                </div>
              ) : materials.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  No PDF or TXT materials found.
                </div>
              ) : (
                <select
                  id="material"
                  value={selectedMaterial}
                  onChange={(event) =>
                    setSelectedMaterial(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-slate-500"
                >
                  {materials.map(
                    (material) => (
                      <option
                        key={material.path}
                        value={material.path}
                      >
                        {material.name}
                      </option>
                    )
                  )}
                </select>
              )}
            </div>

            <button
              type="button"
              onClick={generateTopicMap}
              disabled={
                loadingTopics ||
                !selectedMaterial
              }
              className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loadingTopics
                ? "Building Topic Map..."
                : "Build Topic Map"}
            </button>
          </div>

          {error && (
            <div className="mt-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-6 text-red-700">
              {error}
            </div>
          )}
        </section>

        {/* Topic map */}

        {topics.length > 0 && (
          <section className="mt-8">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-950">
                  Identified Topics
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {topics.length} main topic
                  {topics.length === 1
                    ? ""
                    : "s"} identified.
                </p>
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              {topics.map((topic) => (
                <article
                  key={`${topic.number}-${topic.title}`}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex items-start gap-4">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-700">
                      {topic.number}
                    </div>

                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-slate-950">
                        {topic.title}
                      </h3>

                      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">
                        Main Topic
                      </p>
                    </div>
                  </div>

                  {topic.subtopics.length > 0 ? (
                    <div className="mt-6">
                      <p className="mb-3 text-sm font-semibold text-slate-700">
                        Subtopics
                      </p>

                      <div className="space-y-2">
                        {topic.subtopics.map(
                          (subtopic, index) => (
                            <div
                              key={`${topic.number}-${index}-${subtopic}`}
                              className="flex items-start gap-3 rounded-xl bg-slate-50 px-4 py-3"
                            >
                              <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />

                              <span className="text-sm leading-6 text-slate-700">
                                {subtopic}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
                      No subtopics detected.
                    </div>
                  )}
                </article>
              ))}
            </div>
          </section>
        )}

        {/* Next step */}
        {topics.length > 0 && (
          <div className="mt-10 flex justify-end">
            <button
              type="button"
              onClick={() => {
                window.location.href = "/quiz";
              }}
              className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Next: Diagnostic Quiz →
            </button>
          </div>
        )}

        {/* Empty initial state */}

        {!loadingTopics &&
          topics.length === 0 &&
          !error &&
          materials.length > 0 && (
            <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-6 py-12 text-center">
              <h2 className="text-lg font-semibold text-slate-900">
                Ready to build your Topic Map
              </h2>

              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                Select an uploaded material and
                build the topic structure from
                its contents.
              </p>
            </section>
          )}
      </div>
    </main>
  );
}