"use client";

import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Play, Terminal, BookOpen, CheckCircle, XCircle, Clock } from 'lucide-react';

export default function JudgePage() {
  const [code, setCode] = useState<string>('import sys\ndata = sys.stdin.read().strip().split()\nprint(int(data[0]) + int(data[1]))');
  const [language, setLanguage] = useState<string>('python');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [output, setOutput] = useState<string>('');
  const [status, setStatus] = useState<string>('READY'); // READY, PENDING, PROCESSING, SUCCESS, FAIL, TIMEOUT, ERROR

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    setStatus('PENDING');
    setOutput('Submitting to Judge Server...\n');

    try {
      const response = await fetch('http://localhost:8080/api/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 1,
          problemId: 1,
          code: code,
          language: language,
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit code');
      }

      const submissionId = data.submission_id;
      setOutput(prev => prev + `Submission successful! (ID: ${submissionId})\nConnecting to real-time stream...\n`);

      // Connect to SSE stream
      const eventSource = new EventSource(`http://localhost:8080/api/submissions/${submissionId}/stream`);

      eventSource.addEventListener('connect', (e) => {
        setOutput(prev => prev + `[Connected] ${e.data}\nWaiting for worker...\n`);
      });

      eventSource.addEventListener('judge_result', (e) => {
        const result = JSON.parse(e.data);
        setStatus(result.status);
        
        let formattedOutput = `\n[Result: ${result.status}]\n`;
        if (result.output) {
          formattedOutput += `Output:\n${result.output}\n`;
        }
        
        setOutput(prev => prev + formattedOutput);
        
        // Close connection once result is received
        eventSource.close();
        setIsSubmitting(false);
      });

      eventSource.onerror = (e) => {
        setOutput(prev => prev + '\n[Error] Connection to stream lost.\n');
        eventSource.close();
        setIsSubmitting(false);
        if (status === 'PENDING') {
            setStatus('ERROR');
        }
      };

    } catch (error: any) {
      setOutput(prev => prev + `\n[Error] ${error.message}\n`);
      setStatus('ERROR');
      setIsSubmitting(false);
    }
  };

  const getAiHint = async () => {
    setOutput(prev => prev + '\n[🤖 AI] 분석 중... (시간이 조금 걸릴 수 있습니다)\n');
    try {
      const response = await fetch('http://localhost:8080/api/ai/hint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          problemText: "두 정수 A와 B를 입력받은 다음, A+B를 출력하는 프로그램을 작성하시오.",
          failedCode: code,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error);

      setOutput(prev => prev + `\n[🤖 AI Hint]\n${data.hint}\n\n`);
    } catch (error: any) {
      setOutput(prev => prev + `\n[🤖 AI Error] ${error.message}\n`);
    }
  };

  const getStatusIcon = () => {
    switch(status) {
      case 'SUCCESS': return <CheckCircle className="text-green-400 w-5 h-5" />;
      case 'FAIL': return <XCircle className="text-red-400 w-5 h-5" />;
      case 'TIMEOUT': return <Clock className="text-yellow-400 w-5 h-5" />;
      case 'READY': return <div className="w-3 h-3 rounded-full bg-gray-400" />;
      default: return <div className="w-4 h-4 rounded-full border-2 border-t-blue-500 border-blue-200 animate-spin" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0f172a] text-slate-200 p-4 md:p-6 flex flex-col h-screen">
      {/* Header */}
      <header className="flex justify-between items-center mb-6 glass px-6 py-4 rounded-2xl">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <span className="gradient-text">Vacation</span> Judge
        </h1>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800/50 border border-slate-700">
            <span className="text-sm text-slate-400">Status:</span>
            <span className="text-sm font-medium flex items-center gap-2">
              {status} {getStatusIcon()}
            </span>
          </div>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-300 ${
              isSubmitting 
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                : 'bg-blue-600 hover:bg-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.4)] text-white'
            }`}
          >
            <Play className="w-4 h-4" />
            {isSubmitting ? 'Running...' : 'Run Code'}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
        
        {/* Left Panel: Problem Description */}
        <div className="lg:w-1/3 flex flex-col gap-4 glass rounded-2xl p-6 overflow-y-auto">
          <div className="flex items-center gap-2 mb-2 pb-4 border-b border-slate-700/50">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-semibold text-slate-100">1. A+B</h2>
          </div>
          <div className="space-y-4 text-slate-300 leading-relaxed">
            <p>
              두 정수 A와 B를 입력받은 다음, A+B를 출력하는 프로그램을 작성하시오.
            </p>
            
            <div className="mt-6">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Input</h3>
              <div className="bg-slate-900 p-4 rounded-xl font-mono text-sm border border-slate-800">
                10 25
              </div>
            </div>

            <div className="mt-4">
              <h3 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-2">Output</h3>
              <div className="bg-slate-900 p-4 rounded-xl font-mono text-sm border border-slate-800">
                35
              </div>
            </div>
            
            <div className="mt-8 flex gap-4 text-xs text-slate-500">
              <div className="glass px-3 py-1 rounded-lg">Time Limit: 2.0s</div>
              <div className="glass px-3 py-1 rounded-lg">Memory Limit: 256MB</div>
            </div>
          </div>
        </div>

        {/* Right Panel: Editor and Terminal */}
        <div className="lg:w-2/3 flex flex-col gap-6 min-h-0">
          
          {/* Editor */}
          <div className="flex-1 glass rounded-2xl overflow-hidden flex flex-col border border-slate-700/50 relative">
            <div className="h-10 bg-slate-900/80 flex items-center px-4 border-b border-slate-800 backdrop-blur-md z-10">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <div className="mx-auto text-xs font-mono text-slate-400">solution.py</div>
            </div>
            <div className="flex-1 w-full relative">
              <Editor
                height="100%"
                language="python"
                theme="vs-dark"
                value={code}
                onChange={handleEditorChange}
                options={{
                  minimap: { enabled: false },
                  fontSize: 15,
                  fontFamily: 'var(--font-mono), monospace',
                  padding: { top: 16 },
                  scrollBeyondLastLine: false,
                  smoothScrolling: true,
                  cursorBlinking: "smooth",
                }}
              />
            </div>
          </div>

          {/* Terminal / Output */}
          <div className="h-64 glass rounded-2xl p-4 flex flex-col relative">
            <div className="flex items-center justify-between gap-2 mb-3 text-slate-400 pb-2 border-b border-slate-700/50">
              <div className="flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                <span className="text-sm font-medium uppercase tracking-wider">Output Terminal</span>
              </div>
              {status === 'FAIL' && (
                <button 
                  onClick={getAiHint}
                  className="text-xs px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded-lg flex items-center gap-1 transition-colors"
                >
                  💡 AI 힌트 받기
                </button>
              )}
            </div>
            <div className="flex-1 bg-[#0a0f1a] rounded-xl p-4 font-mono text-sm overflow-y-auto whitespace-pre-wrap border border-slate-800 text-green-400 shadow-inner">
              {output || 'Run your code to see the output here...'}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
