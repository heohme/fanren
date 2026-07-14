const EP_PATTERNS = [
  // 新季度标题常同时包含季度内集数和总集数，优先使用总集数。
  /总第\s*0*(\d{1,4})\s*[集话回]/,
  /(?:解析|解读|逐帧|漫谈)\s*[-－—]\s*0*(\d{2,4})(?!\d)/,
  /第\s*0*(\d{1,4})\s*[集话回]/,
  /\b0*(\d{2,4})\s*[集话回]\s*(?:解析|解读|逐帧|漫谈|预告)/,
  /(?:^|[^0-9])(?:EP|Ep|ep)\s*0*(\d{1,4})(?!\d)/,
  /(?:^|[^a-zA-Z0-9])E0*(\d{1,4})(?![a-zA-Z0-9])/,
  /[【\[]\s*0*(\d{1,4})\s*[】\]]/,
  /(?:凡人修仙传|凡人)\s*[-：:]?\s*0*(\d{2,3})(?=\s*(?:集|话|解析|解读|逐帧|预告|$))/,
];

const RANGE_PATTERN = /\d+\s*[\-~到至]\s*\d+\s*[集话]/;

const PV_KEYWORDS = ["PV", "pv", "Pv", "花絮", "物料", "定档", "概念图", "新年番", "预热", "新作", "首曝", "新形象", "建模", "曝光"];
const CHARACTER_PROFILE_KEYWORDS = ["人物志", "角色志", "篇：", "篇 ：", "形象", "群像"];
const DEEP_TOPIC_KEYWORDS = [
  "之", "盘点", "解析", "深度", "点评", "细数", "演化", "发展史",
  "盘点", "回顾", "对比", "影响", "起源", "背景", "考据", "改编",
  "斗法大", "境界", "实力", "修为", "心理", "心思", "心理活动",
  "为什么", "为何", "如何", "究竟", "到底", "是不是", "能否",
  "赏析", "神技", "宝物", "法宝", "意义", "新约", "旧约",
  "全能", "短板", "天花板", "强者", "最强",
];
const CHAT_KEYWORDS = ["闲聊", "杂谈", "随便", "聊一聊", "竞猜", "预测", "在线人数"];

export function matchEpisode(title, series) {
  const result = {
    matched: false,
    ep: null,
    isCompilation: false,
    contentType: null,
    characters: [],
  };
  if (!title) return result;

  const keywords = series.keywords || ["凡人"];
  const hitKeyword = keywords.some((kw) => title.includes(kw));
  if (!hitKeyword) return { ...result, reason: "no-keyword" };

  result.matched = true;

  result.characters = extractCharacters(title, series.characters || []);

  if (RANGE_PATTERN.test(title)) {
    result.isCompilation = true;
    result.contentType = "compilation";
    return result;
  }

  const epNum = extractEpisode(title);
  if (epNum != null) {
    result.ep = epNum;
    result.contentType = title.includes("预告") ? "episode-preview" : "episode";
    return result;
  }

  if (PV_KEYWORDS.some((kw) => title.includes(kw))) {
    result.contentType = "pv";
    return result;
  }

  if (CHARACTER_PROFILE_KEYWORDS.some((kw) => title.includes(kw)) || result.characters.length > 0) {
    if (
      CHARACTER_PROFILE_KEYWORDS.some((kw) => title.includes(kw)) ||
      (result.characters.length > 0 && isCharacterFocused(title, result.characters))
    ) {
      result.contentType = "character";
      return result;
    }
  }

  if (CHAT_KEYWORDS.some((kw) => title.includes(kw))) {
    result.contentType = "chat";
    return result;
  }

  if (DEEP_TOPIC_KEYWORDS.some((kw) => title.includes(kw))) {
    result.contentType = "topic";
    return result;
  }

  result.contentType = "other";
  return result;
}

function extractEpisode(title) {
  for (const re of EP_PATTERNS) {
    const m = title.match(re);
    if (m) {
      const n = parseInt(m[1], 10);
      if (n >= 1 && n <= 999) return n;
    }
  }
  return null;
}

function extractCharacters(title, dict) {
  const hits = new Set();
  for (const name of dict) {
    if (title.includes(name)) hits.add(name);
  }
  const arr = Array.from(hits).sort((a, b) => b.length - a.length);
  const deduped = [];
  for (const name of arr) {
    if (!deduped.some((existing) => existing.includes(name))) {
      deduped.push(name);
    }
  }
  return deduped;
}

function isCharacterFocused(title, characters) {
  for (const name of characters) {
    const idx = title.indexOf(name);
    if (idx < 0) continue;
    const tail = title.slice(idx + name.length, idx + name.length + 4);
    if (/[篇志]/.test(tail)) return true;
  }
  const charCount = characters.length;
  const total = title.length;
  if (charCount === 1 && total < 30) {
    const around = title.slice(0, 20);
    if (/(?:解析|解读|揭秘|分析|赏析|心路|心理|是谁|何许)/.test(around)) return true;
  }
  return false;
}

export const CONTENT_TYPES = {
  episode: "集解读",
  "episode-preview": "集预告",
  pv: "PV / 物料",
  character: "人物志",
  topic: "专题深度",
  chat: "杂谈",
  compilation: "合集",
  other: "其他",
};

export const MAJOR_CATEGORIES = {
  episode: "main",
  "episode-preview": "main",
  pv: "side",
  character: "side",
  topic: "side",
  chat: "side",
  compilation: "side",
  other: "side",
};
