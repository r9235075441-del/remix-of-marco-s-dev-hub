"use client";

import { useEffect, useState } from "react";
import AdminLayout from "@/app/components/AdminLayout";
import { toast } from "sonner";

type TokenState = {
  loginEnabled: boolean;
  guestLoginEnabled: boolean;
  guestSessionEpoch: number;
  globalTokenId: string | null;
  globalTokenName: string | null;
  globalAccessToken: string | null;
  globalRefreshToken: string | null;
  globalRandomId: string | null;
  guestCount?: number;
};

type Session = {
  id: string;
  name: string;
  phoneNumber: string;
  isGuest: boolean;
  deviceId: string | null;
  userAgent: string | null;
  lastSeenAt: string | null;
  accessToken: string | null;
  refreshToken: string | null;
};

export default function AdminTokensPage() {
  const [state, setState] = useState<TokenState | null>(null);
  const [form, setForm] = useState({
    globalTokenId: "",
    globalTokenName: "",
    globalAccessToken: "",
    globalRefreshToken: "",
    globalRandomId: "",
  });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<"all" | "guest" | "user">("all");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, string>>({});

  const loadState = async () => {
    const res = await fetch("/api/admin/tokens");
    const data = await res.json();
    if (!res.ok) return toast.error(data.message || "Failed to load tokens");
    setState(data);
    setForm({
      globalTokenId: data.globalTokenId || "",
      globalTokenName: data.globalTokenName || "",
      globalAccessToken: data.globalAccessToken || "",
      globalRefreshToken: data.globalRefreshToken || "",
      globalRandomId: data.globalRandomId || "",
    });
  };

  const loadSessions = async (type = filter) => {
    const res = await fetch(`/api/admin/sessions?type=${type}&limit=50`);
    const data = await res.json();
    if (res.ok) {
      setSessions(data.sessions || []);
      setTotal(data.total || 0);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadState(), loadSessions()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (extra: Partial<TokenState> = {}) => {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/tokens", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, ...extra }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Save failed");
      toast.success("Saved");
      await Promise.all([loadState(), loadSessions()]);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const verify = async (key: string, payload: any) => {
    setChecking(key);
    try {
      const res = await fetch("/api/admin/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      const label = data.valid
        ? `✅ Valid${data.name ? ` — ${data.name}` : ""}`
        : `❌ Invalid (${data.status || "err"}) ${data.message || ""}`;
      setResults((r) => ({ ...r, [key]: label }));
      data.valid ? toast.success("Token valid") : toast.error("Token invalid");
    } catch (e: any) {
      setResults((r) => ({ ...r, [key]: `❌ ${e.message}` }));
    } finally {
      setChecking(null);
    }
  };

  const revokeGuests = async (reset = false) => {
    if (!confirm(reset ? "Reset to default token and revoke all guests?" : "Revoke all guest sessions?")) return;
    const res = await fetch(`/api/admin/tokens?reset=${reset}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) return toast.error(data.message || "Failed");
    toast.success("Guest sessions revoked");
    await Promise.all([loadState(), loadSessions()]);
  };

  return (
    <AdminLayout activePage="tokens">
      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Global Tokens & Sessions</h1>
          <p className="text-sm text-gray-500">
            One global PW token powers every guest device. Enabling login revokes all guest sessions instantly.
          </p>
        </div>

        {loading ? (
          <div className="text-gray-500">Loading…</div>
        ) : (
          <>
            {/* Toggles */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="bg-white border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">User Login</p>
                  <p className="text-xs text-gray-500">
                    ON → guests revoked & redirected to /auth. Currently{" "}
                    <b>{state?.loginEnabled ? "ENABLED" : "DISABLED"}</b>
                  </p>
                </div>
                <button
                  onClick={() => save({ loginEnabled: !state?.loginEnabled } as any)}
                  disabled={saving}
                  className={`px-4 py-2 rounded-lg text-white text-sm ${state?.loginEnabled ? "bg-red-600" : "bg-green-600"}`}
                >
                  {state?.loginEnabled ? "Disable Login" : "Enable Login"}
                </button>
              </div>

              <div className="bg-white border rounded-xl p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">Guest Access</p>
                  <p className="text-xs text-gray-500">
                    Active guest sessions: <b>{state?.guestCount ?? 0}</b> · epoch {state?.guestSessionEpoch}
                  </p>
                </div>
                <button
                  onClick={() => save({ guestLoginEnabled: !state?.guestLoginEnabled } as any)}
                  disabled={saving}
                  className={`px-4 py-2 rounded-lg text-white text-sm ${state?.guestLoginEnabled ? "bg-red-600" : "bg-green-600"}`}
                >
                  {state?.guestLoginEnabled ? "Turn Off" : "Turn On"}
                </button>
              </div>
            </div>

            {/* Global token form */}
            <div className="bg-white border rounded-xl p-4 space-y-3">
              <h2 className="font-semibold text-gray-900">Global Token</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <Field label="Token ID" value={form.globalTokenId} onChange={(v) => setForm({ ...form, globalTokenId: v })} />
                <Field label="Name" value={form.globalTokenName} onChange={(v) => setForm({ ...form, globalTokenName: v })} />
                <Field label="Random ID (optional)" value={form.globalRandomId} onChange={(v) => setForm({ ...form, globalRandomId: v })} />
                <Field label="Refresh Token" value={form.globalRefreshToken} onChange={(v) => setForm({ ...form, globalRefreshToken: v })} />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600">Access Token</label>
                <textarea
                  rows={4}
                  value={form.globalAccessToken}
                  onChange={(e) => setForm({ ...form, globalAccessToken: e.target.value })}
                  className="w-full mt-1 px-3 py-2 border rounded-lg font-mono text-xs break-all"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => save()} disabled={saving} className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
                  {saving ? "Saving…" : "Save Token"}
                </button>
                <button
                  onClick={() => verify("global", { accessToken: form.globalAccessToken })}
                  disabled={checking === "global"}
                  className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm"
                >
                  {checking === "global" ? "Checking…" : "Check Token"}
                </button>
                <button onClick={() => revokeGuests(false)} className="px-4 py-2 bg-orange-600 text-white rounded-lg text-sm">
                  Revoke All Guests
                </button>
                <button onClick={() => revokeGuests(true)} className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm">
                  Reset to Default Token
                </button>
                {results["global"] && <span className="self-center text-sm">{results["global"]}</span>}
              </div>
            </div>

            {/* Sessions */}
            <div className="bg-white border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold text-gray-900">Sessions ({total})</h2>
                <select
                  value={filter}
                  onChange={(e) => {
                    const v = e.target.value as any;
                    setFilter(v);
                    loadSessions(v);
                  }}
                  className="border rounded-lg px-2 py-1 text-sm"
                >
                  <option value="all">All</option>
                  <option value="guest">Guests</option>
                  <option value="user">Logged-in users</option>
                </select>
              </div>

              <div className="space-y-3">
                {sessions.map((s) => (
                  <div key={s.id} className="border rounded-lg p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-gray-900">
                          {s.name}{" "}
                          <span className={`ml-2 text-xs px-2 py-0.5 rounded ${s.isGuest ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"}`}>
                            {s.isGuest ? "GUEST" : "USER"}
                          </span>
                        </p>
                        <p className="text-xs text-gray-500">{s.phoneNumber}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => verify(s.id, { userId: s.id })}
                          disabled={checking === s.id}
                          className="px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs"
                        >
                          {checking === s.id ? "Checking…" : "Check Token"}
                        </button>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(s.accessToken || "");
                            toast.success("Token copied");
                          }}
                          className="px-3 py-1.5 border rounded-lg text-xs"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                    <p className="mt-2 font-mono text-[10px] break-all text-gray-600">{s.accessToken || "—"}</p>
                    {results[s.id] && <p className="text-xs mt-1">{results[s.id]}</p>}
                  </div>
                ))}
                {sessions.length === 0 && <p className="text-sm text-gray-500">No sessions yet.</p>}
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-medium text-gray-600">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full mt-1 px-3 py-2 border rounded-lg text-sm"
      />
    </div>
  );
}
