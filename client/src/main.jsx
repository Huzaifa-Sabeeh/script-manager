import React, { useActionState, useEffect, useOptimistic, useState } from "react";
import { createRoot } from "react-dom/client";
import { motion } from "framer-motion";
import "./styles.css";

function Card({ children, className = "" }) {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className={`rounded-xl border border-slate-200 bg-white shadow-sm ${className}`}
    >
      {children}
    </motion.div>
  );
}

function App() {
  const bashGuide = {
    safety: [
      "`#!/usr/bin/env bash`",
      "`set -euo pipefail`",
      "Quote vars: `\"$VAR\"`",
      "Use absolute paths in automation"
    ],
    common: [
      "Loop dirs: `for d in \"${DIRS[@]}\"; do ...; done`",
      "Run in dir: `(cd /path && cmd)`",
      "Git pull: `git -C /path pull origin main`",
      "NPM install: `npm --prefix /path install`",
      "Docker compose: `(cd /path && docker compose up -d --build)`"
    ],
    checks: [
      "Directory exists: `[[ -d /path ]]`",
      "File exists: `[[ -f /path/file ]]`",
      "Git repo: `[[ -d /path/.git ]]`",
      "Exit on error: `if ! cmd; then exit 1; fi`"
    ],
    useCases: [
      "Daily repo updates for many projects",
      "Deploy stack after pull",
      "Install dependencies across apps",
      "Backup or cleanup jobs by schedule"
    ]
  };
  const scriptTemplates = [
    {
      key: "git-pull",
      title: "Git Pull Multiple Repos",
      suggestedName: "Git Pull Projects",
      suggestedPath: "/home/ubuntu/bin/git-pull-projects.sh",
      description: "Pull origin/main for multiple repositories.",
      content: `#!/usr/bin/env bash
set -euo pipefail

REPOS=(
  "/home/ubuntu/nijaat.com"
  "/home/ubuntu/multanit.com"
)

for repo in "\${REPOS[@]}"; do
  echo "Updating: $repo"
  git -C "$repo" pull origin main
done`
    },
    {
      key: "npm-install",
      title: "NPM Install Multiple Projects",
      suggestedName: "NPM Install Projects",
      suggestedPath: "/home/ubuntu/npm-install-projects.sh",
      description: "Run npm install in multiple projects.",
      content: `#!/usr/bin/env bash
set -euo pipefail

PROJECTS=(
  "/home/ubuntu/nijaat.com"
  "/home/ubuntu/worldtradedoo.com"
)

for p in "\${PROJECTS[@]}"; do
  echo "Installing deps: $p"
  npm --prefix "$p" install
done`
    },
    {
      key: "docker-compose",
      title: "Docker Compose Deploy",
      suggestedName: "Docker Compose Deploy",
      suggestedPath: "/home/ubuntu/docker-compose-deploy.sh",
      description: "Build and start compose stacks from directories.",
      content: `#!/usr/bin/env bash
set -euo pipefail

DIRS=(
  "/home/ubuntu/nijaat.com/deploy/combined"
  "/home/ubuntu/worldtradedoo.com/deploy/combined"
)

for d in "\${DIRS[@]}"; do
  echo "Deploying: $d"
  (cd "$d" && docker compose up -d --build)
done`
    }
  ];
  const weekDays = [
    { label: "Sun", value: "0" },
    { label: "Mon", value: "1" },
    { label: "Tue", value: "2" },
    { label: "Wed", value: "3" },
    { label: "Thu", value: "4" },
    { label: "Fri", value: "5" },
    { label: "Sat", value: "6" }
  ];
  const [auth, setAuth] = useState(false);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [scripts, setScripts] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [optimisticScripts, applyOptimisticScript] = useOptimistic(scripts, (current, action) => {
    if (action.type === "add") return [action.item, ...current];
    if (action.type === "delete") return current.filter((s) => s._id !== action.id);
    return current;
  });
  const [optimisticSchedules, applyOptimisticSchedule] = useOptimistic(schedules, (current, action) => {
    if (action.type === "add") return [action.item, ...current];
    if (action.type === "toggle") return current.map((s) => s._id === action.id ? { ...s, enabled: !s.enabled } : s);
    if (action.type === "delete") return current.filter((s) => s._id !== action.id);
    return current;
  });
  const [selectedScriptId, setSelectedScriptId] = useState("");
  const [scriptContent, setScriptContent] = useState("");
  const [runOutput, setRunOutput] = useState("");
  const [runHistory, setRunHistory] = useState([]);
  const [error, setError] = useState("");
  const [newScript, setNewScript] = useState({ name: "", path: "", description: "", content: "", makeExecutable: true });
  const [pathValidation, setPathValidation] = useState(null);
  const [newSchedule, setNewSchedule] = useState({ scriptId: "", cronExpr: "15 2 * * *", enabled: true });
  const [scheduleBuilder, setScheduleBuilder] = useState({
    mode: "daily",
    hour: "02",
    minute: "15",
    weekDay: "1",
    monthDay: "1",
    customExpr: "15 2 * * *"
  });
  const [busy, setBusy] = useState({
    login: false,
    addScript: false,
    saveScript: false,
    addSchedule: false,
    refresh: false,
    validateScriptPath: false
  });
  const [runningScriptId, setRunningScriptId] = useState("");
  const [deletingScriptId, setDeletingScriptId] = useState("");
  const [togglingScheduleId, setTogglingScheduleId] = useState("");
  const [deletingScheduleId, setDeletingScheduleId] = useState("");
  const [copiedTemplate, setCopiedTemplate] = useState("");

  function buildCronExpr(builder) {
    const minute = Number(builder.minute);
    const hour = Number(builder.hour);
    const day = Number(builder.monthDay);
    if (builder.mode === "hourly") return `${minute} * * * *`;
    if (builder.mode === "daily") return `${minute} ${hour} * * *`;
    if (builder.mode === "weekly") return `${minute} ${hour} * * ${builder.weekDay}`;
    if (builder.mode === "monthly") return `${minute} ${hour} ${day} * *`;
    return builder.customExpr.trim();
  }

  function scheduleLabel(s) {
    const parts = (s.cronExpr || "").trim().split(/\s+/);
    if (parts.length !== 5) return `Custom (${s.cronExpr})`;
    const [m, h, dom, mon, dow] = parts;
    if (h === "*" && dom === "*" && mon === "*" && dow === "*") return `Hourly at minute ${m}`;
    if (dom === "*" && mon === "*" && dow === "*") return `Daily at ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} UTC`;
    if (dom === "*" && mon === "*" && dow !== "*") {
      const d = weekDays.find((w) => w.value === dow)?.label || dow;
      return `Weekly on ${d} at ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} UTC`;
    }
    if (dom !== "*" && mon === "*" && dow === "*") return `Monthly on day ${dom} at ${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} UTC`;
    return `Custom (${s.cronExpr})`;
  }

  async function api(url, options = {}) {
    const res = await fetch(url, {
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) },
      credentials: "include"
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || "Request failed");
    }
    return res.json();
  }

  async function refresh() {
    setBusy((b) => ({ ...b, refresh: true }));
    try {
      const [scriptsData, schedulesData] = await Promise.all([api("/api/scripts"), api("/api/schedules")]);
      setScripts(scriptsData);
      setSchedules(schedulesData);
      if (!selectedScriptId && scriptsData[0]) setSelectedScriptId(scriptsData[0]._id);
    } finally {
      setBusy((b) => ({ ...b, refresh: false }));
    }
  }

  async function validateScriptPath() {
    const rawPath = newScript.path.trim();
    if (!rawPath) {
      setPathValidation(null);
      return;
    }
    setBusy((b) => ({ ...b, validateScriptPath: true }));
    setError("");
    try {
      const result = await api("/api/scripts/validate-path", {
        method: "POST",
        body: JSON.stringify({ path: rawPath })
      });
      setPathValidation(result);
      setNewScript((curr) => {
        if (curr.name.trim()) return curr;
        return { ...curr, name: result.suggestedName || curr.name };
      });
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy((b) => ({ ...b, validateScriptPath: false }));
    }
  }

  async function copyTemplate(content, key) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedTemplate(key);
      setTimeout(() => setCopiedTemplate(""), 1500);
    } catch {
      setError("Copy failed. Please copy template manually.");
    }
  }

  useEffect(() => {
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setAuth(Boolean(d.authenticated)));
  }, []);

  useEffect(() => { if (auth) refresh(); }, [auth]);

  useEffect(() => {
    if (!selectedScriptId) return;
    Promise.all([
      api(`/api/scripts/${selectedScriptId}/content`),
      api(`/api/scripts/${selectedScriptId}/runs`)
    ]).then(([contentData, runsData]) => {
      setScriptContent(contentData.content);
      setRunHistory(runsData);
    }).catch(() => {});
  }, [selectedScriptId]);

  const [loginState, loginAction, loginPending] = useActionState(async (_prev, formData) => {
    const usernameValue = String(formData.get("username") || "").trim();
    const passwordValue = String(formData.get("password") || "");
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ username: usernameValue, password: passwordValue }) });
      setUsername(usernameValue);
      setPassword("");
      setAuth(true);
      return { error: "" };
    } catch (e) {
      return { error: e.message };
    }
  }, { error: "" });

  const [addScriptState, addScriptAction, addScriptPending] = useActionState(async (_prev, formData) => {
    const payload = {
      name: String(formData.get("name") || "").trim(),
      path: String(formData.get("path") || "").trim(),
      description: String(formData.get("description") || "").trim(),
      content: String(formData.get("content") || ""),
      makeExecutable: formData.get("makeExecutable") === "on"
    };
    try {
      applyOptimisticScript({
        type: "add",
        item: { _id: `tmp-${Date.now()}`, name: payload.name, path: payload.path, description: payload.description }
      });
      await api("/api/scripts", { method: "POST", body: JSON.stringify(payload) });
      setNewScript({ name: "", path: "", description: "", content: "", makeExecutable: true });
      setPathValidation(null);
      await refresh();
      return { error: "" };
    } catch (e) {
      return { error: e.message };
    }
  }, { error: "" });

  const [addScheduleState, addScheduleAction, addSchedulePending] = useActionState(async (_prev) => {
    try {
      const cronExpr = buildCronExpr(scheduleBuilder);
      const selected = scripts.find((s) => s._id === newSchedule.scriptId);
      applyOptimisticSchedule({
        type: "add",
        item: {
          _id: `tmp-${Date.now()}`,
          scriptId: selected ? { _id: selected._id, name: selected.name } : null,
          cronExpr,
          enabled: newSchedule.enabled
        }
      });
      await api("/api/schedules", { method: "POST", body: JSON.stringify({ ...newSchedule, cronExpr }) });
      await refresh();
      return { error: "" };
    } catch (e) {
      return { error: e.message };
    }
  }, { error: "" });

  if (!auth) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-sky-50 p-6">
        <Card className="mx-auto mt-24 max-w-md p-6">
          <h2 className="mb-4 text-2xl font-semibold">Script Manager</h2>
          <form action={loginAction}>
            <input id="login-username" name="username" autoComplete="username" className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} />
            <input id="login-password" name="password" autoComplete="current-password" className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2" placeholder="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit" disabled={loginPending} className="rounded-md bg-ink px-4 py-2 text-white disabled:opacity-60">{loginPending ? "Logging in..." : "Login"}</button>
          </form>
          {loginState.error ? <p className="mt-3 text-sm text-rose-600">{loginState.error}</p> : null}
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50 p-6">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-3xl font-bold tracking-tight">Script Manager</h2>
          <button type="button" className="rounded-md bg-slate-200 px-3 py-2 text-sm font-medium hover:bg-slate-300" onClick={async () => { await api("/api/auth/logout", { method: "POST" }); setAuth(false); }}>Logout</button>
        </div>

        <Card className="mb-6 p-4">
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <div className="xl:col-span-2">
              <h3 className="mb-3 text-lg font-semibold">Add Script</h3>
              <div className="mb-3 rounded-md border border-sky-200 bg-sky-50 p-3 text-sm text-slate-700">
            <p className="font-semibold text-sky-900">Quick Guide</p>
            <p>1. Create script file on server (example: <code>/home/ubuntu/bin/my-script.sh</code>).</p>
            <p>2. Make it executable: <code>chmod +x /path/to/script.sh</code>.</p>
            <p>3. Add script here, validate path, then save.</p>
            <p>4. Optional: add schedule from Schedules section.</p>
              </div>
              <form action={addScriptAction}>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
              <input id="script-name" name="name" autoComplete="off" className="rounded-md border border-slate-300 px-3 py-2" placeholder="Name" value={newScript.name} onChange={(e) => setNewScript({ ...newScript, name: e.target.value })} />
              <input id="script-path" name="path" autoComplete="off" className="rounded-md border border-slate-300 px-3 py-2 md:col-span-2" placeholder="Path" value={newScript.path} onChange={(e) => { setNewScript({ ...newScript, path: e.target.value }); setPathValidation(null); }} onBlur={validateScriptPath} />
              <input id="script-description" name="description" autoComplete="off" className="rounded-md border border-slate-300 px-3 py-2" placeholder="Description" value={newScript.description} onChange={(e) => setNewScript({ ...newScript, description: e.target.value })} />
              <button type="button" disabled={busy.validateScriptPath || !newScript.path.trim()} className="rounded-md bg-slate-700 px-3 py-2 text-sm font-medium text-white disabled:opacity-60" onClick={validateScriptPath}>
                {busy.validateScriptPath ? "Checking..." : "Validate Path"}
              </button>
            </div>
            <div className="mt-3">
              <label htmlFor="script-content" className="mb-1 block text-sm font-medium text-slate-700">Script Code (used if path does not exist)</label>
              <textarea
                id="script-content"
                name="content"
                autoComplete="off"
                className="h-44 w-full rounded-md border border-slate-300 bg-slate-950 p-3 font-mono text-sm text-slate-100"
                placeholder={"#!/usr/bin/env bash\necho Hello"}
                value={newScript.content}
                onChange={(e) => setNewScript({ ...newScript, content: e.target.value })}
              />
              <label htmlFor="script-make-executable" className="mt-2 flex items-center text-sm text-slate-700">
                <input
                  id="script-make-executable"
                  name="makeExecutable"
                  className="mr-2"
                  type="checkbox"
                  checked={newScript.makeExecutable}
                  onChange={(e) => setNewScript({ ...newScript, makeExecutable: e.target.checked })}
                />
                Make file executable when created
              </label>
            </div>
          {pathValidation ? (
            <div className="mt-2 text-xs">
              <span className={pathValidation.allowed ? "text-emerald-700" : "text-rose-700"}>{pathValidation.allowed ? "Inside allowed root." : "Outside allowed root."}</span>
              {" | "}
              <span className={pathValidation.exists ? "text-emerald-700" : "text-rose-700"}>{pathValidation.exists ? "Path exists." : "Path not found."}</span>
              {" | "}
              <span className={pathValidation.executable ? "text-emerald-700" : "text-amber-700"}>{pathValidation.executable ? "Executable." : "Not executable."}</span>
              {" | "}
              <span className={pathValidation.duplicate ? "text-amber-700" : "text-emerald-700"}>{pathValidation.duplicate ? "Already added." : "Not added yet."}</span>
            </div>
          ) : null}
            <button type="submit" disabled={addScriptPending || !newScript.name.trim() || !newScript.path.trim()} className="mt-3 rounded-md bg-coral px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60">{addScriptPending ? "Adding..." : "Add Script"}</button>
              </form>
              {addScriptState.error ? <p className="mt-2 text-sm text-rose-600">{addScriptState.error}</p> : null}
              <div className="mt-5">
            <h4 className="mb-2 text-base font-semibold">Templates</h4>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
              {scriptTemplates.map((t) => (
                <div key={t.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <p className="text-sm font-semibold">{t.title}</p>
                  <p className="mb-2 mt-1 text-xs text-slate-600">{t.description}</p>
                  <pre className="max-h-32 overflow-auto rounded bg-slate-900 p-2 text-[11px] text-slate-100">{t.content}</pre>
                  <div className="mt-2 flex gap-2">
                    <button type="button" className="rounded-md bg-lake px-2 py-1 text-xs font-medium text-white" onClick={() => {
                      setNewScript({
                        name: t.suggestedName,
                        path: t.suggestedPath,
                        description: t.description,
                        content: t.content,
                        makeExecutable: true
                      });
                      setPathValidation(null);
                    }}>Use Template</button>
                    <button type="button" className="rounded-md bg-slate-700 px-2 py-1 text-xs font-medium text-white" onClick={() => copyTemplate(t.content, t.key)}>
                      {copiedTemplate === t.key ? "Copied" : "Copy"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
            </div>
            <aside className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
              <h4 className="mb-2 text-base font-semibold">Bash Mini Guide</h4>
              <p className="mb-2 text-xs text-slate-600">Copy patterns below while writing scripts.</p>
              <div className="space-y-3">
                <div>
                  <p className="font-semibold text-slate-800">Safe Defaults</p>
                  {bashGuide.safety.map((i) => <p key={i} className="text-xs text-slate-700">{i}</p>)}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Common Commands</p>
                  {bashGuide.common.map((i) => <p key={i} className="text-xs text-slate-700">{i}</p>)}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Useful Checks</p>
                  {bashGuide.checks.map((i) => <p key={i} className="text-xs text-slate-700">{i}</p>)}
                </div>
                <div>
                  <p className="font-semibold text-slate-800">Use Cases</p>
                  {bashGuide.useCases.map((i) => <p key={i} className="text-xs text-slate-700">- {i}</p>)}
                </div>
              </div>
            </aside>
          </div>
        </Card>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <Card className="p-4 xl:col-span-1">
            <h3 className="mb-3 text-lg font-semibold">Scripts</h3>
          {optimisticScripts.map((s) => (
            <motion.div key={s._id} whileHover={{ scale: 1.01 }} className="mb-3 rounded-lg border border-slate-200 p-3">
              <strong className="block text-sm">{s.name}</strong>
              <div className="mt-1 break-all text-xs text-slate-500">{s.path}</div>
              <div className="mt-3 flex gap-2">
                <button type="button" className="rounded-md bg-lake px-3 py-1 text-xs font-medium text-white" onClick={() => setSelectedScriptId(s._id)}>Edit</button>
                <button type="button" disabled={runningScriptId === s._id} className="rounded-md bg-ink px-3 py-1 text-xs font-medium text-white disabled:opacity-60" onClick={async () => {
                  setError("");
                  setRunningScriptId(s._id);
                  try {
                    const r = await api(`/api/scripts/${s._id}/run`, { method: "POST" });
                    setRunOutput(r.output);
                    await refresh();
                    if (selectedScriptId === s._id) {
                      const runsData = await api(`/api/scripts/${s._id}/runs`);
                      setRunHistory(runsData);
                    }
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setRunningScriptId("");
                  }
                }}>{runningScriptId === s._id ? "Running..." : "Run"}</button>
                <button type="button" disabled={deletingScriptId === s._id} className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-60" onClick={async () => {
                  setError("");
                  setDeletingScriptId(s._id);
                  try {
                    applyOptimisticScript({ type: "delete", id: s._id });
                    await api(`/api/scripts/${s._id}`, { method: "DELETE" });
                    if (selectedScriptId === s._id) {
                      setSelectedScriptId("");
                      setScriptContent("");
                      setRunOutput("");
                      setRunHistory([]);
                    }
                    await refresh();
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setDeletingScriptId("");
                  }
                }}>{deletingScriptId === s._id ? "Deleting..." : "Delete"}</button>
              </div>
            </motion.div>
          ))}
          </Card>

          <Card className="p-4 xl:col-span-2">
            <h4 className="mb-3 text-lg font-semibold">Editor</h4>
            <textarea id="script-editor" name="script_editor" autoComplete="off" className="h-72 w-full rounded-md border border-slate-300 bg-slate-950 p-3 font-mono text-sm text-slate-100" value={scriptContent} onChange={(e) => setScriptContent(e.target.value)} />
            <div className="mt-3">
              <button type="button" disabled={busy.saveScript || !selectedScriptId} className="rounded-md bg-coral px-4 py-2 text-sm font-semibold text-white disabled:opacity-60" onClick={async () => {
                setError("");
                setBusy((b) => ({ ...b, saveScript: true }));
                try {
                  await api(`/api/scripts/${selectedScriptId}/content`, { method: "PUT", body: JSON.stringify({ content: scriptContent }) });
                } catch (e) {
                  setError(e.message);
                } finally {
                  setBusy((b) => ({ ...b, saveScript: false }));
                }
              }}>{busy.saveScript ? "Saving..." : "Save Script"}</button>
            </div>
            <h4 className="mb-2 mt-5 text-lg font-semibold">Last Run Output</h4>
            <pre className="min-h-48 overflow-auto rounded-md bg-slate-900 p-3 text-xs text-slate-100">{runOutput}</pre>
            <h4 className="mb-2 mt-5 text-lg font-semibold">Run History (Selected Script)</h4>
            <div className="max-h-72 space-y-2 overflow-auto rounded-md border border-slate-200 bg-slate-50 p-2">
              {runHistory.length === 0 ? <p className="text-xs text-slate-500">No runs yet.</p> : runHistory.map((r) => (
                <div key={r._id} className="rounded border border-slate-200 bg-white p-2 text-xs">
                  <div className="mb-1 flex items-center gap-2">
                    <span className={`rounded px-2 py-0.5 ${r.status === "success" ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}`}>{r.status}</span>
                    <span className="text-slate-500">{new Date(r.startedAt).toLocaleString()}</span>
                  </div>
                  <pre className="max-h-24 overflow-auto rounded bg-slate-900 p-2 text-[11px] text-slate-100">{r.output}</pre>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="mt-6 p-4">
          <h3 className="mb-3 text-lg font-semibold">Schedules</h3>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
            <select id="schedule-script" name="schedule_script" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={newSchedule.scriptId} onChange={(e) => setNewSchedule({ ...newSchedule, scriptId: e.target.value })}>
              <option value="">Select script</option>
              {optimisticScripts.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
            </select>
            <select id="schedule-mode" name="schedule_mode" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={scheduleBuilder.mode} onChange={(e) => setScheduleBuilder({ ...scheduleBuilder, mode: e.target.value })}>
              <option value="hourly">Hourly</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
              <option value="custom">Custom Cron</option>
            </select>
            {scheduleBuilder.mode !== "custom" && (
              <>
                <select id="schedule-hour" name="schedule_hour" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={scheduleBuilder.hour} onChange={(e) => setScheduleBuilder({ ...scheduleBuilder, hour: e.target.value })}>
                  {Array.from({ length: 24 }).map((_, i) => <option key={i} value={String(i).padStart(2, "0")}>{String(i).padStart(2, "0")}h</option>)}
                </select>
                <select id="schedule-minute" name="schedule_minute" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={scheduleBuilder.minute} onChange={(e) => setScheduleBuilder({ ...scheduleBuilder, minute: e.target.value })}>
                  {Array.from({ length: 60 }).map((_, i) => <option key={i} value={String(i).padStart(2, "0")}>{String(i).padStart(2, "0")}m</option>)}
                </select>
              </>
            )}
            {scheduleBuilder.mode === "weekly" && (
              <select id="schedule-weekday" name="schedule_weekday" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={scheduleBuilder.weekDay} onChange={(e) => setScheduleBuilder({ ...scheduleBuilder, weekDay: e.target.value })}>
                {weekDays.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
              </select>
            )}
            {scheduleBuilder.mode === "monthly" && (
              <select id="schedule-monthday" name="schedule_monthday" className="rounded-md border border-slate-300 px-3 py-2 text-sm" value={scheduleBuilder.monthDay} onChange={(e) => setScheduleBuilder({ ...scheduleBuilder, monthDay: e.target.value })}>
                {Array.from({ length: 31 }).map((_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
              </select>
            )}
            {scheduleBuilder.mode === "custom" && (
              <input id="schedule-custom-cron" name="schedule_custom_cron" autoComplete="off" className="rounded-md border border-slate-300 px-3 py-2 text-sm md:col-span-2" placeholder="e.g. 15 2 * * *" value={scheduleBuilder.customExpr} onChange={(e) => setScheduleBuilder({ ...scheduleBuilder, customExpr: e.target.value })} />
            )}
            <label className="flex items-center text-sm" htmlFor="schedule-enabled"><input id="schedule-enabled" name="schedule_enabled" className="mr-1" type="checkbox" checked={newSchedule.enabled} onChange={(e) => setNewSchedule({ ...newSchedule, enabled: e.target.checked })} />enabled</label>
            <form action={addScheduleAction}>
              <button type="submit" disabled={addSchedulePending} className="rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{addSchedulePending ? "Adding..." : "Add Schedule"}</button>
            </form>
          </div>
          <div className="mt-2 text-xs text-slate-500">
            Cron preview: <code className="rounded bg-slate-100 px-1 py-0.5">{buildCronExpr(scheduleBuilder)}</code>
          </div>
          <div className="mt-4 space-y-2">
            {optimisticSchedules.map((s) => (
              <div key={s._id} className="flex flex-wrap items-center gap-2 rounded-md border border-slate-200 p-3 text-sm">
                <strong>{s.scriptId?.name || "Missing script"}</strong>
                <code className="rounded bg-slate-100 px-2 py-1">{s.cronExpr}</code>
                <span className="rounded bg-sky-100 px-2 py-1 text-xs text-sky-700">{scheduleLabel(s)}</span>
                <span className={`rounded px-2 py-1 text-xs ${s.enabled ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>{s.enabled ? "enabled" : "disabled"}</span>
                <button type="button" disabled={togglingScheduleId === s._id} className="rounded-md bg-lake px-3 py-1 text-xs font-medium text-white disabled:opacity-60" onClick={async () => {
                  setError("");
                  setTogglingScheduleId(s._id);
                  try {
                    applyOptimisticSchedule({ type: "toggle", id: s._id });
                    await api(`/api/schedules/${s._id}`, { method: "PUT", body: JSON.stringify({ enabled: !s.enabled }) });
                    await refresh();
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setTogglingScheduleId("");
                  }
                }}>{togglingScheduleId === s._id ? "Updating..." : s.enabled ? "Disable" : "Enable"}</button>
                <button type="button" disabled={deletingScheduleId === s._id} className="rounded-md bg-rose-600 px-3 py-1 text-xs font-medium text-white disabled:opacity-60" onClick={async () => {
                  setError("");
                  setDeletingScheduleId(s._id);
                  try {
                    applyOptimisticSchedule({ type: "delete", id: s._id });
                    await api(`/api/schedules/${s._id}`, { method: "DELETE" });
                    await refresh();
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setDeletingScheduleId("");
                  }
                }}>{deletingScheduleId === s._id ? "Deleting..." : "Delete"}</button>
              </div>
            ))}
          </div>
          {addScheduleState.error ? <p className="mt-2 text-sm text-rose-600">{addScheduleState.error}</p> : null}
          {busy.refresh ? <p className="mt-3 text-xs text-slate-500">Refreshing data...</p> : null}
          {error ? <p className="mt-3 text-sm text-rose-600">{error}</p> : null}
        </Card>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
