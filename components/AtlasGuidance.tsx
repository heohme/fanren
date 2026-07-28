"use client";

export type GuidedRealm = "righteous" | "demonic" | "heaven" | "nine";

export const ONBOARDING_STEPS: Array<{
  eyebrow: string;
  title: string;
  description: string;
  detail: string;
  targets: GuidedRealm[];
}> = [
  {
    eyebrow: "第一步 · 先追正片",
    title: "正道 · 官方正片",
    description: "按篇章找到每一集正片与下一话预告，最新内容也会同步到这里。",
    detail: "追番从这里开始。",
    targets: ["righteous"],
  },
  {
    eyebrow: "第二步 · 再看解析",
    title: "魔道 · 二创万象",
    description: "按剧集、UP 主、角色或类型继续追解析，也能只看尚未读过的内容。",
    detail: "想深挖剧情，就来听百家论道。",
    targets: ["demonic"],
  },
  {
    eyebrow: "第三步 · 今日追番",
    title: "天道盟 · 新鲜推荐",
    description: "今天新发现、值得一看的解析与二创视频，会优先放到这里。",
    detail: "不知道看什么时，就来这里寻宝。",
    targets: ["heaven"],
  },
  {
    eyebrow: "第四步 · 战火封境",
    title: "九国盟 · 尚未开放",
    description: "此地战火未歇，残图暂时无法通行。",
    detail: "待战火平息，再为道友开境。",
    targets: ["nine"],
  },
];

export default function AtlasOnboarding({
  step,
  onStepChange,
  onComplete,
  onSkip,
}: {
  step: number;
  onStepChange: (step: number) => void;
  onComplete: () => void;
  onSkip: () => void;
}) {
  const item = ONBOARDING_STEPS[step];
  const isLast = step === ONBOARDING_STEPS.length - 1;

  return (
    <div className="atlas-onboarding" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-shade" aria-hidden="true" />
      <section className="onboarding-card">
        <header>
          <span className="onboarding-seal" aria-hidden="true">{step + 1}</span>
          <div>
            <p>{item.eyebrow}</p>
            <h2 id="onboarding-title">{item.title}</h2>
          </div>
          <button type="button" onClick={onSkip}>跳过</button>
        </header>
        <p className="onboarding-description">{item.description}</p>
        <small>{item.detail}</small>
        <footer>
          <div className="onboarding-progress" aria-label={`共 ${ONBOARDING_STEPS.length} 步，当前第 ${step + 1} 步`}>
            {ONBOARDING_STEPS.map((_, index) => (
              <i className={index === step ? "active" : index < step ? "done" : ""} key={index} />
            ))}
          </div>
          <div>
            {step > 0 && <button type="button" onClick={() => onStepChange(step - 1)}>上一步</button>}
            <button className="primary" type="button" onClick={() => isLast ? onComplete() : onStepChange(step + 1)}>
              {isLast ? "开始巡图" : "下一步"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
