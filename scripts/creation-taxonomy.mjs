export const CREATION_CATEGORIES = [
  "人物志",
  "剧情二创",
  "趣味整活",
  "混剪手书",
  "音乐配音",
  "同人创作",
];

const RULES = [
  ["人物志", /人物志|人物传|角色志|角色解析|角色盘点|人物解析/],
  ["混剪手书", /手书|混剪|AMV|MAD|燃向|踩点|影视剪辑|高燃|空镜/],
  ["音乐配音", /翻唱|原创曲|主题曲|角色曲|配音|广播剧|有声|歌曲|说唱|音乐/],
  ["同人创作", /同人画|绘画|临摹|自制建模|建模作品|MMD|COS|自制动画|定格|雕塑|手办/],
  ["剧情二创", /改编|凡人版|仙剑版|小剧场|短剧|剧情二创|如果.*凡人|假如/],
  ["趣味整活", /鬼畜|恶搞|整活|搞笑|沙雕|名场面|反贪|交通站|特烦恼|无仙区|抢亲|仙社会|元婴本色/],
];

export function classifyCreationByRule(title, description = "") {
  const text = String(title || "");
  if (
    /(?:第\s*)?\d{2,3}\s*[集话].*(?:解析|解读|逐帧|复盘|点评)|(?:解析|解读|逐帧).*(?:第\s*)?\d{2,3}\s*[集话]?/.test(text) ||
    /一口气看完|合集解说|正片|预告|在线观看|有声书|小说剧|3d区/.test(text)
  ) {
    return { category: "趣味整活", confidence: 0.98, source: "rule", reason: "逐集解析、正片或资讯不进入二创榜", include: false };
  }
  for (const [category, pattern] of RULES) {
    if (pattern.test(text)) {
      return { category, confidence: 0.92, source: "rule", reason: "命中高置信度内容特征", include: true };
    }
  }
  if (/二创|同人|凡人官方二创大会/.test(text)) {
    return { category: "趣味整活", confidence: 0.58, source: "rule", reason: "仅命中宽泛二创特征，建议模型复核", include: true };
  }
  return { category: "趣味整活", confidence: 0.25, source: "rule", reason: "缺少明确二创特征", include: false };
}

export const TAXONOMY_PROMPT = `你是《凡人修仙传》B站二创内容分类器。只能从以下六类中选择：
1. 人物志：人物生平、角色动机、角色形象或关系解析。
2. 剧情二创：改写剧情、短剧、小剧场、跨作品剧情重构。
3. 趣味整活：鬼畜、恶搞、梗视频、搞笑剪辑、娱乐向配文。
4. 混剪手书：AMV、MAD、燃向或情绪向混剪、手书。
5. 音乐配音：翻唱、原创曲、角色曲、配音、广播剧或有声演绎。
6. 同人创作：绘画、建模、MMD、COS、自制动画、实体手作。

逐集解析、正片搬运、预告、纯资讯不是二创，include=false。根据标题、简介、UP主和时长判断；不确定时降低 confidence，不要创造新分类。`;
