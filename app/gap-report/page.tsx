
"use client";

import { useEffect, useState } from "react";

type GapTopic = {
  topic: string;
  status: "Weak" | "Medium" | "Strong";
  reason: string;
  correct: number;
  total: number;
};

type GapReport = {
  overallScore: number;
  totalQuestions: number;
  topics: GapTopic[];
};

function statusClass(status: GapTopic["status"]) {
  if (status === "Weak") {
    return "bg-red-50 text-red-700 border-red-200";
  }

  if (status === "Medium") {
    return "bg-yellow-50 text-yellow-700 border-yellow-200";
  }

  return "bg-green-50 text-green-700 border-green-200";
}

export default function GapReportPage() {
  const [report, setReport] = useState<GapReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function generateReport() {
      try {
        const stored = localStorage.getItem("gapFinderQuizResults");

        if (!stored) {
          setError(
            "No completed quiz was found. Please complete a diagnostic quiz first."
          );
          setLoading(false);
          return;
        }

        const results = JSON.parse(stored);

        const response = await fetch("/api/gap-report", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            results,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.error || "Could not generate the gap report."
          );
        }

        setReport(data);
        localStorage.setItem("gapFinderGapReport", JSON.stringify(data));
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "Could not generate the gap report."
        );
      } finally {
        setLoading(false);
      }
    }

    generateReport();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-white text-slate-900">
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6">
          <div className="text-center">
            <div className="mx-auto mb-5 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-slate-900" />
            <h1 className="text-xl font-semibold">
              Analyzing your quiz results...
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              Building your topic-level gap report.
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen bg-white text-slate-900">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold">Gap Report</h1>

            <p className="mt-4 text-slate-600">{error}</p>

            <button
              onClick={() => {
                window.location.href = "/quiz";
              }}
              className="mt-6 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-800"
            >
              Go to Diagnostic Quiz
            </button>
          </div>
        </div>
      </main>
    );
  }

  if (!report) {
    return null;
  }

  const weakTopics = report.topics.filter(
    (topic) => topic.status === "Weak"
  );

  const mediumTopics = report.topics.filter(
    (topic) => topic.status === "Medium"
  );

  const strongTopics = report.topics.filter(
    (topic) => topic.status === "Strong"
  );

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="text-xl font-bold tracking-tight"
            >
              GapFinder AI
            </button>

            <p className="mt-1 text-sm text-slate-500">
              Topic-level diagnosis from your diagnostic quiz
            </p>
          </div>

          <button
            onClick={() => {
              window.location.href = "/quiz";
            }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Take Another Quiz
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <section className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Your Gap Report
          </h1>

          <p className="mt-2 max-w-2xl text-slate-600">
            This report identifies which topics appear weak, medium, or strong
            based on your diagnostic quiz answers.
          </p>
        </section>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <p className="text-sm font-medium text-slate-500">
              Overall Score
            </p>
            <p className="mt-2 text-4xl font-bold">
              {report.totalQuestions > 0
               ? Math.round(
              (report.topics.reduce(
              (sum, topic) => sum + topic.correct,0) /report.totalQuestions) *100): 0}%
            </p>

            <p className="mt-2 text-sm text-slate-500">
              {report.totalQuestions} diagnostic questions
            </p>
          </div>

          <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
            <p className="text-sm font-medium text-red-700">
              Weak Topics
            </p>

            <p className="mt-2 text-4xl font-bold text-red-700">
              {weakTopics.length}
            </p>

            <p className="mt-2 text-sm text-red-600">
              Areas requiring more revision
            </p>
          </div>

          <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
            <p className="text-sm font-medium text-green-700">
              Strong Topics
            </p>

            <p className="mt-2 text-4xl font-bold text-green-700">
              {strongTopics.length}
            </p>

            <p className="mt-2 text-sm text-green-600">
              Areas showing stronger understanding
            </p>
          </div>
        </section>

        <section className="space-y-4">
          {report.topics.map((topic, index) => (
            <article
              key={`${topic.topic}-${index}`}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold">
                    {topic.topic}
                  </h2>

                  <p className="mt-2 leading-7 text-slate-600">
                    {topic.reason}
                  </p>
                </div>

                <span
                  className={`w-fit shrink-0 rounded-full border px-3 py-1 text-sm font-semibold ${statusClass(
                    topic.status
                  )}`}
                >
                  {topic.status}
                </span>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 text-sm">
                <span className="text-slate-500">
                  Correct answers
                </span>

                <span className="font-semibold text-slate-900">
                  {topic.correct} / {topic.total}
                </span>
              </div>
            </article>
          ))}
        </section>

        {weakTopics.length > 0 && (
          <section className="mt-10 rounded-2xl border border-red-200 bg-white p-6">
            <h2 className="text-xl font-bold">
              Priority Revision Areas
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              These topics were identified as weak from your diagnostic
              results.
            </p>

            <div className="mt-5 space-y-3">
              {weakTopics.map((topic, index) => (
                <div
                  key={`${topic.topic}-priority-${index}`}
                  className="flex items-center justify-between rounded-xl bg-red-50 px-4 py-3"
                >
                  <span className="font-medium text-red-900">
                    {topic.topic}
                  </span>

                  <span className="text-sm font-semibold text-red-700">
                    {topic.correct}/{topic.total}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {mediumTopics.length > 0 && (
          <section className="mt-6 rounded-2xl border border-yellow-200 bg-white p-6">
            <h2 className="text-xl font-bold">
              Topics to Reinforce
            </h2>

            <div className="mt-5 space-y-3">
              {mediumTopics.map((topic, index) => (
                <div
                  key={`${topic.topic}-medium-${index}`}
                  className="flex items-center justify-between rounded-xl bg-yellow-50 px-4 py-3"
                >
                  <span className="font-medium text-yellow-900">
                    {topic.topic}
                  </span>

                  <span className="text-sm font-semibold text-yellow-700">
                    {topic.correct}/{topic.total}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="mx-auto flex max-w-6xl justify-end px-6 pb-10">
        <button
          onClick={() => {
            window.location.href = "/revision-plan";
          }}
          className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800"
        >
          Next: Revision Plan →
        </button>
      </div>
    </main>
  );
}