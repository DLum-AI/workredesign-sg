/* ===========================================================
   WorkRedesign.sg — Supabase client (shared by admin + public
   account/directory/talent-submit pages)
   =========================================================== */

// --- REQUIRED: fill these in from your Supabase project ----
// Dashboard → Project Settings → API. The "anon" key is safe to
// expose in client-side code — it has no power beyond what your
// RLS policies in supabase/schema.sql allow it to do.
const SUPABASE_URL = "https://qhlykkeeiuthtewwdeaj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFobHlra2VlaXV0aHRld3dkZWFqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA3NDkzMTEsImV4cCI6MjEwNjMyNTMxMX0.QtRiPIsU9cKFfm9VPkB4WZi776vl2g6aFkQ9VxXkLN4";

// Loaded from the CDN script tag in each page's <head> — see
// https://unpkg.com/@supabase/supabase-js@2
if (typeof window.supabase === "undefined" || !window.supabase.createClient) {
  document.addEventListener("DOMContentLoaded", () => {
    document.body.innerHTML =
      '<div style="max-width:520px;margin:80px auto;text-align:center;font-family:sans-serif;padding:0 20px;">' +
      "<h1>Couldn't load the backend library</h1>" +
      "<p>The Supabase client script didn't load — check your internet connection, or that " +
      "the CDN script tag in this page's &lt;head&gt; hasn't been blocked (e.g. by an ad blocker " +
      "or a restrictive network proxy).</p></div>";
  });
  throw new Error("window.supabase is not available — Supabase CDN script failed to load");
}

window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
