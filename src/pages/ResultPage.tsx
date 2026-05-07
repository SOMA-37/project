import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTravelStore } from '../store/useTravelStore';
import { TRAVEL_STYLES } from '../mocks/travelStyles';
import type { AnalysisResult } from '../utils/recommend';
import { Button, Card, PageLayout } from '../components/common';
import {
  DestinationCard,
  DisclaimerBox,
  StyleBadge,
} from '../components/result';

export default function ResultPage() {
  const navigate = useNavigate();
  const result = useTravelStore((s) => s.result) as AnalysisResult | null;

  useEffect(() => {
    // 직접 URL 진입 / 새로고침으로 결과가 비어있으면 입력 페이지로 되돌림
    if (!result) {
      navigate('/input', { replace: true });
    }
  }, [result, navigate]);

  if (!result) return null;

  const styles = result.selectedStyles.map((k) => TRAVEL_STYLES[k]);

  return (
    <PageLayout background="cream">
      <header className="pt-2 pb-5">
        <div className="flex items-center gap-1.5 text-xs text-primary mb-2">
          <span aria-hidden="true">✨</span>
          <span className="font-semibold tracking-wide">분석 완료</span>
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 leading-tight">
          당신에게 어울리는
          <br />
          여행 스타일
        </h1>
      </header>

      <div className="flex-1 flex flex-col gap-5 overflow-y-auto pb-8">
        <Card padding="lg" className="bg-white">
          <div className="flex flex-wrap gap-2 mb-3">
            {styles.map((s) => (
              <StyleBadge key={s.key} style={s} />
            ))}
          </div>
          <p className="text-sm leading-relaxed text-gray-700">
            {result.styleReason}
          </p>
        </Card>

        <section>
          <div className="flex items-baseline justify-between mb-3 px-1">
            <h2 className="text-base font-extrabold text-gray-900 tracking-tight">
              추천 여행지 <span className="text-gradient-primary">Top 3</span>
            </h2>
            <span className="text-xs text-gray-500">
              가까운 순 · 결 맞춤 순
            </span>
          </div>

          <div className="flex flex-col gap-4">
            {result.destinations.map((dest, idx) => (
              <DestinationCard
                key={dest.id}
                rank={idx + 1}
                destination={dest}
                reason={result.reasonsByDestination[dest.id] ?? ''}
              />
            ))}
          </div>
        </section>

        <DisclaimerBox />
      </div>

      <div className="pt-3 pb-1 flex flex-col gap-2">
        <Button
          variant="primary"
          size="lg"
          fullWidth
          onClick={() => navigate('/input')}
        >
          조건 바꿔서 다시 받기
        </Button>
        <Button
          variant="ghost"
          size="md"
          fullWidth
          onClick={() => navigate('/')}
        >
          처음으로
        </Button>
      </div>
    </PageLayout>
  );
}
