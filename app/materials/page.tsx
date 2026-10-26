"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function MaterialsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function uploadFile() {
    if (!file) {
      setMessage("Please select a file first.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const supabase = createClient();

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        setMessage("Please log in before uploading material.");
        setLoading(false);
        return;
      }

      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");

      const filePath = `${user.id}/${Date.now()}-${safeFileName}`;

      const { error } = await supabase.storage
        .from("materials")
        .upload(filePath, file);

      if (error) {
        setMessage(error.message);
        setLoading(false);
        return;
      }

      setMessage("Material uploaded successfully.");
      setFile(null);
    } catch {
      setMessage("Something went wrong. Please try again.");
    }

    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-white text-black">
      <div className="mx-auto min-h-screen max-w-7xl">

        {/* Header */}
        <header className="border-b border-slate-200 px-6 py-5 md:px-10">
          <div className="flex items-center justify-between">
            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="flex items-center gap-3"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-black">
                G
              </div>
              <div className="text-left">
                <h1 className="text-lg font-bold tracking-tight">
                  GapFinder AI
                </h1>

                <p className="text-xs text-slate-500">
                  Learning diagnosis
                </p>
              </div>
            </button>

            <button
              onClick={() => {
                window.location.href = "/";
              }}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 hover:text-black"
            >
              Dashboard
            </button>
          </div>
        </header>

        {/* Main */}
        <section className="px-6 py-10 md:px-10 md:py-14">
          <div className="mx-auto max-w-3xl">

            {/* Intro */}
            <div className="mb-10">
              <div className="mb-4 inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
                Step 01 · Material
              </div>

              <h2 className="text-4xl font-bold tracking-tight md:text-5xl">
                Upload your material.
              </h2>

              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600">
                Upload your syllabus, notes, textbook chapters, or past
                question papers. GapFinder AI will use your material for the
                learning diagnosis.
              </p>
            </div>

            {/* Upload card */}
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 md:p-8">

              <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center md:p-12">

                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-xl">
                  ↑
                </div>

                <h3 className="mt-5 text-xl font-semibold">
                  Choose your study material
                </h3>

                <p className="mt-2 text-sm text-slate-500">
                  Supported formats: PDF and TXT
                </p>

                <label className="mt-7 inline-flex cursor-pointer rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-800 transition hover:border-slate-400 hover:bg-slate-50">
                  Choose file

                  <input
                    type="file"
                    accept=".pdf,.txt"
                    className="hidden"
                    onChange={(e) => {
                      setFile(e.target.files?.[0] ?? null);
                      setMessage("");
                    }}
                  />
                </label>

                {file && (
                  <div className="mx-auto mt-6 max-w-md rounded-xl border border-slate-200 bg-slate-50 p-4 text-left">
                    <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                      Selected file
                    </p>

                    <p className="mt-1 truncate text-sm font-medium text-slate-800">
                      {file.name}
                    </p>

                    <p className="mt-1 text-xs text-slate-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={uploadFile}
                  disabled={!file || loading}
                  className="mt-6 w-full rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400 md:w-auto md:min-w-48"
                >
                  {loading ? "Uploading..." : "Upload material"}
                </button>

                {message && (
                  <div className="mx-auto mt-5 max-w-md rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
                    {message}
                  </div>
                )}
              </div>
            </div>
{/* What to upload */}
<div className="mt-8 grid gap-4 md:grid-cols-3">
  <div className="rounded-2xl border border-slate-200 p-5">
    <p className="text-sm font-semibold">Syllabus</p>
    <p className="mt-2 text-sm leading-6 text-slate-500">
      Your course or exam syllabus.
    </p>
  </div>

  <div className="rounded-2xl border border-slate-200 p-5">
    <p className="text-sm font-semibold">Notes</p>
    <p className="mt-2 text-sm leading-6 text-slate-500">
      Your study notes or textbook chapters.
    </p>
  </div>

  <div className="rounded-2xl border border-slate-200 p-5">
    <p className="text-sm font-semibold">Past papers</p>
    <p className="mt-2 text-sm leading-6 text-slate-500">
      Previous question papers for diagnosis.
    </p>
  </div>
</div>

{/* Next step */}
<div className="mt-10 flex justify-end">
  <button
    type="button"
    onClick={() => {
      window.location.href = "/topic-map";
    }}
    className="rounded-xl bg-slate-900 px-6 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800"
  >
    Next: Topic Map →
  </button>
</div>
          </div>
          </section>
        </div>
      </main>
    );
}