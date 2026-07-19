import WeeklyMap from "@/components/WeeklyMap";
import { getAtlasSummary } from "@/lib/atlas-data";

export default async function Home() {
  const summary = await getAtlasSummary();

  if (!summary) {
    return (
      <main className="empty-state">
        <span className="atlas-seal">凡<br />图</span>
        <h1>残图尚未显形</h1>
        <p>请先生成一次数据快照，再回来循迹。</p>
      </main>
    );
  }

  return <WeeklyMap {...summary} />;
}
