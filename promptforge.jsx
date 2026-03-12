import { useState, useEffect, useCallback, useRef } from "react";

const TECHNIQUES = [
  {
    id: "cot",
    name: "Chain-of-Thought",
    icon: "🧠",
    description:
      "Force step-by-step reasoning before arriving at a final answer. Best for math, logic, and multi-step analysis.",
    template: `Before providing your final answer, think through this problem step-by-step:

1. First, identify the core question or task being asked
2. Break it down into sub-problems or components
3. Reason through each component individually
4. Check your reasoning for logical errors
5. Synthesize your analysis into a clear, final answer

Always show your reasoning process before stating your conclusion.`,
  },
  {
    id: "fewshot",
    name: "Few-Shot Examples",
    icon: "📋",
    description:
      "Teach the model by demonstration with input/output pairs. Best for classification, formatting, and consistent outputs.",
    template: `Follow the exact pattern shown in these examples:

Example 1:
Input: {{example_input_1}}
Output: {{example_output_1}}

Example 2:
Input: {{example_input_2}}
Output: {{example_output_2}}

Now apply the same pattern to the user's input. Match the format, tone, and structure of the examples exactly.`,
  },
  {
    id: "role",
    name: "Role Assignment",
    icon: "🎭",
    description:
      "Assign a specific expert persona to ground responses in domain knowledge. Best for technical or specialized tasks.",
    template: `You are a {{role_title}} with {{years_experience}} years of experience specializing in {{specialty}}.

Your communication style is precise, authoritative, and grounded in practical experience. When answering:
- Draw on deep domain expertise
- Use field-appropriate terminology (but explain jargon when needed)
- Provide actionable, real-world advice rather than generic guidance
- Flag potential risks or edge cases a less experienced person might miss`,
  },
  {
    id: "structure",
    name: "Output Structuring",
    icon: "📐",
    description:
      "Force responses into a specific format (JSON, XML, tables, etc.). Best for programmatic consumption and data extraction.",
    template: `You must respond ONLY in the following structured format. Do not include any text outside this structure.

Format:
\`\`\`json
{
  "summary": "<one-sentence summary>",
  "key_points": ["<point 1>", "<point 2>", "<point 3>"],
  "confidence": <0.0 to 1.0>,
  "reasoning": "<brief explanation of your analysis>",
  "recommendation": "<actionable next step>"
}
\`\`\`

Respond with valid JSON only. No markdown fences, no preamble, no explanation outside the JSON.`,
  },
  {
    id: "critique",
    name: "Self-Critique",
    icon: "🔍",
    description:
      "Generate an answer, then evaluate and improve it in a two-pass refinement. Best for high-stakes or nuanced tasks.",
    template: `Use the following two-pass process for every response:

PASS 1 — INITIAL DRAFT:
Generate your best initial answer to the user's request.

PASS 2 — SELF-CRITIQUE:
Review your initial answer and evaluate it on these dimensions:
- Accuracy: Are there any factual errors or unsupported claims?
- Completeness: Did you miss any important aspects?
- Clarity: Is the explanation easy to follow?
- Actionability: Can the user immediately act on this?

FINAL OUTPUT:
Present your improved answer incorporating all corrections and enhancements from your self-critique. Briefly note what you improved and why.`,
  },
  {
    id: "constraints",
    name: "Constraint Setting",
    icon: "🚧",
    description:
      "Define explicit boundaries and requirements. Best for content policies, length control, and focused outputs.",
    template: `Adhere to ALL of the following constraints without exception:

MUST INCLUDE:
- {{required_element_1}}
- {{required_element_2}}

MUST NOT INCLUDE:
- {{forbidden_element_1}}
- {{forbidden_element_2}}

LENGTH: Your response must be between {{min_length}} and {{max_length}} words.
TONE: {{desired_tone}}
AUDIENCE: {{target_audience}}

If any constraint conflicts with another, prioritize them in the order listed above.`,
  },
];

const SAMPLE_PROMPTS = [
  {
    name: "Code Reviewer",
    system: `You are a senior software engineer conducting a thorough code review. For every piece of code submitted, analyze:

1. **Correctness** — Does it do what it's supposed to?
2. **Performance** — Are there obvious inefficiencies or O(n²) traps?
3. **Readability** — Would a new team member understand this in 60 seconds?
4. **Security** — Any injection vectors, data leaks, or auth bypasses?
5. **Edge Cases** — What inputs would break this?

Rate each dimension 1-5 and provide specific, line-level suggestions. Be constructive but direct.`,
    user: `Review this function:\n\n{{code}}`,
  },
  {
    name: "API Doc Writer",
    system: `You are a technical writer specializing in API documentation. Generate clear, developer-friendly documentation that includes: endpoint description, parameters table, request/response examples, error codes, and usage notes. Use a concise, scannable format.`,
    user: `Document this API endpoint: {{endpoint_description}}`,
  },
  {
    name: "Bug Analyst",
    system: `You are a debugging specialist. When presented with a bug report, systematically:
1. Reproduce the conditions mentally
2. Identify possible root causes (rank by likelihood)
3. Suggest diagnostic steps to narrow down the cause
4. Propose fixes for each possible root cause
5. Recommend preventive measures

Be precise and technical. Reference specific tools, logs, and debugging techniques.`,
    user: `Bug report:\n{{bug_description}}\n\nEnvironment: {{environment}}\nSteps to reproduce: {{steps}}`,
  },
];

function extractVariables(text) {
  const matches = text.match(/\{\{(\w+)\}\}/g) || [];
  return [...new Set(matches.map((m) => m.slice(2, -2)))];
}

function interpolate(text, vars) {
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] || `{{${key}}}`);
}

function estimateTokens(text) {
  return Math.ceil((text || "").length / 4);
}

export default function PromptForge() {
  const [mode, setMode] = useState("single");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [userPrompt, setUserPrompt] = useState("");
  const [systemPromptB, setSystemPromptB] = useState("");
  const [userPromptB, setUserPromptB] = useState("");
  const [variables, setVariables] = useState({});
  const [variablesB, setVariablesB] = useState({});
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(1024);
  const [response, setResponse] = useState(null);
  const [responseB, setResponseB] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [metricsB, setMetricsB] = useState(null);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activePanel, setActivePanel] = useState("editor");
  const [showTechniques, setShowTechniques] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error, setError] = useState(null);
  const outputRef = useRef(null);

  const allVarsA = extractVariables(systemPrompt + " " + userPrompt);
  const allVarsB = extractVariables(systemPromptB + " " + userPromptB);

  useEffect(() => {
    const next = {};
    allVarsA.forEach((v) => (next[v] = variables[v] || ""));
    if (JSON.stringify(next) !== JSON.stringify(variables)) setVariables(next);
  }, [systemPrompt, userPrompt]);

  useEffect(() => {
    const next = {};
    allVarsB.forEach((v) => (next[v] = variablesB[v] || ""));
    if (JSON.stringify(next) !== JSON.stringify(variablesB)) setVariablesB(next);
  }, [systemPromptB, userPromptB]);

  const callAPI = useCallback(
    async (sys, usr, vars) => {
      const finalSystem = interpolate(sys, vars);
      const finalUser = interpolate(usr, vars);
      const start = performance.now();

      const body = {
        model: "claude-sonnet-4-20250514",
        max_tokens: maxTokens,
        messages: [{ role: "user", content: finalUser }],
      };
      if (finalSystem.trim()) body.system = finalSystem;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error?.message || `API Error: ${res.status}`);
      }

      const data = await res.json();
      const elapsed = Math.round(performance.now() - start);
      const text = data.content
        .filter((b) => b.type === "text")
        .map((b) => b.text)
        .join("\n");

      return {
        text,
        metrics: {
          time: elapsed,
          inputTokens: estimateTokens(finalSystem + finalUser),
          outputTokens: estimateTokens(text),
          chars: text.length,
        },
      };
    },
    [maxTokens]
  );

  const runSingle = async () => {
    if (!userPrompt.trim()) return;
    setIsLoading(true);
    setError(null);
    setResponse(null);
    setMetrics(null);
    try {
      const result = await callAPI(systemPrompt, userPrompt, variables);
      setResponse(result.text);
      setMetrics(result.metrics);
      setHistory((prev) => [
        {
          id: Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          system: systemPrompt.slice(0, 80),
          user: userPrompt.slice(0, 80),
          response: result.text.slice(0, 120),
          metrics: result.metrics,
          mode: "single",
          fullSystem: systemPrompt,
          fullUser: userPrompt,
          vars: { ...variables },
        },
        ...prev.slice(0, 49),
      ]);
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const runAB = async () => {
    if (!userPrompt.trim() || !userPromptB.trim()) return;
    setIsLoading(true);
    setError(null);
    setResponse(null);
    setResponseB(null);
    setMetrics(null);
    setMetricsB(null);
    try {
      const [a, b] = await Promise.all([
        callAPI(systemPrompt, userPrompt, variables),
        callAPI(systemPromptB, userPromptB, variablesB),
      ]);
      setResponse(a.text);
      setResponseB(b.text);
      setMetrics(a.metrics);
      setMetricsB(b.metrics);
      setHistory((prev) => [
        {
          id: Date.now(),
          timestamp: new Date().toLocaleTimeString(),
          system: "A/B Test",
          user: `A: ${userPrompt.slice(0, 40)} | B: ${userPromptB.slice(0, 40)}`,
          response: `A: ${a.text.slice(0, 60)} | B: ${b.text.slice(0, 60)}`,
          metrics: a.metrics,
          mode: "ab",
        },
        ...prev.slice(0, 49),
      ]);
      setTimeout(() => outputRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (e) {
      setError(e.message);
    } finally {
      setIsLoading(false);
    }
  };

  const exportPrompt = () => {
    const config = {
      version: "1.0",
      exported: new Date().toISOString(),
      tool: "PromptForge",
      config: {
        mode,
        temperature,
        maxTokens,
        variantA: { systemPrompt, userPrompt, variables },
        ...(mode === "ab" ? { variantB: { systemPrompt: systemPromptB, userPrompt: userPromptB, variables: variablesB } } : {}),
      },
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `promptforge-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const loadSample = (sample) => {
    setSystemPrompt(sample.system);
    setUserPrompt(sample.user);
    setActivePanel("editor");
  };

  const loadHistoryEntry = (entry) => {
    if (entry.fullSystem) setSystemPrompt(entry.fullSystem);
    if (entry.fullUser) setUserPrompt(entry.fullUser);
    if (entry.vars) setVariables(entry.vars);
    setActivePanel("editor");
  };

  const applyTechnique = (technique) => {
    const sep = systemPrompt.trim() ? "\n\n---\n\n" : "";
    setSystemPrompt((prev) => prev + sep + technique.template);
    setShowTechniques(false);
    setActivePanel("editor");
  };

  const MetricsBadge = ({ label, value, unit, accent }) => (
    <div className="flex flex-col items-center px-3 py-2 rounded-lg" style={{ background: "rgba(255,255,255,0.04)" }}>
      <span className="text-xs uppercase tracking-widest" style={{ color: "#6b7280" }}>
        {label}
      </span>
      <span className="text-lg font-bold tabular-nums" style={{ color: accent || "#e2e8f0", fontFamily: "'JetBrains Mono', monospace" }}>
        {value}
        {unit && <span className="text-xs ml-0.5 font-normal" style={{ color: "#6b7280" }}>{unit}</span>}
      </span>
    </div>
  );

  const VariableForm = ({ vars, values, onChange, label }) =>
    vars.length > 0 && (
      <div className="mt-4 p-4 rounded-xl" style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.15)" }}>
        <div className="flex items-center gap-2 mb-3">
          <span style={{ color: "#fbbf24" }}>⚡</span>
          <span className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#fbbf24" }}>
            {label || "Template Variables"}
          </span>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
          {vars.map((v) => (
            <div key={v} className="flex flex-col gap-1">
              <label className="text-xs font-medium" style={{ color: "#9ca3af", fontFamily: "'JetBrains Mono', monospace" }}>
                {`{{${v}}}`}
              </label>
              <input
                type="text"
                value={values[v] || ""}
                onChange={(e) => onChange((prev) => ({ ...prev, [v]: e.target.value }))}
                placeholder={`Enter ${v}...`}
                className="px-3 py-2 rounded-lg text-sm outline-none transition-all"
                style={{
                  background: "rgba(0,0,0,0.3)",
                  border: "1px solid rgba(251,191,36,0.2)",
                  color: "#e2e8f0",
                  fontFamily: "'JetBrains Mono', monospace",
                }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(251,191,36,0.5)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(251,191,36,0.2)")}
              />
            </div>
          ))}
        </div>
      </div>
    );

  const EditorPane = ({ sys, setSys, usr, setUsr, vars, values, onVarsChange, label, varLabel }) => (
    <div className="flex flex-col gap-4 flex-1 min-w-0">
      {label && (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: label === "Variant A" ? "#22d3ee" : "#a78bfa" }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: label === "Variant A" ? "#22d3ee" : "#a78bfa" }}>
            {label}
          </span>
        </div>
      )}
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6b7280" }}>
          System Prompt
        </label>
        <textarea
          value={sys}
          onChange={(e) => setSys(e.target.value)}
          rows={6}
          placeholder="Define the AI's behavior, persona, and constraints..."
          className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-y transition-all"
          style={{
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#e2e8f0",
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 1.6,
            minHeight: "120px",
          }}
          onFocus={(e) => (e.target.style.borderColor = "rgba(34,211,238,0.4)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6b7280" }}>
          User Prompt
        </label>
        <textarea
          value={usr}
          onChange={(e) => setUsr(e.target.value)}
          rows={4}
          placeholder="The task or question to send to the model..."
          className="w-full px-4 py-3 rounded-xl text-sm outline-none resize-y transition-all"
          style={{
            background: "rgba(0,0,0,0.3)",
            border: "1px solid rgba(255,255,255,0.08)",
            color: "#e2e8f0",
            fontFamily: "'JetBrains Mono', monospace",
            lineHeight: 1.6,
            minHeight: "90px",
          }}
          onFocus={(e) => (e.target.style.borderColor = "rgba(34,211,238,0.4)")}
          onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.08)")}
        />
      </div>
      <VariableForm vars={vars} values={values} onChange={onVarsChange} label={varLabel} />
    </div>
  );

  const ResponsePanel = ({ text, met, label, accent }) => (
    <div className="flex flex-col gap-3 flex-1 min-w-0">
      {label && (
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ background: accent }} />
          <span className="text-xs font-bold uppercase tracking-widest" style={{ color: accent }}>
            {label}
          </span>
        </div>
      )}
      {met && (
        <div className="flex gap-2 flex-wrap">
          <MetricsBadge label="Time" value={met.time} unit="ms" accent="#22d3ee" />
          <MetricsBadge label="In Tokens" value={`~${met.inputTokens}`} accent="#fbbf24" />
          <MetricsBadge label="Out Tokens" value={`~${met.outputTokens}`} accent="#a78bfa" />
          <MetricsBadge label="Chars" value={met.chars.toLocaleString()} />
        </div>
      )}
      <div
        className="p-4 rounded-xl text-sm overflow-auto"
        style={{
          background: "rgba(0,0,0,0.3)",
          border: "1px solid rgba(255,255,255,0.06)",
          color: "#cbd5e1",
          fontFamily: "'JetBrains Mono', monospace",
          lineHeight: 1.7,
          whiteSpace: "pre-wrap",
          maxHeight: "500px",
        }}
      >
        {text || <span style={{ color: "#4b5563" }}>Response will appear here...</span>}
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{
        background: "linear-gradient(160deg, #0a0f1a 0%, #0d1321 40%, #111827 100%)",
        color: "#e2e8f0",
        fontFamily: "'Outfit', system-ui, sans-serif",
      }}
    >
      <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />

      {/* Header */}
      <header className="flex items-center justify-between px-5 py-4" style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg text-lg" style={{ background: "linear-gradient(135deg, #22d3ee, #a78bfa)", fontWeight: 800 }}>
            ⚡
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight" style={{ letterSpacing: "-0.02em" }}>
              PromptForge
            </h1>
            <p className="text-xs" style={{ color: "#4b5563" }}>
              Prompt Engineering Workbench
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          {/* Mode Toggle */}
          <div className="flex rounded-lg overflow-hidden mr-2" style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
            <button
              onClick={() => setMode("single")}
              className="px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: mode === "single" ? "rgba(34,211,238,0.15)" : "transparent",
                color: mode === "single" ? "#22d3ee" : "#6b7280",
              }}
            >
              Single
            </button>
            <button
              onClick={() => setMode("ab")}
              className="px-3 py-1.5 text-xs font-semibold transition-all"
              style={{
                background: mode === "ab" ? "rgba(167,139,250,0.15)" : "transparent",
                color: mode === "ab" ? "#a78bfa" : "#6b7280",
              }}
            >
              A/B Test
            </button>
          </div>

          <button onClick={() => setShowTechniques(!showTechniques)} className="p-2 rounded-lg transition-all hover:scale-105" style={{ background: showTechniques ? "rgba(251,191,36,0.15)" : "transparent", color: showTechniques ? "#fbbf24" : "#6b7280" }} title="Techniques">
            🧪
          </button>
          <button onClick={() => setShowSettings(!showSettings)} className="p-2 rounded-lg transition-all hover:scale-105" style={{ background: showSettings ? "rgba(34,211,238,0.15)" : "transparent", color: showSettings ? "#22d3ee" : "#6b7280" }} title="Settings">
            ⚙️
          </button>
          <button onClick={exportPrompt} className="p-2 rounded-lg transition-all hover:scale-105" style={{ color: "#6b7280" }} title="Export">
            📦
          </button>
        </div>
      </header>

      {/* Settings Bar */}
      {showSettings && (
        <div className="px-5 py-3 flex flex-wrap items-center gap-6" style={{ background: "rgba(0,0,0,0.2)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6b7280" }}>
              Temperature
            </label>
            <input type="range" min="0" max="1" step="0.05" value={temperature} onChange={(e) => setTemperature(parseFloat(e.target.value))} className="w-28 accent-cyan-400" />
            <span className="text-xs font-bold tabular-nums w-8" style={{ color: "#22d3ee", fontFamily: "'JetBrains Mono', monospace" }}>
              {temperature.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-semibold uppercase tracking-widest" style={{ color: "#6b7280" }}>
              Max Tokens
            </label>
            <input type="range" min="100" max="4096" step="100" value={maxTokens} onChange={(e) => setMaxTokens(parseInt(e.target.value))} className="w-28 accent-cyan-400" />
            <span className="text-xs font-bold tabular-nums w-10" style={{ color: "#22d3ee", fontFamily: "'JetBrains Mono', monospace" }}>
              {maxTokens}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs" style={{ color: "#4b5563" }}>
              Model:
            </span>
            <span className="text-xs font-semibold" style={{ color: "#a78bfa", fontFamily: "'JetBrains Mono', monospace" }}>
              claude-sonnet-4-20250514
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar: Techniques Panel */}
        {showTechniques && (
          <aside className="w-80 overflow-y-auto p-4 flex flex-col gap-3" style={{ background: "rgba(0,0,0,0.15)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
            <h2 className="text-xs font-bold uppercase tracking-widest mb-1" style={{ color: "#fbbf24" }}>
              Prompt Techniques
            </h2>
            {TECHNIQUES.map((t) => (
              <div key={t.id} className="p-3 rounded-xl transition-all cursor-pointer group" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }} onClick={() => applyTechnique(t)}>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-base">{t.icon}</span>
                  <span className="text-sm font-semibold" style={{ color: "#e2e8f0" }}>
                    {t.name}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: "#6b7280" }}>
                  {t.description}
                </p>
                <div className="mt-2 text-xs font-semibold opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: "#fbbf24" }}>
                  Click to apply →
                </div>
              </div>
            ))}

            <div className="mt-4 pt-4" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
              <h3 className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: "#22d3ee" }}>
                Sample Prompts
              </h3>
              {SAMPLE_PROMPTS.map((s, i) => (
                <button key={i} onClick={() => loadSample(s)} className="w-full text-left p-2 rounded-lg text-xs font-medium mb-1 transition-all hover:translate-x-1" style={{ color: "#9ca3af", background: "rgba(255,255,255,0.02)" }}>
                  📄 {s.name}
                </button>
              ))}
            </div>
          </aside>
        )}

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
          {/* Nav tabs */}
          <div className="flex gap-1">
            {["editor", "history"].map((tab) => (
              <button
                key={tab}
                onClick={() => setActivePanel(tab)}
                className="px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-widest transition-all"
                style={{
                  background: activePanel === tab ? "rgba(34,211,238,0.1)" : "transparent",
                  color: activePanel === tab ? "#22d3ee" : "#4b5563",
                  border: activePanel === tab ? "1px solid rgba(34,211,238,0.2)" : "1px solid transparent",
                }}
              >
                {tab === "editor" ? "✏️ Editor" : `📜 History (${history.length})`}
              </button>
            ))}
          </div>

          {/* Editor Panel */}
          {activePanel === "editor" && (
            <>
              {mode === "single" ? (
                <EditorPane sys={systemPrompt} setSys={setSystemPrompt} usr={userPrompt} setUsr={setUserPrompt} vars={allVarsA} values={variables} onVarsChange={setVariables} />
              ) : (
                <div className="flex gap-5" style={{ flexWrap: "wrap" }}>
                  <EditorPane sys={systemPrompt} setSys={setSystemPrompt} usr={userPrompt} setUsr={setUserPrompt} vars={allVarsA} values={variables} onVarsChange={setVariables} label="Variant A" varLabel="Variables A" />
                  <EditorPane sys={systemPromptB} setSys={setSystemPromptB} usr={userPromptB} setUsr={setUserPromptB} vars={allVarsB} values={variablesB} onVarsChange={setVariablesB} label="Variant B" varLabel="Variables B" />
                </div>
              )}

              {/* Run Button */}
              <button
                onClick={mode === "single" ? runSingle : runAB}
                disabled={isLoading}
                className="w-full py-3.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all relative overflow-hidden"
                style={{
                  background: isLoading
                    ? "rgba(34,211,238,0.08)"
                    : "linear-gradient(135deg, rgba(34,211,238,0.2), rgba(167,139,250,0.2))",
                  border: "1px solid rgba(34,211,238,0.3)",
                  color: isLoading ? "#4b5563" : "#22d3ee",
                  cursor: isLoading ? "not-allowed" : "pointer",
                }}
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="inline-block w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "#22d3ee", borderTopColor: "transparent" }} />
                    Processing...
                  </span>
                ) : mode === "single" ? (
                  "▶  Run Prompt"
                ) : (
                  "▶  Run A/B Test"
                )}
              </button>

              {/* Error */}
              {error && (
                <div className="p-4 rounded-xl text-sm" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
                  <span className="font-bold">Error:</span> {error}
                </div>
              )}

              {/* Output */}
              <div ref={outputRef}>
                {(response || responseB) && (
                  <div className="flex flex-col gap-4">
                    <h3 className="text-xs font-bold uppercase tracking-widest" style={{ color: "#6b7280" }}>
                      Output
                    </h3>
                    {mode === "single" ? (
                      <ResponsePanel text={response} met={metrics} />
                    ) : (
                      <div className="flex gap-5" style={{ flexWrap: "wrap" }}>
                        <ResponsePanel text={response} met={metrics} label="Variant A" accent="#22d3ee" />
                        <ResponsePanel text={responseB} met={metricsB} label="Variant B" accent="#a78bfa" />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* History Panel */}
          {activePanel === "history" && (
            <div className="flex flex-col gap-2">
              {history.length === 0 ? (
                <p className="text-sm text-center py-12" style={{ color: "#4b5563" }}>
                  No history yet. Run a prompt to get started.
                </p>
              ) : (
                history.map((h) => (
                  <div
                    key={h.id}
                    onClick={() => loadHistoryEntry(h)}
                    className="p-4 rounded-xl cursor-pointer transition-all hover:translate-x-1"
                    style={{
                      background: "rgba(255,255,255,0.03)",
                      border: "1px solid rgba(255,255,255,0.06)",
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono" style={{ color: "#4b5563" }}>
                          {h.timestamp}
                        </span>
                        <span
                          className="px-2 py-0.5 rounded text-xs font-bold uppercase"
                          style={{
                            background: h.mode === "ab" ? "rgba(167,139,250,0.15)" : "rgba(34,211,238,0.15)",
                            color: h.mode === "ab" ? "#a78bfa" : "#22d3ee",
                          }}
                        >
                          {h.mode === "ab" ? "A/B" : "Single"}
                        </span>
                      </div>
                      {h.metrics && (
                        <span className="text-xs font-mono" style={{ color: "#6b7280" }}>
                          {h.metrics.time}ms
                        </span>
                      )}
                    </div>
                    <p className="text-xs truncate mb-1" style={{ color: "#9ca3af" }}>
                      <span style={{ color: "#6b7280" }}>System:</span> {h.system || "(empty)"}
                    </p>
                    <p className="text-xs truncate mb-1" style={{ color: "#9ca3af" }}>
                      <span style={{ color: "#6b7280" }}>User:</span> {h.user}
                    </p>
                    <p className="text-xs truncate" style={{ color: "#4b5563" }}>
                      {h.response}
                    </p>
                    <div className="mt-2 text-xs font-semibold opacity-60" style={{ color: "#22d3ee" }}>
                      Click to reload →
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="px-5 py-2 flex items-center justify-between" style={{ borderTop: "1px solid rgba(255,255,255,0.04)" }}>
        <span className="text-xs" style={{ color: "#2d3748" }}>
          PromptForge v1.0 — Built with React + Claude API
        </span>
        <div className="flex items-center gap-3 text-xs" style={{ color: "#2d3748" }}>
          <span>History: {history.length}/50</span>
          <span>Mode: {mode === "ab" ? "A/B" : "Single"}</span>
        </div>
      </footer>
    </div>
  );
}
