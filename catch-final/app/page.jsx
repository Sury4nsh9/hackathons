'use client';

import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [chatLog, setChatLog] = useState('');
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef(null);

  const [processingStep, setProcessingStep] = useState(0);
  const [completedTasks, setCompletedTasks] = useState([]);

  const reasoningLogs = [
    "Initializing local NLP core...",
    "Tokenizing chat history...",
    "Running semantic entity extraction...",
    "Calculating urgency vector...",
    "Mapping action items to assignees...",
    "Finalizing JSON payload..."
  ];

  useEffect(() => {
    let interval;
    if (loading && processingStep < reasoningLogs.length - 1) {
      interval = setTimeout(() => setProcessingStep(p => p + 1), 500);
    }
    return () => clearTimeout(interval);
  }, [loading, processingStep]);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => setChatLog(event.target.result);
    reader.readAsText(file);
    e.target.value = null;
  };

  const loadSampleData = () => {
    setChatLog(
      `[Oct 8, 9:02 AM] Alex: Guys, are we still planning that weekend trip or what 😂
[Oct 8, 9:03 AM] Rahul: BRO YES. I've been waiting for this since last month.
[Oct 8, 9:05 AM] Priya: We need to actually decide a place this time instead of talking about it for 3 hours.
[Oct 8, 9:06 AM] Sam: Goa? 👀
[Oct 8, 9:07 AM] Neha: We literally have two days. Goa makes no sense unless we want to spend the whole trip travelling.
[Oct 8, 9:08 AM] Rahul: What about Pondicherry?
[Oct 8, 9:10 AM] Alex: That could work. Beach, cafes, and not too far.
[Oct 8, 9:12 AM] Priya: I'm in, but my budget is around ₹3,000 max for the whole trip.`
    );
  };

  const toggleTask = (index) => {
    setCompletedTasks(prev =>
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const copySummary = () => {
    if (!dashboardData?.tldr) return;
    navigator.clipboard.writeText(dashboardData.tldr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const analyzeChat = async () => {
    if (!chatLog.trim()) return;

    setLoading(true);
    setDashboardData(null);
    setProcessingStep(0);
    setCompletedTasks([]);

    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
    const systemPrompt = `Analyze this unread chat log. Return ONLY valid JSON with exactly this structure:
{"tldr": "1 sentence summary", "urgency": "CRITICAL/HIGH/MEDIUM/LOW", "sentiment": "1-2 words", "actionItems": [{"task": "Task description", "assignee": "Name", "confidence": 95}], "decisions": ["Decision"]}`;

    try {
      if (!apiKey || apiKey.includes('your_actual_api_key')) {
        throw new Error("Missing or invalid API key in .env.local");
      }

      let response;
      let data;

      for (let attempt = 0; attempt < 4; attempt++) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: `${systemPrompt}\n\nChat Log:\n${chatLog}` }] }]
            })
          }
        );

        data = await response.json();

        if (response.ok) break;

        const isTemporaryError = response.status === 429 || response.status === 503 || response.status === 500;
        if (!isTemporaryError || attempt === 3) {
          throw new Error(data?.error?.message || `Gemini API error (${response.status})`);
        }

        const delay = 2000 * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      if (data?.error) throw new Error(data.error.message);

      if (!data?.candidates || !data.candidates[0]?.content?.parts?.[0]?.text) {
        throw new Error("Gemini returned an unexpected response format.");
      }

      let rawText = data.candidates[0].content.parts[0].text;
      rawText = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(rawText);

      setDashboardData(parsedData);
    } catch (err) {
      console.error("Gemini analysis failed:", err);
      setDashboardData({
        urgency: "ERROR",
        sentiment: "System Failure",
        tldr: `API Failure: ${err.message}.`,
        actionItems: [
          { task: "Check Google AI Studio API Key in .env.local", assignee: "Admin", confidence: 100 },
          { task: "Verify free-tier rate limits or switch model endpoint", assignee: "Admin", confidence: 100 }
        ],
        decisions: ["System aborted parsing due to missing credentials or quota limits."]
      });
    } finally {
      setTimeout(() => setLoading(false), 600);
    }
  };

  return (
    <main className="min-h-screen bg-[#07090E] text-slate-300 p-6 md:p-10 font-sans selection:bg-indigo-500/30">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <header className="border-b border-slate-800/80 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_12px_rgba(99,102,241,0.8)]"></div>
              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                CatchMeUp.ai
              </h1>
            </div>
            <p className="text-slate-500 mt-2 text-xs font-mono uppercase tracking-widest">
              Autonomous Neural Chat Triage & Intelligence Dashboard
            </p>
          </div>

          <div>
            <input
              type="file"
              accept=".txt,.log,.csv"
              className="hidden"
              ref={fileInputRef}
              onChange={handleFileUpload}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all duration-300 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 hover:border-slate-700 shadow-md group"
            >
              <span className="group-hover:scale-110 transition-transform">📁</span> Upload Export (.txt)
            </button>
          </div>
        </header>

        {/* Main Grid */}
        <div className="grid lg:grid-cols-2 gap-6">

          {/* Left Column: Input Panel */}
          <div className="space-y-4">
            <div className="bg-[#111827]/90 backdrop-blur-md rounded-2xl border border-slate-800/80 shadow-2xl overflow-hidden relative group">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-[#0D121D]">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-rose-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
                  <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
                  <span className="ml-2 text-xs font-mono text-slate-400">raw_chat_stream.log</span>
                </div>
                <button
                  onClick={loadSampleData}
                  className="text-xs font-mono text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 px-2.5 py-1 rounded-md border border-indigo-500/20"
                >
                  ⚡ Load Sample Chat
                </button>
              </div>

              <textarea
                value={chatLog}
                onChange={(e) => setChatLog(e.target.value)}
                placeholder="Paste unread chat logs here, or load sample data..."
                className="w-full h-[440px] p-5 bg-transparent text-sm font-mono text-slate-200 focus:outline-none resize-none placeholder:text-slate-600 leading-relaxed"
              />
            </div>

            <button
              onClick={analyzeChat}
              disabled={loading || !chatLog.trim()}
              className="w-full bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-700 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl transition-all duration-300 shadow-[0_0_25px_rgba(79,70,229,0.35)] disabled:opacity-40 disabled:shadow-none flex items-center justify-center gap-2 text-sm tracking-wide"
            >
              {loading ? (
                <>
                  <span className="animate-spin text-lg">⟳</span>
                  <span>Synthesizing Context...</span>
                </>
              ) : (
                <>
                  <span>🚀 Initialize Triage Engine</span>
                </>
              )}
            </button>
          </div>

          {/* Right Column: Dynamic Output Dashboard */}
          <div className="space-y-6">

            {!dashboardData && !loading && (
              <div className="h-full min-h-[500px] border border-dashed border-slate-800 bg-[#111827]/30 rounded-2xl flex flex-col items-center justify-center text-slate-500 font-mono text-xs p-6 text-center space-y-3">
                <div className="text-3xl opacity-40">📡</div>
                <p>System Standby. Awaiting raw chat telemetry for neural analysis.</p>
              </div>
            )}

            {loading && (
              <div className="h-full min-h-[500px] rounded-2xl border border-indigo-500/30 bg-[#111827]/80 p-8 flex flex-col justify-center relative overflow-hidden shadow-2xl">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-pulse"></div>
                <div className="space-y-4 font-mono text-xs">
                  {reasoningLogs.map((log, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 transition-all duration-300 ${index <= processingStep ? 'opacity-150 text-indigo-300 translate-x-1' : 'opacity-20 text-slate-600'
                        }`}
                    >
                      <span className={`text-indigo-500 ${index === processingStep ? 'animate-spin' : ''}`}>
                        {index <= processingStep ? '✓' : '•'}
                      </span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {dashboardData && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* Metric Cards */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-[#111827] border border-slate-800/80 p-4 rounded-xl flex flex-col shadow-lg">
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-1">Threat Level</span>
                    <span className={`text-lg font-black tracking-wide ${dashboardData.urgency === 'CRITICAL' || dashboardData.urgency === 'ERROR'
                      ? 'text-rose-500 drop-shadow-[0_0_10px_rgba(244,63,94,0.4)]'
                      : dashboardData.urgency === 'HIGH'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                      }`}>
                      {dashboardData.urgency}
                    </span>
                  </div>

                  <div className="bg-[#111827] border border-slate-800/80 p-4 rounded-xl flex flex-col shadow-lg">
                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-1">Semantic Tone</span>
                    <span className="text-lg font-bold text-indigo-300 tracking-wide">
                      {dashboardData.sentiment}
                    </span>
                  </div>
                </div>

                {/* Executive Summary */}
                <div className="bg-gradient-to-br from-[#111827] to-[#0D121D] p-5 rounded-xl border border-slate-800/80 shadow-lg relative group">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-[10px] text-slate-500 font-mono uppercase tracking-widest flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                      Executive Summary
                    </h3>
                    <button
                      onClick={copySummary}
                      className="text-[10px] font-mono text-slate-400 hover:text-white bg-slate-800/60 hover:bg-slate-800 px-2.5 py-1 rounded border border-slate-700/50 transition-all flex items-center gap-1.5"
                    >
                      {copied ? '✓ Copied!' : '📋 Copy Summary'}
                    </button>
                  </div>
                  <p className="text-slate-200 text-base leading-relaxed font-medium">
                    {dashboardData.tldr}
                  </p>
                </div>

                {/* Extracted Directives (Action Items) */}
                <div className="bg-[#111827] p-5 rounded-xl border border-slate-800/80 shadow-lg">
                  <h3 className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-3">
                    Extracted Directives ({dashboardData.actionItems?.length || 0})
                  </h3>
                  <div className="space-y-2.5 max-h-[220px] overflow-y-auto pr-1">
                    {dashboardData.actionItems?.map((item, i) => (
                      <div
                        key={i}
                        onClick={() => toggleTask(i)}
                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all duration-200 ${completedTasks.includes(i)
                          ? 'bg-slate-900/40 border-slate-800/50 opacity-40'
                          : 'bg-slate-800/30 border-slate-800 hover:border-indigo-500/50 hover:bg-slate-800/60'
                          }`}
                      >
                        <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${completedTasks.includes(i) ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-600'
                          }`}>
                          {completedTasks.includes(i) && <span className="text-[10px]">✓</span>}
                        </div>
                        <div className="flex-1">
                          <p className={`text-xs font-medium ${completedTasks.includes(i) ? 'line-through text-slate-500' : 'text-slate-200'}`}>
                            {item.task}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                            @{item.assignee}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}

          </div>

        </div>

      </div>
    </main>
  );
}