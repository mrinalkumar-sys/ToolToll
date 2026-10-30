import React, { useState } from 'react';
import {
  Sparkles,
  Bot,
  Play,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { api } from '../services/api.js';
import { Badge } from '../components/Badge.jsx';

export const PlaygroundPage = () => {
  const [taskPrompt, setTaskPrompt] = useState(
    'Translate this suspicious SMS into English, check whether it might be a scam, and summarize the warning signs.'
  );
  const [selectionMode, setSelectionMode] = useState('deterministic');

  const [planning, setPlanning] = useState(false);
  const [planResult, setPlanResult] = useState(null);

  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState(null);
  const [error, setError] = useState(null);

  const samplePrompts = [
    {
      title: 'Scam SMS Translation & Forensics',
      prompt:
        'Translate this suspicious SMS: "URGENT: Votre compte bancaire est suspendu. Cliquez sur bit.ly/bank-auth pour vérifier immédiatement." into English, check whether it might be a scam, and summarize the warning signs.',
    },
    {
      title: 'Customer Sentiment & Emotion Scan',
      prompt:
        'Analyze customer sentiment and emotional tone for this feedback: "I am extremely frustrated! The shipment arrived 5 days late, damaged, and customer support refused to refund me."',
    },
    {
      title: 'Multilingual Text Translation',
      prompt:
        'Translate "Hello, this is a message to confirm your appointment tomorrow at 10 AM" into Spanish.',
    },
  ];

  const handlePlanTask = async () => {
    if (!taskPrompt.trim()) return;
    setPlanning(true);
    setError(null);
    setPlanResult(null);
    setExecuteResult(null);

    try {
      const plan = await api.planAgentTask({
        task_prompt: taskPrompt,
        selection_mode: selectionMode,
      });
      setPlanResult(plan);
    } catch (err) {
      setError(err.message || 'Planning failed');
    } finally {
      setPlanning(false);
    }
  };

  const handleExecutePlan = async () => {
    setExecuting(true);
    setError(null);
    try {
      const res = await api.executeAgentTask({
        task_prompt: taskPrompt,
        selection_mode: selectionMode,
        approved_tool_ids: planResult?.selected_tools.map((t) => t.tool_id),
      });
      setExecuteResult(res);
    } catch (err) {
      setError(err.message || 'Execution failed');
    } finally {
      setExecuting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <Sparkles className="w-6 h-6 text-indigo-400" />
          Autonomous AI Agent Playground
        </h1>
        <p className="text-xs text-slate-400">
          The agent automatically discovers and selects suitable registered tools from ToolToll. You do not need to manually pick APIs.
        </p>
      </div>

      {/* Input Section */}
      <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
        {/* Sample Prompt Pills */}
        <div className="space-y-2">
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Sample Multi-Tool Prompts:
          </span>
          <div className="flex flex-wrap gap-2">
            {samplePrompts.map((s, idx) => (
              <button
                key={idx}
                onClick={() => {
                  setTaskPrompt(s.prompt);
                  setPlanResult(null);
                  setExecuteResult(null);
                }}
                className="px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 hover:border-slate-700 text-xs text-slate-300 hover:text-white transition text-left cursor-pointer"
              >
                {s.title}
              </button>
            ))}
          </div>
        </div>

        {/* Task Prompt Area */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-slate-300">
            Natural-Language Task Description:
          </label>
          <textarea
            rows={3}
            value={taskPrompt}
            onChange={(e) => setTaskPrompt(e.target.value)}
            placeholder="Describe what you want the agent to accomplish..."
            className="w-full p-3.5 rounded-xl bg-slate-950 border border-slate-800 focus:border-indigo-500 text-sm text-slate-100 placeholder-slate-600 outline-none transition"
          />
        </div>

        {/* Controls: Mode selection + Plan Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2">
          <div className="flex items-center gap-3 text-xs">
            <span className="text-slate-400">Tool Selection Mode:</span>
            <div className="flex rounded-lg bg-slate-950 border border-slate-800 p-0.5">
              <button
                type="button"
                onClick={() => setSelectionMode('deterministic')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  selectionMode === 'deterministic'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Deterministic Discovery
              </button>
              <button
                type="button"
                onClick={() => setSelectionMode('llm')}
                className={`px-3 py-1 rounded-md transition cursor-pointer ${
                  selectionMode === 'llm'
                    ? 'bg-indigo-600 text-white font-semibold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                LLM-Assisted Planning
              </button>
            </div>
          </div>

          <button
            onClick={handlePlanTask}
            disabled={planning || !taskPrompt.trim()}
            className="px-6 py-2.5 rounded-xl font-semibold bg-indigo-600 hover:bg-indigo-500 text-white transition disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 cursor-pointer"
          >
            <Bot className="w-4 h-4" />
            {planning ? 'Discovering Tools...' : 'Plan Task & Discover Tools'}
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {/* Step 1: Agent Plan Preview */}
      {planResult && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <span className="text-[10px] text-cyan-400 font-semibold uppercase tracking-wider">
                Step 1: Agent Tool Discovery & Budgeting
              </span>
              <h3 className="text-base font-bold text-white mt-0.5">
                Proposed Multi-Tool Execution Plan
              </h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Estimated Total Cost:</span>
              <div className="text-lg font-bold text-emerald-400 font-mono">
                ${Number(planResult.estimated_total_cost).toFixed(4)} USD
              </div>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
            {planResult.plan_explanation}
          </p>

          {/* Selected Tools Cards */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-slate-400">Discovered Marketplace Tools:</span>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {planResult.selected_tools.map((t, idx) => (
                <div
                  key={t.tool_id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2 flex flex-col justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-white text-xs">{idx + 1}. {t.tool_name}</span>
                      <span className="font-mono text-xs font-semibold text-emerald-400">
                        ${Number(t.price_per_call).toFixed(4)}
                      </span>
                    </div>
                    <Badge variant="purple" className="text-[9px] py-0 capitalize">
                      {t.category}
                    </Badge>
                    <p className="text-[11px] text-slate-400 leading-snug pt-1">
                      {t.selection_reason}
                    </p>
                  </div>
                  <div className="text-[10px] text-slate-500 pt-1 flex items-center justify-between border-t border-slate-900">
                    <span>Reliability: {t.measured_reliability * 100}%</span>
                    <span className="font-mono">ID: {t.tool_id.slice(0, 8)}...</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Approval Notice & Execute Trigger */}
          <div className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {planResult.requires_human_approval ? (
                <div className="flex items-center gap-2 text-xs text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>{planResult.approval_reason}</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs text-emerald-400">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Within agent auto-approval limit. Ready to execute atomically.</span>
                </div>
              )}
            </div>

            <button
              onClick={handleExecutePlan}
              disabled={executing}
              className="px-6 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-emerald-600/20 shrink-0 cursor-pointer"
            >
              <Play className="w-4 h-4" />
              {executing ? 'Executing Paid Tools...' : 'Approve & Execute Plan'}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Live Execution Timeline & Results */}
      {executeResult && (
        <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 space-y-6 animate-in fade-in">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <span className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider">
                Step 2: Execution Results & Settlement
              </span>
              <h3 className="text-base font-bold text-white mt-0.5">
                Multi-Tool Execution Complete
              </h3>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-400">Total Billed:</span>
              <div className="text-lg font-bold text-emerald-400 font-mono">
                ${Number(executeResult.total_cost).toFixed(4)} USD
              </div>
            </div>
          </div>

          {/* Step Timeline */}
          <div className="space-y-3">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Tool Invocation Trace:
            </span>
            <div className="space-y-3">
              {executeResult.executed_steps.map((s, idx) => (
                <div
                  key={s.tool_id}
                  className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-slate-800 text-[11px] font-bold text-slate-300 flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="font-bold text-white text-xs">{s.tool_name}</span>
                      <Badge variant={s.status === 'success' ? 'success' : 'danger'}>
                        {s.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="text-slate-400 font-mono">{Number(s.duration_ms).toFixed(0)}ms</span>
                      <span className="font-mono font-bold text-emerald-400">
                        ${Number(s.price_charged).toFixed(4)}
                      </span>
                    </div>
                  </div>

                  {/* Output Viewer */}
                  {s.output && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">Tool Output:</span>
                      <pre className="p-3 rounded-lg bg-slate-900 border border-slate-800/80 text-[11px] text-slate-200 font-mono overflow-x-auto max-h-36">
                        {JSON.stringify(s.output, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Final Synthesized Summary */}
          <div className="p-5 rounded-xl bg-gradient-to-r from-indigo-950/40 via-slate-950 to-slate-950 border border-indigo-800/60 space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-300">
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>Final Agent Synthesis & Findings:</span>
            </div>
            <div className="text-xs text-slate-200 leading-relaxed whitespace-pre-line font-sans">
              {executeResult.final_summary}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
