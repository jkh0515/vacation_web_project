"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Editor from '@monaco-editor/react';
import { Play, Terminal, BookOpen, CheckCircle, XCircle, Clock, LayoutDashboard, LogOut } from 'lucide-react';

export default function JudgePage() {
  const router = useRouter();
  const [code, setCode] = useState<string>('import sys\ndata = sys.stdin.read().strip().split()\nprint(int(data[0]) + int(data[1]))');
  const [problemText, setProblemText] = useState<string>('');
  const [language, setLanguage] = useState<string>('python');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [output, setOutput] = useState<string>('');
  const [status, setStatus] = useState<string>('READY');
  const [user, setUser] = useState<{ email: string; username: string } | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');

    if (!token || !userData) {
      router.push('/login');
    } else {
      setUser(JSON.parse(userData));
      // Fetch latest submission
      fetch(`/api/users/me/submissions/latest`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (data && data.problemText !== undefined) {
            setProblemText(data.problemText);
            setCode(data.code);
          }
        })
        .catch(err => console.error("Failed to fetch latest submission", err));
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  const handleEditorChange = (value: string | undefined) => {
    if (value !== undefined) {
      setCode(value);
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;

    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/login');
      return;
    }

    if (!problemText.trim()) {
      setOutput('오류: 문제를 먼저 입력해주세요!');
      return;
    }
    if (!code.trim()) {
      setOutput('오류: 코드를 먼저 작성해주세요!');
      return;
    }

    setIsSubmitting(true);
    setStatus('PENDING');
    setOutput('Submitting to Judge Server...\n');

    try {
      const response = await fetch(`/api/submissions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          problemText: problemText,
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

      const eventSource = new EventSource(`/api/submissions/${submissionId}/stream`);

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
    const token = localStorage.getItem('token');
    setOutput(prev => prev + '\n[🤖 AI] 분석 중... (시간이 조금 걸릴 수 있습니다)\n');
    try {
      const response = await fetch(`/api/ai/hint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          problemText: problemText,
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
    switch (status) {
      case 'SUCCESS': return <CheckCircle className="text-green-400 w-5 h-5" />;
      case 'FAIL': return <XCircle className="text-red-400 w-5 h-5" />;
      case 'TIMEOUT': return <Clock className="text-yellow-400 w-5 h-5" />;
      case 'READY': return <div className="w-3 h-3 rounded-full bg-gray-400" />;
      default: return <div className="w-4 h-4 rounded-full border-2 border-t-blue-500 border-blue-200 animate-spin" />;
    }
  };

  if (!user) return null; // Prevent hydration flicker

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
            onClick={() => router.push('/dashboard')}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-700 hover:bg-slate-600 transition-colors"
          >
            <LayoutDashboard className="w-4 h-4" />
            Dashboard
          </button>

          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-900/50 hover:bg-red-800/50 text-red-400 hover:text-red-300 transition-colors border border-red-900/50"
            title="로그아웃"
          >
            <LogOut className="w-4 h-4" />
          </button>

          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-medium transition-all duration-300 ${isSubmitting
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
        <div className="lg:w-1/3 flex flex-col gap-4 glass rounded-2xl p-6 relative">
          <div className="flex items-center gap-2 mb-2 pb-4 border-b border-slate-700/50">
            <BookOpen className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-semibold text-slate-100">문제 직접 입력</h2>
          </div>
          <p className="text-sm text-slate-400 mb-2">
            알고리즘 문제의 설명, 입력 조건, 출력 조건을 작성해주세요. AI가 이를 읽고 채점용 엣지 테스트 케이스를 1개 자동 생성합니다.
          </p>
          <textarea
            className="w-full flex-1 bg-slate-900/50 border border-slate-700/50 rounded-xl p-4 text-slate-300 font-mono text-sm resize-none focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder-slate-600"
            placeholder="예시: 두 정수 A와 B를 입력받은 다음, A+B를 출력하는 프로그램을 작성하시오.&#10;입력: 공백으로 구분된 두 정수 (1 &lt;= A, B &lt;= 10000)"
            value={problemText}
            onChange={(e) => setProblemText(e.target.value)}
          />
        </div>

        {/* Right Panel: Editor and Terminal */}
        <div className="lg:w-2/3 flex flex-col gap-6 min-h-0">

          {/* Editor */}
          <div className="flex-1 glass rounded-2xl overflow-hidden flex flex-col border border-slate-700/50 relative">
            <div className="h-10 bg-slate-900/80 flex items-center justify-between px-4 border-b border-slate-800 backdrop-blur-md z-10">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-500/80"></div>
                <div className="w-3 h-3 rounded-full bg-green-500/80"></div>
              </div>
              <div className="text-xs font-mono text-slate-400 absolute left-1/2 -translate-x-1/2">solution.py</div>
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
