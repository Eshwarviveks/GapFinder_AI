import { createClient } from "@/lib/supabase/server";

export default async function TestSupabase() {
  const supabase = await createClient();

  const { data } = await supabase.auth.getUser();

  return (
    <main className="min-h-screen p-10">
      <h1 className="text-2xl font-bold">
        Supabase Connection
      </h1>

      <p className="mt-4">
        Supabase connected
      </p>

      <pre className="mt-4">
        {JSON.stringify(data, null, 2)}
      </pre>
    </main>
  );
}