export const TAXONOMY_VERSION = 2;
export const PROMPT_VERSION = 2;

export const CREATION_CATEGORIES = [
  "人物志",
  "剧情二创",
  "趣味整活",
  "混剪手书",
  "音乐配音",
  "同人创作",
];

export const RELEVANCE_VALUES = ["related", "weak", "irrelevant"];
export const CONTENT_NATURE_VALUES = [
  "secondary_creation",
  "character_or_lore",
  "episode_analysis",
  "news_or_preview",
  "official_content",
  "clip_or_repost",
  "unknown",
];
export const ORIGINALITY_VALUES = ["original", "deep_adaptation", "light_edit", "unknown"];
export const CREATOR_POTENTIAL_VALUES = ["one_off", "observe", "recommend"];
export const RISK_FLAG_VALUES = ["episode_analysis", "repost", "official_clip", "weak_relevance", "uncertain"];

const CATEGORY_RULES = [
  ["人物志", /人物志|人物传|角色志|角色解析|角色盘点|人物解析|设定补充|法宝解析/],
  ["混剪手书", /手书|混剪|AMV|MAD|燃向|踩点|影视剪辑|高燃|空镜/],
  ["音乐配音", /翻唱|原创曲|主题曲|角色曲|配音|广播剧|歌曲|说唱|音乐|试弹/],
  ["同人创作", /同人画|绘画|临摹|自制建模|建模作品|MMD|COS|自制动画|定格|雕塑|手办|写真集/],
  ["剧情二创", /改编|凡人版|仙剑版|小剧场|短剧|剧情二创|如果.*凡人|假如|视角演绎/],
  ["趣味整活", /鬼畜|恶搞|整活|搞笑|沙雕|名场面|反贪|交通站|特烦恼|无仙区|抢亲|仙社会|元婴本色/],
];

const HARD_EXCLUDE = [
  /(?:第\s*)?\d{1,3}\s*[集话].*(?:解析|解读|逐帧|复盘|点评|前瞻)/,
  /(?:解析|解读|逐帧|复盘|点评).*(?:第\s*)?\d{1,3}\s*[集话]?/,
  /一口气看完|合集解说|正片|完整动画|在线观看|有声书|小说剧|预告|PV\s*解析/i,
  /更新到第?\s*\d{1,3}\s*[集话]|第?\s*\d{1,3}\s*[集话]\s*(?:完整版|完整剧情)/,
];

export function classifyCreationByRule(title, description = "") {
  const text = `${String(title || "")} ${String(description || "")}`;
  if (HARD_EXCLUDE.some((pattern) => pattern.test(text))) {
    return {
      category: null,
      confidence: 0.99,
      source: "rule",
      reason: "命中逐集解析、正片、预告或长篇复述硬排除规则",
      include: false,
      hardExcluded: true,
    };
  }
  for (const [category, pattern] of CATEGORY_RULES) {
    if (pattern.test(text)) {
      return { category, confidence: 0.9, source: "rule", reason: "命中明确内容形态特征", include: true, hardExcluded: false };
    }
  }
  if (/二创|同人|凡人官方二创大会/.test(text)) {
    return { category: "趣味整活", confidence: 0.55, source: "rule", reason: "仅命中宽泛二创特征，交由模型判断", include: true, hardExcluded: false };
  }
  return { category: null, confidence: 0.2, source: "rule", reason: "缺少明确创作形态", include: false, hardExcluded: false };
}

export const TAXONOMY_PROMPT = `你是《凡人修仙传》社区内容策展分类器。你要区分“有创作价值的内容”和“普通解说、正片剪辑或搬运”，不要因为标题包含《凡人修仙传》就收录。

请为每条候选输出以下字段：
- relevance：related / weak / irrelevant。
- contentNature：
  - secondary_creation：改写剧情、小剧场、鬼畜、混剪、手书、翻唱、配音、绘画、建模、MMD、COS、自制动画等二次创作；
  - character_or_lore：围绕人物生平、动机、关系、门派、功法、法宝或世界观进行有主题的内容；
  - episode_analysis：逐集解析、剧情复盘、剧情解说、一口气看完、普通点评；
  - news_or_preview：预告、PV资讯、更新消息；
  - official_content：官方正片或官方物料；
  - clip_or_repost：正片切片、简单拼接、搬运、疑似完整剧情；
  - unknown：无法判断。
- creationType：只能是 人物志 / 剧情二创 / 趣味整活 / 混剪手书 / 音乐配音 / 同人创作；非可收录内容也选择最接近的类型，供分析使用。
- originality：original / deep_adaptation / light_edit / unknown。
- eventTag：明确参与活动时填写活动名，例如“凡人官方二创大会”，否则为 null。
- creatorPotential：one_off / observe / recommend。仅依据本条作品判断，不要因播放高就直接 recommend。
- confidence：0 到 1。
- riskFlags：只能从 episode_analysis / repost / official_clip / weak_relevance / uncertain 中选择，可为空数组。
- reason：一句简短中文理由。

重要边界：
1. “某集讲了什么”“某集解析”“剧情解说”“一口气看完”不是剧情二创。
2. 换一个角色视角复述原剧情，如果没有明显改写、表演或原创叙事，也属于 episode_analysis。
3. 直接剪正片配音乐通常是 light_edit；只有明确主题表达、重新编排或原创手书才属于混剪手书。
4. 人物志允许人物、宗门、功法、法宝和世界观专题，但普通剧情复述不算人物志。
5. 播放量不能替代原创性判断；不确定时降低 confidence 并添加 uncertain。`;
