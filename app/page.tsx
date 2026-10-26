"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const workflow = [
  {
    number: "01",
    title: "Material",
    description:
      "Upload your syllabus, notes, textbook chapters and past papers.",
  },
  {
    number: "02",
    title: "Topic Map",
    description:
      "Build a topic structure from your uploaded syllabus.",
  },
  {
    number: "03",
    title: "Diagnostic Quiz",
    description:
      "Test your understanding using questions from your material.",
  },
  {
    number: "04",
    title: "Gap Report",
    description:
      "Identify weak, medium and strong topics.",
  },
  {
    number: "05",
    title: "Revision Plan",
    description:
      "Prioritize revision based on your diagnosed gaps.",
  },
  {
    number: "06",
    title: "Progress",
    description:
      "Track improvement across quiz attempts.",
  },
];

export default function Home() {
  const [selected, setSelected] = useState("Material");
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const selectedItem = workflow.find(
    (item) => item.title === selected
  );

  useEffect(() => {
    const supabase = createClient();

    const getUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      setUser(user);
      setLoading(false);
    };

    getUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    const supabase = createClient();

    await supabase.auth.signOut();

    setUser(null);
  };

  const handleWorkflowClick = (title: string) => {
  if (title === "Material") {
    window.location.href = "/materials";
    return;
  }

  if (title === "Topic Map") {
    window.location.href = "/topic-map";
    return;
  }

  if (title === "Diagnostic Quiz") {
  window.location.href = "/quiz";
  return;
}

if (title === "Revision Plan") {
  window.location.href = "/revision-plan";
  return;
}

  setSelected(title);
};

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto flex min-h-screen max-w-7xl">

        {/* Sidebar */}
        <aside className="hidden w-64 border-r border-slate-200 bg-white p-6 md:block">
          <div className="mb-10">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-800">
                G
              </div>

              <div>
                <h1 className="text-lg font-bold tracking-tight">
                  GapFinder AI
                </h1>

                <p className="text-xs text-slate-500">
                  Learning diagnosis
                </p>
              </div>
            </div>
          </div>

          <nav className="space-y-2">
            {workflow.map((item) => (
              <button
                key={item.title}
                onClick={() => handleWorkflowClick(item.title)}
                className={`flex w-full items-center gap-3 rounded-xl border px-3 py-3 text-left text-sm transition ${
                  selected === item.title
                    ? "border-slate-300 bg-slate-50 text-slate-900"
                    : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900"
                }`}
              >
                <span className="text-xs text-slate-400">
                  {item.number}
                </span>

                <span className="font-medium">
                  {item.title}
                </span>
              </button>
            ))}
          </nav>
        </aside>

        {/* Main content */}
        <section className="flex-1 p-6 md:p-10">

          {/* Header */}
          <header className="mb-10 flex items-start justify-between gap-6">
            <div>
              <div className="mb-4 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                AI-powered learning diagnosis
              </div>

              <h2 className="max-w-3xl text-4xl font-bold tracking-tight md:text-5xl">
                Find what you don&apos;t know.
              </h2>

              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Upload your study material and use a diagnostic quiz to
                discover the topics that need the most revision.
              </p>
            </div>

            {/* Authentication */}
            <div className="flex shrink-0 items-center gap-2">
              {loading ? (
                <div className="h-10 w-24 rounded-xl bg-slate-50" />
              ) : user ? (
                <>
                  <span className="hidden max-w-[180px] truncate px-3 text-sm text-slate-500 sm:block">
                    {user.email}
                  </span>

                  <button
                    onClick={handleLogout}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Log out
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      window.location.href = "/login";
                    }}
                    className="rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                  >
                    Log in
                  </button>

                  <button
                    onClick={() => {
                      window.location.href = "/login";
                    }}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
                  >
                    Register
                  </button>
                </>
              )}
            </div>
          </header>

          {/* Selected section */}
          <div className="mb-10 overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
            <div className="flex flex-col justify-between gap-8 p-7 md:flex-row md:items-center md:p-8">

              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                  Current step
                </p>

                <h3 className="mt-3 text-3xl font-bold tracking-tight">
                  {selected}
                </h3>

                <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600">
                  {selectedItem?.description}
                </p>
              </div>

              {selected === "Material" && (
                <button
                  onClick={() => {
                    window.location.href = "/materials";
                  }}
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Upload material
                </button>
              )}

              {selected === "Topic Map" && (
                <button
                  onClick={() => {
                    window.location.href = "/topic-map";
                  }}
                  className="shrink-0 rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
                >
                  Build Topic Map
                </button>
              )}
            </div>
          </div>

          {/* Workflow */}
          <div>
            <div className="mb-5">
              <h3 className="text-xl font-bold">
                GapFinder workflow
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Your diagnosis is built from your own study material.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {workflow.map((item) => (
                <button
                  key={item.title}
                  onClick={() => handleWorkflowClick(item.title)}
                  className={`group rounded-2xl border bg-white p-6 text-left transition ${
                    selected === item.title
                      ? "border-slate-300 bg-slate-50 shadow-sm"
                      : "border-slate-200 hover:-translate-y-1 hover:border-slate-300 hover:shadow-lg"
                  }`}
                >
                  <div className="mb-8 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">
                      {item.number}
                    </span>

                    <span className="rounded-full border border-slate-200 px-2.5 py-1 text-xs text-slate-500">
                      {item.title}
                    </span>
                  </div>

                  <p className="text-sm leading-6 text-slate-600">
                    {item.description}
                  </p>

                  <div className="mt-6 text-xs font-semibold text-slate-800">
                    {item.title === "Material"
                      ? "Upload material →"
                      : item.title === "Topic Map"
                      ? "Build topic map →"
                      : "View step →"}
                  </div>
                </button>
              ))}
            </div>
          </div>

        </section>
      </div>
    </main>
  );
}