"use client";

import { useState } from "react";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { useRouter } from "next/navigation";

export default function EntryPortal() {
  const router = useRouter();
  const supabase = createClientComponentClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [processing, setProcessing] = useState(false);
  const [notice, setNotice] = useState("");

  async function handleAccessRequest(e) {
    e.preventDefault();
    setProcessing(true);
    setNotice("");

    // Authenticate the unique individual seat
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setNotice("The access keys you typed didn't match our records. Please try again or ask your team administrator.");
      setProcessing(false);
    } else {
      // Direct pass to the main problem feed loop once authentication registers
      router.refresh();
      router.push("/");
    }
  }

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col justify-center px-6 py-12 font-sans antialiased max-w-md mx-auto">
      <div className="mb-12">
        <h2 className="text-3xl font-light tracking-tight text-gray-900">Sign in to your account</h2>
        <p className="mt-2 text-sm text-gray-400 font-light">
          Access your shared multi-user company workspace.
        </p>
      </div>

      {notice && (
        <div className="mb-6 p-4 bg-amber-50 text-amber-800 border border-amber-100 rounded text-sm font-light">
          {notice}
        </div>
      )}

      <form onSubmit={handleAccessRequest} className="space-y-6">
        <div>
          <label className="block text-xs tracking-wider text-gray-400 uppercase mb-2 font-medium">
            Your Email Address
          </label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-gray-900 transition-colors text-sm font-light rounded-none"
            placeholder="name@company.com"
          />
        </div>

        <div>
          <label className="block text-xs tracking-wider text-gray-400 uppercase mb-2 font-medium">
            Your Secret Password
          </label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3 border border-gray-200 text-gray-900 placeholder-gray-300 focus:outline-none focus:border-gray-900 transition-colors text-sm font-light rounded-none"
          />
        </div>

        <button
          type="submit"
          disabled={processing}
          className="w-full bg-gray-900 hover:bg-gray-800 text-white py-4 px-4 text-sm font-medium tracking-wide transition-colors disabled:bg-gray-400"
        >
          {processing ? "Verifying your access details..." : "Enter Workspace"}
        </button>
      </form>
    </div>
  );
}
