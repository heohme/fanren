import fs from "node:fs/promises";
import path from "node:path";
import type { Snapshot } from "@/lib/types";
import {
  buildEpisodeRows,
  getCharacterGroups,
  getSideVideosByType,
} from "@/lib/aggregate";
import Header from "@/components/Header";
import WeeklyMap, { type MapNode } from "@/components/WeeklyMap";
import EpisodeList from "@/components/EpisodeList";
import SideContentPanel from "@/components/SideContentPanel";
import CharacterChips from "@/components/CharacterChips";
import UpsStatus from "@/components/UpsStatus";

export const dynamic = "force-static";
export const revalidate = 600;

async function loadSnapshot(): Promise<Snapshot | null> {
  try {
    const p = path.join(process.cwd(), "data", "snapshot.json");
    return JSON.parse(await fs.readFile(p, "utf8")) as Snapshot;
  } catch {
    return null;
  }
}

export default async function Home() {
  const snap = await loadSnapshot();

  if (!snap) {
    return (
      <main className="empty-state">
        <span className="brand-seal">凡<br />图</span>
        <h1>残图尚未显形</h1>
        <p>请先生成一次数据快照，再回来循迹。</p>
      </main>
    );
  }

  const rows = buildEpisodeRows(snap);
  const latest = rows[0] || null;
  const characters = getSideVideosByType(snap, "character");
  const topics = getSideVideosByType(snap, "topic");
  const pv = getSideVideosByType(snap, "pv");
  const chat = getSideVideosByType(snap, "chat");
  const compilations = getSideVideosByType(snap, "compilation");
  const characterAndTopic = [...characters, ...topics].sort((a, b) => b.video.pubTime - a.video.pubTime);
  const pvAndChat = [...pv, ...chat, ...compilations].sort((a, b) => b.video.pubTime - a.video.pubTime);
  const characterGroups = getCharacterGroups(snap);
  const sideTotal = characterAndTopic.length + pvAndChat.length;
  const healthyUps = snap.ups.filter((up) => !up.error && up.videos.length > 0).length;

  const nodes: MapNode[] = [
    {
      key: "official",
      marker: "正片",
      label: "本周新章",
      eyebrow: "本周残图 · 正片节点",
      title: latest ? `第 ${latest.ep} 话已标记` : "等待新章现世",
      copy: latest?.official?.longTitle
        ? `《${latest.official.longTitle}》已经收入本周残图，可从官方原址观看。`
        : "官方正片一旦更新，就会在这里自动点亮。",
      href: latest?.official?.playUrl || snap.series.officialUrl,
      action: "前往官方正片",
    },
    {
      key: "episode",
      marker: "解",
      label: "百家论道",
      eyebrow: "本周残图 · 分集解析",
      title: latest ? `${latest.upVideos.length} 位道友已出解读` : "解析仍在汇聚",
      copy: latest?.upVideos.length
        ? `已收录 ${latest.upVideos.slice(0, 3).map(({ up }) => up.name).join("、")}${latest.upVideos.length > 3 ? "等" : ""}的本集内容。`
        : "持续巡检常驻创作者，新的分集解读会自动归位。",
      href: "#episodes",
      action: "查看分集矩阵",
    },
    {
      key: "characters",
      marker: "志",
      label: "人物行迹",
      eyebrow: "本周残图 · 人物专题",
      title: `${characterGroups.length} 条人物线索可循`,
      copy: characterGroups.length
        ? `韩立的仙途并非孤线，当前可从 ${characterGroups.slice(0, 4).map((group) => group.character).join("、")} 等线索继续探索。`
        : "人物与剧情线索正在整理中。",
      href: "#topics",
      action: "打开万象志",
    },
    {
      key: "side",
      marker: "闻",
      label: "物料见闻",
      eyebrow: "本周残图 · 周边见闻",
      title: `${sideTotal} 条深度内容已归档`,
      copy: "人物志、原著考据、PV、制作物料与长篇专题都在此归档，并始终跳转创作者原始发布页。",
      href: "#topics",
      action: "浏览周边解析",
    },
  ];

  const stats = [
    { value: latest ? String(latest.ep).padStart(3, "0") : "—", label: "当前正片", note: "官方原址直达" },
    { value: String(latest?.upVideos.length || 0).padStart(2, "0"), label: "本集解析", note: "按创作者聚合" },
    { value: String(sideTotal).padStart(2, "0"), label: "万象见闻", note: "人物 · 专题 · 物料" },
    { value: `${healthyUps}/${snap.ups.length}`, label: "寻迹道友", note: "采集状态正常" },
  ];

  return (
    <main className="site-shell">
      <Header series={snap.series} official={snap.official} generatedAt={snap.generatedAt} />
      <WeeklyMap nodes={nodes} stats={stats} episode={latest?.ep || null} />

      <section className="content-layout" id="episodes">
        <div className="main-column">
          <div className="section-intro">
            <p className="section-kicker">EPISODE ARCHIVE</p>
            <h2>分集档案</h2>
            <p>每一话的官方入口与常驻创作者解读，都按时间自动归位。</p>
          </div>
          <EpisodeList rows={rows} ups={snap.ups} />

          <div id="topics" className="topic-anchor">
            <div className="section-intro compact">
              <p className="section-kicker">ALL THINGS ARCHIVE</p>
              <h2>万象志</h2>
              <p>循人物与专题线索，继续补全正片之外的世界。</p>
            </div>
            <CharacterChips groups={characterGroups} />
            <SideContentPanel characterAndTopic={characterAndTopic} pvAndChat={pvAndChat} total={sideTotal} />
          </div>
        </div>

        <aside className="side-column">
          <div className="aside-label">寻迹傀儡 · 实时状态</div>
          <UpsStatus ups={snap.ups} />
          <div className="principle-card">
            <span>引</span>
            <div><strong>只作指路，不作搬运</strong><p>所有正片与创作内容均回到原始发布页。</p></div>
          </div>
        </aside>
      </section>

      <footer className="site-footer">
        <div className="brand">
          <span className="brand-seal small" aria-hidden="true">凡<br />图</span>
          <span><strong>凡人残图</strong><small>让每一份好创作，都能被同道寻见。</small></span>
        </div>
        <p>非官方爱好者项目 · 数据自动同步 · 仅作公开内容索引</p>
      </footer>
    </main>
  );
}
