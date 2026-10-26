"use client";

import { useEffect, useState } from "react";

type GapTopic = {
  topic: string;
  status: "Weak" | "Medium" | "Strong";
  reason: string;
  correct: number;
  total: number;
};

type RevisionItem = {
  order: number;
  topic: string;
  status: "Weak" | "Medium" | "Strong";
  minutes: number;
  reason: string;
};

type RevisionPlan = {
  availableTime: number;
  plan: RevisionItem[];
};

function statusClass(status: RevisionItem["status"]) {
  if (status === "Weak") {
    return "bg-red-50 text-red-700 border-red-200";
  }

  if (status === "Medium") {
    return "bg-yellow-50 text-yellow-700 border-yellow-200";
  }

  return "bg-green-50 text-green-700 border-green-200";
}

export default function RevisionPlanPage() {
  const [topics, setTopics] = useState<GapTopic[]>([]);
  const [availableTime, setAvailableTime] = useState("60");
  const [plan, setPlan] = useState<RevisionPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");


useEffect(() => {
  const stored = localStorage.getItem("gapFinderGapReport");

  if (!stored) {
    setError(
      "No gap report was found. Please complete a diagnostic quiz first."
    );
    return;
  }

  try {
    const parsed = JSON.parse(stored);

    if (!Array.isArray(parsed?.topics) || parsed.topics.length === 0) {
      setError(
        "No diagnosed topics were found in the gap report."
      );
      return;
    }

    setTopics(parsed.topics);
  } catch {
    setError(
      "The saved gap report could not be read. Please generate the gap report again."
    );
  }
}, []);

  async function generatePlan() {
    setError("");
    setPlan(null);

    const minutes = Number(availableTime);

    if (!minutes || minutes <= 0) {
      setError("Please enter a valid amount of revision time.");
      return;
    }

    if (topics.length === 0) {
      setError(
        "No diagnosed topics were found. Please complete the diagnostic quiz first."
      );
      return;
    }

    try {
      setLoading(true);

      const response = await fetch("/api/revision-plan", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topics,
          availableTime: minutes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data?.error || "Could not generate the revision plan."
        );
      }

      setPlan(data);

      localStorage.setItem(
        "gapFinderRevisionPlan",
        JSON.stringify(data)
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not generate the revision plan."
      );
    } finally {
      setLoading(false);
    }
  }

  if (error && topics.length === 0) {
    return (
      <main className="min-h-screen bg-white text-slate-900">
        <div className="mx-auto flex min-h-screen max-w-3xl items-center justify-center px-6">
          <div className="w-full rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold">Revision Plan</h1>

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
              Personalized revision plan from your gap report
            </p>
          </div>

          <button
  onClick={() => {
    window.location.href = "/";
  }}
  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
>
  Back to Dashboard
</button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <section className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">
            Personalized Revision Plan
          </h1>

          <p className="mt-2 max-w-2xl text-slate-600">
            Your revision plan is prioritized from the topics identified in
            your gap report.
          </p>
        </section>

        <section className="mb-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold">
            How much time do you have?
          </h2>

          <p className="mt-2 text-sm text-slate-500">
            Enter the amount of time available for this revision session.
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <div>
              <label
                htmlFor="availableTime"
                className="mb-2 block text-sm font-medium text-slate-700"
              >
                Revision time in minutes
              </label>

              <input
                id="availableTime"
                type="number"
                min="1"
                value={availableTime}
                onChange={(event) =>
                  setAvailableTime(event.target.value)
                }
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-slate-500 sm:w-56"
              />
            </div>

            <button
              onClick={generatePlan}
              disabled={loading}
              className="rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Building Plan..." : "Generate Revision Plan"}
            </button>
          </div>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}
        </section>

        {topics.length > 0 && (
          <section className="mb-8">
            <h2 className="mb-4 text-xl font-bold">
              Diagnosed Topics
            </h2>

            <div className="grid gap-4 md:grid-cols-3">
              {topics.map((topic, index) => (
                <article
                  key={`${topic.topic}-${index}`}
                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <h3 className="font-semibold">
                      {topic.topic}
                    </h3>

                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusClass(
                        topic.status
                      )}`}
                    >
                      {topic.status}
                    </span>
                  </div>

                  <p className="mt-3 text-sm text-slate-600">
                    {topic.correct}/{topic.total} correct
                  </p>
                </article>
              ))}
            </div>
          </section>
        )}

        {plan && (
          <section>
            <div className="mb-5">
              <h2 className="text-2xl font-bold">
                Your Revision Plan
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Planned revision time: {plan.availableTime} minutes
              </p>
            </div>

            <div className="space-y-4">
              {plan.plan.map((item) => (
                <article
                  key={`${item.order}-${item.topic}`}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="flex gap-4">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold">
                        {item.order}
                      </div>

                      <div>
                        <h3 className="text-lg font-semibold">
                          {item.topic}
                        </h3>

                        <p className="mt-2 leading-7 text-slate-600">
                          {item.reason}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={`rounded-full border px-3 py-1 text-sm font-semibold ${statusClass(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>

                      <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-bold">
                        {item.minutes} min
                      </span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}