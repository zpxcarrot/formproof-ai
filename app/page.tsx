"use client";

import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from "react";

type HistoryItem = {
  id: number;
  movement: string;
  date: string;
  load: string;
  reps: string;
  decision: string;
};

const movements = ["杠铃深蹲", "卧推", "传统硬拉", "罗马尼亚硬拉", "坐姿划船", "高位下拉", "肩推", "侧平举"];

const movementFocus: Record<string, string> = {
  杠铃深蹲: "膝髋节奏、躯干稳定、足底压力与深度控制",
  卧推: "肩胛设置、触胸点、肘部路径与脚部驱动",
  传统硬拉: "髋铰链、背部线条、杠铃距离与离地控制",
  罗马尼亚硬拉: "髋部后移、膝部漂移、负重路径与底部控制",
  坐姿划船: "躯干支撑、肘部路线、肩胛控制与借力幅度",
  高位下拉: "肩部下沉、肘部路径、躯干角度与末端控制",
  肩推: "肋骨位置、前臂垂直度、推举路径与锁定控制",
  侧平举: "目标肌肉路线、耸肩代偿、顶部控制与离心节奏",
};

function todayLabel() {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date());
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [movement, setMovement] = useState("杠铃深蹲");
  const [load, setLoad] = useState("60");
  const [reps, setReps] = useState("8");
  const [rir, setRir] = useState("2");
  const [angle, setAngle] = useState("侧前方 45°");
  const [pain, setPain] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("formproof-history");
    if (stored) {
      try {
        setHistory(JSON.parse(stored));
      } catch {
        window.localStorage.removeItem("formproof-history");
      }
    }
  }, []);

  useEffect(() => {
    if (!file) {
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const progression = useMemo(() => {
    if (pain) return { label: "停止当前动作", tone: "danger", copy: "先停止这项动作；若不适持续，请寻求合格的线下教练或医疗专业人员帮助。" };
    const value = Number(rir);
    if (value <= 1) return { label: "本次维持负重", tone: "amber", copy: `${load || "当前"}kg 先稳定完成 ${reps || "目标"} 次 × 4 组，最后一组没有明显失控再考虑加重。` };
    if (value <= 3) return { label: "满足条件后小幅加重", tone: "green", copy: `${load || "当前"}kg 完成 ${reps || "目标"} 次 × 4 组，动作质量稳定且无不适时，下一次仅增加最小重量档位。` };
    return { label: "可尝试小幅加重", tone: "green", copy: `先在 ${load || "当前"}kg 增加 1–2 次，或下一次增加最小重量档位；不要同时增加重量和组数。` };
  }, [pain, rir, load, reps]);

  function acceptFile(nextFile?: File) {
    if (!nextFile || !nextFile.type.startsWith("video/")) return;
    setFile(nextFile);
    setShowReport(false);
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    acceptFile(event.target.files?.[0]);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setIsDragging(false);
    acceptFile(event.dataTransfer.files?.[0]);
  }

  function loadDemo() {
    setFile(null);
    setMovement("杠铃深蹲");
    setLoad("60");
    setReps("8");
    setRir("2");
    setAngle("侧前方 45°");
    setPain(false);
    setShowReport(false);
    document.getElementById("analysis")?.scrollIntoView({ behavior: "smooth" });
  }

  function runDemoAnalysis() {
    setAnalyzing(true);
    setShowReport(false);
    window.setTimeout(() => {
      const item: HistoryItem = {
        id: Date.now(),
        movement,
        date: todayLabel(),
        load: load || "未记录",
        reps: reps || "未记录",
        decision: progression.label,
      };
      const next = [item, ...history.filter((entry) => entry.movement !== movement)].slice(0, 4);
      setHistory(next);
      window.localStorage.setItem("formproof-history", JSON.stringify(next));
      setAnalyzing(false);
      setShowReport(true);
      window.setTimeout(() => reportRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    }, 1400);
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="力证 AI 首页">
          <span className="brand-mark" aria-hidden="true">力</span>
          <span>力证 <b>AI</b></span>
        </a>
        <nav aria-label="主导航">
          <a href="#workflow">工作方式</a>
          <a href="#safety">安全边界</a>
          <a className="nav-cta" href="#analysis">开始分析</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="eyebrow"><span /> 训练视频复盘 · MVP 预览版</div>
          <h1>每一次训练，<br />都应该有<span>证据</span>可循。</h1>
          <p className="hero-lede">上传一段训练视频，获得具体、克制、可执行的动作建议。看见问题，也知道下一组该怎么做。</p>
          <div className="hero-actions">
            <a className="primary-button" href="#analysis">分析我的视频 <span>↗</span></a>
            <button className="text-button" onClick={loadDemo}>查看演示案例 <span>→</span></button>
          </div>
          <div className="trust-row" aria-label="产品原则">
            <span><i>01</i> 证据分级</span>
            <span><i>02</i> 不猜测数据</span>
            <span><i>03</i> 隐私优先</span>
          </div>
        </div>

        <div className="hero-visual" aria-label="训练分析报告预览">
          <div className="visual-noise" />
          <div className="analysis-tag">FORM / 001</div>
          <div className="silhouette" aria-hidden="true">
            <span className="head" />
            <span className="torso" />
            <span className="arm arm-left" />
            <span className="arm arm-right" />
            <span className="leg leg-left" />
            <span className="leg leg-right" />
            <span className="joint joint-shoulder" />
            <span className="joint joint-hip" />
            <span className="joint joint-knee" />
          </div>
          <div className="measure-line line-one"><span>躯干稳定</span><b /></div>
          <div className="measure-line line-two"><b /><span>膝髋节奏</span></div>
          <div className="preview-score">
            <small>本组建议</small>
            <strong>维持 60kg</strong>
            <p>先把 8 次 × 4 组做稳</p>
          </div>
          <div className="frame-count">04 / 04</div>
        </div>
      </section>

      <section className="principles" id="workflow">
        <div className="section-kicker">不是一句“动作不标准”</div>
        <div className="principle-grid">
          <article><span>01</span><h2>看到什么</h2><p>只描述视频中能够直接确认的动作证据。</p></article>
          <article><span>02</span><h2>为什么重要</h2><p>连接训练目标、刺激质量、疲劳与安全风险。</p></article>
          <article><span>03</span><h2>下一组怎么做</h2><p>给出一个优先动作和明确的进阶条件。</p></article>
        </div>
      </section>

      <section className="analysis-section" id="analysis">
        <div className="analysis-heading">
          <div>
            <div className="section-kicker light">开始一次复盘</div>
            <h2>把训练片段交给教练视角</h2>
          </div>
          <p>当前为交互式演示引擎，展示完整产品流程；尚未连接真实视觉模型，也不会上传你的文件。</p>
        </div>

        <div className="analysis-grid">
          <div className="upload-panel">
            <div className="step-label"><b>1</b><span>上传视频</span><em>10–60 秒</em></div>
            <label
              className={`dropzone ${isDragging ? "dragging" : ""} ${file ? "has-file" : ""}`}
              onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={onDrop}
            >
              <input type="file" accept="video/*" onChange={onFileChange} />
              {previewUrl ? (
                <video src={previewUrl} controls playsInline aria-label="已选择的视频预览" />
              ) : (
                <div className="drop-copy">
                  <div className="upload-icon" aria-hidden="true"><span>↑</span></div>
                  <strong>{file ? file.name : "拖入训练视频"}</strong>
                  <p>或点击选择 MP4、MOV、WebM</p>
                  <small>建议拍摄完整身体与器械轨迹</small>
                </div>
              )}
            </label>
            <div className="privacy-note"><span>◉</span><p><b>本地预览</b> — 当前版本不会上传或永久保存视频。</p></div>
          </div>

          <div className="form-panel">
            <div className="step-label"><b>2</b><span>补充训练记录</span><em>不让 AI 猜</em></div>
            <div className="field full">
              <label htmlFor="movement">训练动作</label>
              <select id="movement" value={movement} onChange={(event) => setMovement(event.target.value)}>
                {movements.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <div className="field-row">
              <div className="field"><label htmlFor="load">重量 <span>kg</span></label><input id="load" inputMode="decimal" value={load} onChange={(event) => setLoad(event.target.value)} /></div>
              <div className="field"><label htmlFor="reps">次数</label><input id="reps" inputMode="numeric" value={reps} onChange={(event) => setReps(event.target.value)} /></div>
              <div className="field"><label htmlFor="rir">剩余次数 <span>RIR</span></label><select id="rir" value={rir} onChange={(event) => setRir(event.target.value)}><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4+</option></select></div>
            </div>
            <div className="field full"><label htmlFor="angle">拍摄角度</label><select id="angle" value={angle} onChange={(event) => setAngle(event.target.value)}><option>侧前方 45°</option><option>正侧面</option><option>正前方</option><option>正后方</option><option>不确定</option></select></div>
            <label className={`pain-check ${pain ? "checked" : ""}`}>
              <input type="checkbox" checked={pain} onChange={(event) => setPain(event.target.checked)} />
              <span className="checkbox">{pain ? "✓" : ""}</span>
              <span><b>动作过程中有疼痛或明显不适</b><small>开启后，安全建议优先于进阶建议</small></span>
            </label>
            <button className="analyze-button" onClick={runDemoAnalysis} disabled={analyzing}>
              {analyzing ? <><i className="spinner" /> 正在整理训练证据…</> : <>生成演示报告 <span>→</span></>}
            </button>
            <p className="demo-disclaimer">未选择视频也可体验。报告内容用于演示产品结构，不代表已分析你的动作。</p>
          </div>
        </div>
      </section>

      {showReport && (
        <section className="report-section" ref={reportRef} aria-live="polite">
          <div className="report-topline">
            <div><div className="section-kicker">演示分析报告</div><h2>{movement} · {load || "—"}kg × {reps || "—"}</h2></div>
            <div className="report-stamp"><small>报告状态</small><strong>DEMO / 非真实识别</strong></div>
          </div>

          <div className="report-summary">
            <div className={`decision-card ${progression.tone}`}>
              <small>下次训练主建议</small>
              <h3>{progression.label}</h3>
              <p>{progression.copy}</p>
            </div>
            <div className="record-card"><small>你的训练记录</small><div><span>{load || "—"}<i>kg</i></span><span>{reps || "—"}<i>次</i></span><span>{rir}<i>RIR</i></span></div><p>这些数字来自你的填写，不是视频推测。</p></div>
          </div>

          <div className="identity-bar">
            <span><small>用户填写动作</small><b>{movement}</b></span>
            <span><small>实际观察动作</small><b>未进行视频复核</b></span>
            <span><small>身份匹配</small><b>无法判断</b></span>
            <span><small>整体证据置信度</small><b>低 · 演示模式</b></span>
          </div>

          <div className="evidence-grid">
            <article>
              <div className="evidence-head"><span className="confidence medium">中</span><div><small>用户记录 · 可直接使用</small><h3>训练强度判断</h3></div></div>
              <p><b>观察：</b>记录为 RIR {rir}{pain ? "，且报告了疼痛或不适" : ""}。</p>
              <p><b>意义：</b>{pain ? "疼痛信号优先于负重与训练量目标。" : "余力记录可帮助决定维持、加重或调整训练量。"}</p>
              <p><b>行动：</b>{progression.copy}</p>
            </article>
            <article>
              <div className="evidence-head"><span className="confidence low">低</span><div><small>视频证据 · 当前不可判断</small><h3>动作质量检查</h3></div></div>
              <p><b>检查重点：</b>{movementFocus[movement]}。</p>
              <p><b>限制：</b>当前演示没有实际复核视频，因此不评价关节角度、速度或左右差异。</p>
              <p><b>行动：</b>完成逐帧复核后，从同一次完整重复动作中选择四阶段画面再作判断。</p>
            </article>
            <article>
              <div className="evidence-head"><span className="confidence high">高</span><div><small>拍摄信息 · 直接证据</small><h3>下次拍摄建议</h3></div></div>
              <p><b>当前记录：</b>{angle}。</p>
              <p><b>意义：</b>能否同时看清主要关节、负重路径和支撑点，决定报告可信度。</p>
              <p><b>行动：</b>固定手机、拍全身与器械，并保留动作前后各 1 秒，不要跟随移动镜头。</p>
            </article>
          </div>

          <div className="report-footer-note"><span>!</span><p><b>专业边界：</b>力证 AI 提供训练复盘，不提供医疗诊断。疼痛、受伤或明显失控时应停止动作，并寻求合格的线下帮助。</p></div>
        </section>
      )}

      <section className="history-section">
        <div className="history-heading"><div><div className="section-kicker">本机训练记录</div><h2>让下一次建议接得上这一次</h2></div><span>{history.length}/4 次记录</span></div>
        <div className="history-grid">
          {history.length ? history.map((item) => (
            <article key={item.id}><small>{item.date}</small><h3>{item.movement}</h3><div><span>{item.load}kg × {item.reps}</span><b>{item.decision}</b></div></article>
          )) : (
            <div className="empty-history"><span>＋</span><p>完成第一份演示报告后，训练摘要会仅保存在这台设备上。</p></div>
          )}
          <div className="growth-gate"><small>趋势解锁规则</small><strong>{history.length}/4</strong><p>同一动作完成 4 次记录后，才开始讨论稳定趋势；不会用一次训练推断肌肉增长。</p></div>
        </div>
      </section>

      <section className="safety-section" id="safety">
        <div className="safety-copy"><div className="section-kicker light">我们刻意不做什么</div><h2>专业，不等于<br />假装什么都知道。</h2></div>
        <div className="boundaries">
          <div><b>×</b><span><strong>不猜重量与疼痛</strong><p>这些由训练者本人记录。</p></span></div>
          <div><b>×</b><span><strong>不把模糊画面说成精确角度</strong><p>证据不足就明确标注无法判断。</p></span></div>
          <div><b>×</b><span><strong>不提供医疗诊断</strong><p>疼痛与受伤交给合格的线下专业人员。</p></span></div>
          <div><b>×</b><span><strong>不公开用户视频</strong><p>公开示例只使用合成或明确授权素材。</p></span></div>
        </div>
      </section>

      <footer>
        <div className="brand footer-brand"><span className="brand-mark">力</span><span>力证 <b>AI</b></span></div>
        <p>用证据复盘训练，用条件决定进阶。</p>
        <div><a href="#analysis">体验演示</a><a href="#safety">安全边界</a><span>Experimental · 2026</span></div>
      </footer>
    </main>
  );
}
