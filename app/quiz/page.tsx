"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Material = {
  name: string;
  path: string;
};

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

type QuizResult = QuizQuestion & {
  selectedAnswer: string | null;
  isCorrect: boolean;
};

function decodeHtmlEntities(value: string) {
  if (typeof document === "undefined") {
    return value;
  }

  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

export default function QuizPage() {
  const supabase = useMemo(() => createClient(), []);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [selectedMaterial, setSelectedMaterial] =
    useState<Material | null>(null);

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const [loadingMaterials, setLoadingMaterials] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [submitted, setSubmitted] = useState(false);
  const [score, setScore] = useState(0);

  const [error, setError] = useState("");

  useEffect(() => {
    async function loadMaterials() {
      try {
        setLoadingMaterials(true);
        setError("");

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          setError("Please log in before starting a diagnostic quiz.");
          setLoadingMaterials(false);
          return;
        }

        const { data, error: listError } = await supabase.storage
          .from("materials")
          .list(user.id, {
            limit: 100,
            sortBy: {
              column: "name",
              order: "desc",
            },
          });

        if (listError) {
          throw listError;
        }

        const uploadedMaterials: Material[] = (data ?? [])
          .filter((item) => {
            const name = item.name.toLowerCase();

            return (
              name.endsWith(".pdf") ||
              name.endsWith(".txt")
            );
          })
          .map((item) => ({
            name: item.name,
            path: `${user.id}/${item.name}`,
          }));

        setMaterials(uploadedMaterials);

        if (uploadedMaterials.length > 0) {
          setSelectedMaterial(uploadedMaterials[0]);
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not load your materials."
        );
      } finally {
        setLoadingMaterials(false);
      }
    }

    loadMaterials();
  }, [supabase]);

  async function generateQuiz() {
    if (!selectedMaterial) {
      setError("Please select a material first.");
      return;
    }

    try {
      setGenerating(true);
      setError("");
      setQuestions([]);
      setAnswers({});
      setSubmitted(false);
      setScore(0);

      const { data, error: downloadError } = await supabase.storage
        .from("materials")
        .download(selectedMaterial.path);

      if (downloadError) {
        throw downloadError;
      }

      const formData = new FormData();
      formData.append("file", data, selectedMaterial.name);

      const response = await fetch("/api/generate-quiz", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error || "Could not generate the quiz."
        );
      }

      if (
        !Array.isArray(result.questions) ||
        result.questions.length === 0
      ) {
        throw new Error("No quiz questions were generated.");
      }

      setQuestions(result.questions);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate the diagnostic quiz."
      );
    } finally {
      setGenerating(false);
    }
  }

  function selectAnswer(questionId: string, answerId: string) {
    if (submitted) {
      return;
    }

    setAnswers((current) => ({
      ...current,
      [questionId]: answerId,
    }));
  }

  async function submitQuiz() {
    if (questions.length === 0) {
      return;
    }

    const unanswered = questions.filter(
      (question) => !answers[question.id]
    );

    if (unanswered.length > 0) {
      setError(
        `Please answer all questions before submitting. ${unanswered.length} question${
          unanswered.length === 1 ? "" : "s"
        } remain unanswered.`
      );
      return;
    }

    try {
      setSubmitting(true);
      setError("");

      const results: QuizResult[] = questions.map((question) => {
        const selectedAnswer = answers[question.id] ?? null;

        return {
          ...question,
          selectedAnswer,
          isCorrect:
            selectedAnswer === question.correctAnswer,
        };
      });

      const correctCount = results.filter(
        (result) => result.isCorrect
      ).length;

      const percentage = Math.round(
        (correctCount / results.length) * 100
      );

      setScore(percentage);
      setSubmitted(true);

      localStorage.setItem(
        "gapFinderQuizResults",
        JSON.stringify(results)
      );

      /*
       * Small delay lets the student see the score before
       * moving to the diagnosis.
       */
      setSubmitted(true);

localStorage.setItem(
  "gapFinderQuizResults",
  JSON.stringify(results)
);

/*
 * Small delay lets the student see the score before
 * moving to the diagnosis.
 */

    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not submit the quiz."
      );
    } finally {
      setSubmitting(false);
    }
  }

  function resetQuiz() {
    setQuestions([]);
    setAnswers({});
    setSubmitted(false);
    setScore(0);
    setError("");
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="text-xl font-bold tracking-tight"
          >
            GapFinder AI
          </button>

          <button
            onClick={() => {
              window.location.href = "/";
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Dashboard
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10">
        <section className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Diagnostic Quiz
          </h1>

          <p className="mt-2 max-w-2xl text-slate-600">
            Test your understanding using questions generated from
            your uploaded material.
          </p>
        </section>

        {error && (
          <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold">
            Select Material
          </h2>

          {loadingMaterials ? (
            <p className="mt-4 text-sm text-slate-500">
              Loading your materials...
            </p>
          ) : materials.length === 0 ? (
            <div className="mt-4">
              <p className="text-sm text-slate-600">
                No PDF or TXT materials were found.
              </p>

              <button
                onClick={() => {
                  window.location.href = "/materials";
                }}
                className="mt-4 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Upload Material
              </button>
            </div>
          ) : (
            <>
              <select
                value={selectedMaterial?.path ?? ""}
                onChange={(event) => {
                  const material = materials.find(
                    (item) => item.path === event.target.value
                  );

                  setSelectedMaterial(material ?? null);
                  resetQuiz();
                }}
                className="mt-4 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm outline-none focus:border-slate-500"
              >
                {materials.map((material) => (
                  <option
                    key={material.path}
                    value={material.path}
                  >
                    {material.name}
                  </option>
                ))}
              </select>

              <button
                onClick={generateQuiz}
                disabled={generating}
                className="mt-4 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {generating
                  ? "Generating Diagnostic Quiz..."
                  : "Generate Diagnostic Quiz"}
              </button>
            </>
          )}
        </section>

        {generating && (
          <section className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <div className="mx-auto mb-4 h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />

            <h2 className="text-lg font-semibold">
              Generating questions...
            </h2>

            <p className="mt-2 text-sm text-slate-500">
              Questions are being generated from your uploaded
              material.
            </p>
          </section>
        )}

        {questions.length > 0 && !generating && (
          <section className="space-y-5">
            {questions.map((question, index) => {
              const selectedAnswer = answers[question.id];

              return (
                <article
                  key={question.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="mb-5">
                    <p className="text-sm font-medium text-slate-500">
                      Question {index + 1} of {questions.length}
                    </p>

                    <h2 className="mt-2 text-lg font-semibold leading-7">
                      {decodeHtmlEntities(question.question)}
                    </h2>
                  </div>

                  <div className="space-y-3">
                    {question.options.map((option) => {
                      const isSelected =
                        selectedAnswer === option.id;

                      const isCorrect =
                        submitted &&
                        option.id === question.correctAnswer;

                      const isWrongSelection =
                        submitted &&
                        isSelected &&
                        option.id !== question.correctAnswer;

                      let optionClass =
                        "border-slate-200 bg-white hover:border-slate-400";

                      if (isSelected && !submitted) {
                        optionClass =
                          "border-slate-900 bg-slate-50";
                      }

                      if (isCorrect) {
                        optionClass =
                          "border-green-300 bg-green-50";
                      }

                      if (isWrongSelection) {
                        optionClass =
                          "border-red-300 bg-red-50";
                      }

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() =>
                            selectAnswer(
                              question.id,
                              option.id
                            )
                          }
                          disabled={submitted}
                          className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition ${optionClass}`}
                        >
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 text-sm font-semibold">
                            {option.id}
                          </span>

                          <span className="pt-1 text-sm leading-6">
                            {decodeHtmlEntities(option.text)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {submitted && (
                    <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold">
                        Explanation
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {decodeHtmlEntities(
                          question.explanation
                        )}
                      </p>

                      <p className="mt-3 text-xs font-medium text-slate-500">
                        Source:{" "}
                        {decodeHtmlEntities(question.source)}
                      </p>
                    </div>
                  )}
                </article>
              );
            })}

            {!submitted ? (
              <button
                onClick={submitQuiz}
                disabled={submitting}
                className="w-full rounded-xl bg-slate-900 px-5 py-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Evaluating Your Answers..."
                  : "Submit Diagnostic Quiz"}
              </button>
            ) : (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  Diagnostic Score
                </p>

                <p className="mt-2 text-5xl font-bold">
                  {score}%
                </p>

                <p className="mt-3 text-sm text-slate-600">
  Your diagnostic quiz is complete.
</p>

<button
  onClick={() => {
    window.location.href = "/gap-report";
  }}
  className="mt-6 rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
>
  View Gap Report →
</button>

                <div className="mx-auto mt-5 h-7 w-7 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}