import fs from "node:fs/promises";
import path from "node:path";
import type { Snapshot } from "@/lib/types";
import {
  buildEpisodeRows,
  getCharacterGroups,
  getSideVideosByType,
} from "@/lib/aggregate";
import Header from "@/components/Header";
import EpisodeList from "@/components/EpisodeList";
import SideContentPanel from "@/components/SideContentPanel";
import CharacterChips from "@/components/CharacterChips";
import UpsStatus from "@/components/UpsStatus";

export const dynamic = "force-static";
export const revalidate = 600;

async function loadSnapshot(): Promise<Snapshot | null> {
  try {
    const p = path.join(process.cwd(), "data", "snapshot.json");
    const txt = await fs.readFile(p, "utf8");
    return JSON.parse(txt) as Snapshot;
  } catch {
    return null;
  }
}

export default async function Home() {
  const snap = await loadSnapshot();

  if (!snap) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-20 text-center">
        <h1 className="text-3xl font-bold">凡人残图</h1>
        <p className="mt-6 text-ink-600">
          尚未生成快照数据。请先运行{" "}
          <code className="rounded bg-ink-100 px-1.5 py-0.5">npm run fetch</code>。
        </p>
      </main>
    );
  }

  const rows = buildEpisodeRows(snap);
  const characters = getSideVideosByType(snap, "character");
  const topics = getSideVideosByType(snap, "topic");
  const pv = getSideVideosByType(snap, "pv");
  const chat = getSideVideosByType(snap, "chat");
  const compilations = getSideVideosByType(snap, "compilation");

  const characterAndTopic = [...characters, ...topics].sort(
    (a, b) => b.video.pubTime - a.video.pubTime
  );
  const pvAndChat = [...pv, ...chat, ...compilations].sort(
    (a, b) => b.video.pubTime - a.video.pubTime
  );

  const characterGroups = getCharacterGroups(snap);
  const sideTotal = characterAndTopic.length + pvAndChat.length;

  return (
    <main className="mx-auto max-w-6xl px-4 pb-24">
      <Header
        series={snap.series}
        official={snap.official}
        generatedAt={snap.generatedAt}
      />

      <section className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
        <div>
          <EpisodeList rows={rows} ups={snap.ups} />
          <CharacterChips groups={characterGroups} />
          <SideContentPanel
            characterAndTopic={characterAndTopic}
            pvAndChat={pvAndChat}
            total={sideTotal}
          />
        </div>
        <aside className="lg:sticky lg:top-6 lg:self-start">
          <UpsStatus ups={snap.ups} />
        </aside>
      </section>

      <footer className="mt-16 text-center text-xs text-ink-400">
        凡人残图 · 数据每 10 分钟自动同步 · 仅做更新追踪用
      </footer>
    </main>
  );
}
