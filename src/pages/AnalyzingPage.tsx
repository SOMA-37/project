import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTravelStore } from '../store/useTravelStore';
import { ANALYSIS_FLOW } from '../mocks/analysisFlow';
import { getRecommendation } from '../utils/recommend';
import { PageLayout } from '../components/common';
import { AgentStepCard, StepIndicator } from '../components/analyzing';

export default function AnalyzingPage() {
  const navigate = useNavigate();
  const userInput = useTravelStore((s) => s.userInput);
  const setResult = useTravelStore((s) => s.setResult);

  // 진행 인덱스(현재 진행 중인 step의 index). step.id 가 아니라 0-based.
  const [currentIndex, setCurrentIndex] = useState(0);
  const [done, setDone] = useState(false);

  // StrictMode의 effect 이중 실행으로 인해 setTimeout 체인이 두 번 도는 것을 막음.
  const startedRef = useRef(false);

  useEffect(() => {
    // userInput 없이 직접 진입 / 새로고침 케이스
    if (!userInput) {
      navigate('/input', { replace: true });
      return;
    }
    if (startedRef.current) return;
    startedRef.current = true;

    let cancelled = false;
    const timers: number[] = [];

    const runStep = (i: number) => {
      if (cancelled) return;

      if (i >= ANALYSIS_FLOW.length) {
        const result = getRecommendation(userInput);
        setResult(result);
        setDone(true);
        const tid = window.setTimeout(() => {
          if (!cancelled) navigate('/result', { replace: true });
        }, 500);
        timers.push(tid);
        return;
      }

      setCurrentIndex(i);
      const tid = window.setTimeout(() => runStep(i + 1), ANALYSIS_FLOW[i].durationMs);
      timers.push(tid);
    };

    runStep(0);

    return () => {
      cancelled = true;
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [userInput, setResult, navigate]);

  if (!userInput) return null;

  return (
    <PageLayout background="mystic">
      <div className="relative flex-1 flex flex-col">
        <div
          className="absolute inset-0 pointer-events-none overflow-hidden"
          aria-hidden="true"
        >
          <span className="absolute top-[6%] left-[8%] text-xl opacity-50 animate-pulse">
            ✨
          </span>
          <span className="absolute top-[14%] right-[10%] text-base opacity-40 animate-pulse [animation-delay:0.6s]">
            ⭐
          </span>
          <span className="absolute bottom-[10%] left-[12%] text-lg opacity-40 animate-pulse [animation-delay:1.0s]">
            ✨
          </span>
        </div>

        <header className="relative pt-2 pb-6 text-center">
          <div className="text-5xl mb-3" aria-hidden="true">
            🔮
          </div>
          <h1 className="text-xl font-extrabold text-gradient-primary tracking-tight">
            당신의 사주를 풀어내고 있어요
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            잠시만 기다려 주세요. 하늘의 결을 천천히 살펴보는 중...
          </p>
        </header>

        <div className="relative mb-5">
          <StepIndicator
            total={ANALYSIS_FLOW.length}
            currentIndex={currentIndex}
            done={done}
          />
        </div>

        <div className="relative flex-1 flex flex-col gap-2.5 overflow-y-auto pb-4">
          {ANALYSIS_FLOW.map((step, idx) => {
            const state =
              done || idx < currentIndex
                ? 'done'
                : idx === currentIndex
                  ? 'active'
                  : 'pending';
            return (
              <AgentStepCard
                key={step.id}
                index={step.id}
                title={step.title}
                description={step.description}
                state={state}
              />
            );
          })}
        </div>

        <footer className="relative pt-3 pb-1 text-center">
          <p className="text-[11px] text-gray-400">
            본 결과는 재미와 참고용입니다
          </p>
        </footer>
      </div>
    </PageLayout>
  );
}
