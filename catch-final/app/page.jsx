'use client';

import { useState, useEffect, useRef } from 'react';

export default function Home() {
  const [chatLog, setChatLog] = useState('');
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState(null);
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
      interval = setTimeout(() => setProcessingStep(p => p + 1), 600);
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
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
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
      if (
        !apiKey ||
        apiKey.includes('your_actual_api_key')
      ) {
        throw new Error(
          "Missing or invalid API key in .env.local"
        );
      }

      let response;
      let data;

      // Retry temporary Gemini failures up to 3 times.
      // Waits: 2 seconds → 4 seconds → 8 seconds.
      for (let attempt = 0; attempt < 4; attempt++) {
        response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent?key=${apiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `${systemPrompt}\n\nChat Log:\n${chatLog}`
                    }
                  ]
                }
              ]
            })
          }
        );

        data = await response.json();

        console.log(
          `Gemini attempt ${attempt + 1}:`,
          response.status
        );

        console.log(
          "Gemini response:",
          data
        );

        // Successful response.
        if (response.ok) {
          break;
        }

        // Only retry temporary errors.
        const isTemporaryError =
          response.status === 429 ||
          response.status === 503 ||
          response.status === 500;

        // If it isn't temporary, or we've used all attempts,
        // stop retrying and show the actual error.
        if (!isTemporaryError || attempt === 3) {
          throw new Error(
            data?.error?.message ||
            `Gemini API error (${response.status})`
          );
        }

        // Wait 2s, then 4s, then 8s.
        const delay = 2000 * Math.pow(2, attempt);

        console.log(
          `Temporary Gemini error. Retrying in ${delay / 1000}s...`
        );

        await new Promise(resolve =>
          setTimeout(resolve, delay)
        );
      }

      // Handle an API-level error.
      if (data?.error) {
        throw new Error(data.error.message);
      }

      // Make sure Gemini actually returned a candidate.
      if (
        !data?.candidates ||
        !data.candidates[0]?.content?.parts?.[0]?.text
      ) {
        throw new Error(
          "Gemini returned an unexpected response format."
        );
      }

      // Extract Gemini's JSON response.
      let rawText =
        data.candidates[0].content.parts[0].text;

      // Remove markdown code fences if Gemini adds them.
      rawText = rawText
        .replace(/```json/g, '')
        .replace(/```/g, '')
        .trim();

      // Convert Gemini's response into JavaScript data.
      const parsedData = JSON.parse(rawText);

      setDashboardData(parsedData);

    } catch (err) {
      console.error("Gemini analysis failed:", err);

      // Honest error handling — no fake analysis.
      setDashboardData({
        urgency: "ERROR",
        sentiment: "System Failure",
        tldr: `API Failure: ${err.message}.`,
        actionItems: [
          {
            task: "Check Google AI Studio API Key",
            assignee: "Admin",
            confidence: 100
          },
          {
            task: "Verify rate limits have not been exceeded",
            assignee: "Admin",
            confidence: 100
          }
        ],
        decisions: [
          "System aborted parsing due to missing credentials or quota limits."
        ]
      });

    } finally {
      setTimeout(() => setLoading(false), 800);
    }
  };

  return (
    <main className="min-h-screen bg-[#0B0F19] text-slate-300 p-8 font-sans selection:bg-indigo-500/30">
      <div className="max-w-6xl mx-auto space-y-8">

        <header className="border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">

          <div>
            <div className="flex items-center gap-4">

              <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
                CatchMeUp.ai
              </h1>

            </div>

            <p className="text-slate-500 mt-2 text-sm font-mono uppercase tracking-wider">
              Neural Context Extraction Engine
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
              className="px-5 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 transition-all duration-300 bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 shadow-sm"
            >
              📂 Upload Chat Export (.txt)
            </button>
          </div>

        </header>

        <div className="grid lg:grid-cols-2 gap-6">

          <div className="space-y-4">

            <div className="bg-[#111827] rounded-2xl border border-slate-800 shadow-2xl overflow-hidden relative">

              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-[#0F1420]">

                <div className="flex items-center gap-2">

                  <div className="w-3 h-3 rounded-full bg-red-500/80"></div>

                  <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>

                  <div className="w-3 h-3 rounded-full bg-green-500/80"></div>

                  <span className="ml-2 text-xs font-mono text-slate-500">
                    raw_chat_stream.log
                  </span>

                </div>

                <button
                  onClick={loadSampleData}
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
                >
                  Use Sample Data
                </button>

              </div>

              <textarea
                value={chatLog}
                onChange={(e) => setChatLog(e.target.value)}
                placeholder="Paste raw chat logs here, or upload a .txt file..."
                className="w-full h-[450px] p-5 bg-transparent text-sm font-mono text-slate-300 focus:outline-none resize-none"
              />

            </div>

            <button
              onClick={analyzeChat}
              disabled={loading || !chatLog.trim()}
              className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(79,70,229,0.3)] disabled:opacity-50 disabled:shadow-none"
            >
              {loading
                ? 'Processing Context...'
                : 'Initialize Triage Engine'}
            </button>

          </div>

          <div className="space-y-6">

            {!dashboardData && !loading && (
              <div className="h-full min-h-[500px] border border-slate-800 bg-[#111827]/50 rounded-2xl flex flex-col items-center justify-center text-slate-600 font-mono text-sm">
                System Standby. Awaiting telemetry.
              </div>
            )}

            {loading && (
              <div className="h-full min-h-[500px] rounded-2xl border border-indigo-500/30 bg-[#0F1420] p-8 flex flex-col justify-center relative overflow-hidden">

                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-indigo-500 to-transparent animate-pulse"></div>

                <div className="space-y-4 font-mono text-sm">

                  {reasoningLogs.map((log, index) => (
                    <div
                      key={index}
                      className={`flex items-center gap-3 transition-opacity duration-300 ${index <= processingStep
                        ? 'opacity-100 text-indigo-400'
                        : 'opacity-0'
                        }`}
                    >
                      <span className="animate-spin text-indigo-600">
                        ⟳
                      </span>

                      {log}
                    </div>
                  ))}

                </div>

              </div>
            )}

            {dashboardData && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-8 duration-700">

                <div className="grid grid-cols-2 gap-4">

                  <div className="bg-[#111827] border border-slate-800 p-4 rounded-xl flex flex-col">

                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-1">
                      Threat Level
                    </span>

                    <span
                      className={`text-lg font-black tracking-wide ${dashboardData.urgency === 'CRITICAL' ||
                        dashboardData.urgency === 'ERROR'
                        ? 'text-rose-500'
                        : 'text-emerald-500'
                        }`}
                    >
                      {dashboardData.urgency}
                    </span>

                  </div>

                  <div className="bg-[#111827] border border-slate-800 p-4 rounded-xl flex flex-col">

                    <span className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-1">
                      Semantic Tone
                    </span>

                    <span className="text-lg font-bold text-amber-400">
                      {dashboardData.sentiment}
                    </span>

                  </div>

                </div>

                <div className="bg-gradient-to-br from-[#111827] to-[#0B0F19] p-6 rounded-xl border border-slate-800 shadow-lg relative overflow-hidden">

                  <h3 className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-3 flex items-center gap-2">

                    <span className="w-1.5 h-1.5 rounded-full bg-indigo-500"></span>

                    Executive Summary

                  </h3>

                  <p className="text-slate-200 text-lg leading-relaxed font-medium">
                    {dashboardData.tldr}
                  </p>

                </div>

                <div className="bg-[#111827] p-6 rounded-xl border border-slate-800 shadow-lg">

                  <h3 className="text-[10px] text-slate-500 font-mono uppercase tracking-widest mb-4">
                    Extracted Directives
                  </h3>

                  <div className="space-y-3">

                    {dashboardData.actionItems.map((item, i) => (
                      <div
                        key={i}
                        onClick={() => toggleTask(i)}
                        className={`flex items-center gap-4 p-3 rounded-lg border cursor-pointer transition-all duration-300 ${completedTasks.includes(i)
                          ? 'bg-slate-900/50 border-slate-800/50 opacity-40 grayscale'
                          : 'bg-slate-800/40 border-slate-700 hover:border-indigo-500/50 hover:bg-slate-800'
                          }`}
                      >

                        <div
                          className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${completedTasks.includes(i)
                            ? 'bg-indigo-500 border-indigo-500'
                            : 'border-slate-600'
                            }`}
                        >
                          {completedTasks.includes(i) && (
                            <span className="text-white text-xs">
                              ✓
                            </span>
                          )}
                        </div>

                        <div className="flex-1">

                          <p
                            className={`font-medium text-sm ${completedTasks.includes(i)
                              ? 'line-through text-slate-500'
                              : 'text-slate-200'
                              }`}
                          >
                            {item.task}
                          </p>

                        </div>

                        <div className="flex flex-col items-end gap-1">

                          <span className="text-[10px] font-mono text-indigo-400 bg-indigo-400/10 px-2 py-0.5 rounded">
                            @{item.assignee}
                          </span>

                          <span className="text-[9px] font-mono text-slate-500">
                            Conf: {item.confidence}%
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