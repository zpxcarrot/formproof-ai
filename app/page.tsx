"use client";

/* eslint-disable @next/next/no-img-element -- Reference frames are local canvas data URLs, not network images. */

import { ChangeEvent, DragEvent, SyntheticEvent, useEffect, useMemo, useRef, useState } from "react";

type HistoryItem = {
  id: number;
  movement: string;
  muscleGroup: string;
  sessionDate: string;
  date: string;
  load: string;
  reps: string;
  rir: string;
  decision: string;
};

type VideoMeta = {
  duration: number;
  width: number;
  height: number;
  sizeMb: number;
};

type QualityChecks = {
  fullBody: boolean;
  stableCamera: boolean;
  completeSet: boolean;
  clearView: boolean;
};

type EvidenceFrame = {
  time: number;
  dataUrl: string;
};

const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
const MIN_VIDEO_SECONDS = 10;
const MAX_VIDEO_SECONDS = 60;
const emptyQualityChecks: QualityChecks = { fullBody: false, stableCamera: false, completeSet: false, clearView: false };

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

const movementMuscleGroup: Record<string, string> = {
  杠铃深蹲: "腿部",
  卧推: "胸部",
  传统硬拉: "后链",
  罗马尼亚硬拉: "后链",
  坐姿划船: "背部",
  高位下拉: "背部",
  肩推: "肩部",
  侧平举: "肩部",
};

const cameraGuidance: Record<string, { angle: string; reason: string }> = {
  杠铃深蹲: { angle: "正侧面或侧后方 30–45°", reason: "同时保留脚、膝、髋与躯干，便于复核深度和膝髋节奏。" },
  卧推: { angle: "侧前方 30–45°", reason: "让肩、肘、触胸点和脚部支撑同时入镜。" },
  传统硬拉: { angle: "正侧面或侧前方 30–45°", reason: "更容易看清杠铃与身体距离、髋位和背部线条。" },
  罗马尼亚硬拉: { angle: "正侧面或侧前方 30–45°", reason: "更容易复核髋部后移、膝部漂移和负重路径。" },
  坐姿划船: { angle: "侧前方 30–45°", reason: "保留躯干、肩胛与肘部路线，减少器械遮挡。" },
  高位下拉: { angle: "正前方或后侧前方", reason: "便于同时看到双侧肘部路线、躯干角度和肩部控制。" },
  肩推: { angle: "侧前方 30–45°", reason: "便于观察肋骨位置、前臂方向和推举路径。" },
  侧平举: { angle: "正前方或轻微侧前方", reason: "便于比较双侧路线、耸肩代偿和顶部控制。" },
};

function todayLabel() {
  return new Intl.DateTimeFormat("zh-CN", { month: "short", day: "numeric" }).format(new Date());
}

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDuration(seconds: number) {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60)}:${String(rounded % 60).padStart(2, "0")}`;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [videoMeta, setVideoMeta] = useState<VideoMeta | null>(null);
  const [fileError, setFileError] = useState("");
  const [qualityChecks, setQualityChecks] = useState<QualityChecks>(emptyQualityChecks);
  const [playhead, setPlayhead] = useState(0);
  const [repStart, setRepStart] = useState<number | null>(null);
  const [repEnd, setRepEnd] = useState<number | null>(null);
  const [evidenceFrames, setEvidenceFrames] = useState<EvidenceFrame[]>([]);
  const [capturingFrames, setCapturingFrames] = useState(false);
  const [frameError, setFrameError] = useState("");
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("formproof-history");
    let nextHistory: HistoryItem[] = [];
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as Partial<HistoryItem>[];
        const normalized = Array.isArray(parsed) ? parsed.filter((entry) => entry.movement && entry.id).map((entry) => {
          const fallbackDate = new Date(Number(entry.id));
          const safeDate = Number.isNaN(fallbackDate.getTime()) ? new Date() : fallbackDate;
          const movementName = String(entry.movement);
          return {
            id: Number(entry.id),
            movement: movementName,
            muscleGroup: entry.muscleGroup ?? movementMuscleGroup[movementName] ?? "其他",
            sessionDate: entry.sessionDate ?? localDateKey(safeDate),
            date: entry.date ?? todayLabel(),
            load: entry.load ?? "未记录",
            reps: entry.reps ?? "未记录",
            rir: entry.rir ?? "—",
            decision: entry.decision ?? "等待复盘",
          };
        }) : [];
        nextHistory = normalized.slice(0, 24);
      } catch {
        window.localStorage.removeItem("formproof-history");
      }
    }
    const frame = window.requestAnimationFrame(() => setHistory(nextHistory));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const previewUrl = useMemo(() => file ? URL.createObjectURL(file) : "", [file]);

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl); };
  }, [previewUrl]);

  const progression = useMemo(() => {
    if (pain) return { label: "停止当前动作", tone: "danger", copy: "先停止这项动作；若不适持续，请寻求合格的线下教练或医疗专业人员帮助。" };
    const value = Number(rir);
    if (value <= 1) return { label: "本次维持负重", tone: "amber", copy: `${load || "当前"}kg 先稳定完成 ${reps || "目标"} 次 × 4 组，最后一组没有明显失控再考虑加重。` };
    if (value <= 3) return { label: "满足条件后小幅加重", tone: "green", copy: `${load || "当前"}kg 完成 ${reps || "目标"} 次 × 4 组，动作质量稳定且无不适时，下一次仅增加最小重量档位。` };
    return { label: "可尝试小幅加重", tone: "green", copy: `先在 ${load || "当前"}kg 增加 1–2 次，或下一次增加最小重量档位；不要同时增加重量和组数。` };
  }, [pain, rir, load, reps]);

  const selectedMuscleGroup = movementMuscleGroup[movement];
  const groupSessionCount = useMemo(() => new Set(
    history.filter((entry) => entry.muscleGroup === selectedMuscleGroup).map((entry) => entry.sessionDate),
  ).size, [history, selectedMuscleGroup]);
  const growthGateCount = Math.min(groupSessionCount, 4);
  const growthUnlocked = groupSessionCount >= 4;
  const qualityPassed = Object.values(qualityChecks).every(Boolean);
  const repDuration = repStart !== null && repEnd !== null ? repEnd - repStart : 0;
  const repRangeValid = repStart !== null && repEnd !== null && repDuration >= 1 && repDuration <= 15;
  const evidenceReady = evidenceFrames.length === 4;
  const recordReady = Number(load) > 0 && Number(reps) > 0;
  const videoReady = !file || Boolean(videoMeta && !fileError && qualityPassed && repRangeValid && evidenceReady);
  const analysisDisabled = analyzing || !recordReady || !videoReady;

  function resetVideo() {
    setFile(null);
    setVideoMeta(null);
    setFileError("");
    setQualityChecks(emptyQualityChecks);
    setPlayhead(0);
    setRepStart(null);
    setRepEnd(null);
    setEvidenceFrames([]);
    setFrameError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function acceptFile(nextFile?: File) {
    if (!nextFile) return;
    const hasVideoType = nextFile.type.startsWith("video/");
    const hasVideoExtension = /\.(mp4|mov|webm|m4v)$/i.test(nextFile.name);
    if (!hasVideoType && !hasVideoExtension) {
      resetVideo();
      setFileError("请选择 MP4、MOV 或 WebM 视频文件。");
      return;
    }
    if (nextFile.size > MAX_VIDEO_BYTES) {
      resetVideo();
      setFileError("视频超过 200 MB，请剪取一组完整动作后重新选择。");
      return;
    }
    setFile(nextFile);
    setVideoMeta(null);
    setFileError("");
    setQualityChecks(emptyQualityChecks);
    setPlayhead(0);
    setRepStart(null);
    setRepEnd(null);
    setEvidenceFrames([]);
    setFrameError("");
    setShowReport(false);
  }

  function onVideoMetadata(event: SyntheticEvent<HTMLVideoElement>) {
    const video = event.currentTarget;
    const meta = {
      duration: video.duration,
      width: video.videoWidth,
      height: video.videoHeight,
      sizeMb: file ? file.size / 1024 / 1024 : 0,
    };
    setVideoMeta(meta);
    if (!Number.isFinite(video.duration)) {
      setFileError("无法读取视频信息，请换一个文件后重试。");
    } else if (video.duration < MIN_VIDEO_SECONDS || video.duration > MAX_VIDEO_SECONDS) {
      setFileError(`视频时长为 ${formatDuration(video.duration)}，请使用 10–60 秒的一组完整动作。`);
    } else {
      setFileError("");
    }
  }

  function updateQualityCheck(key: keyof QualityChecks, checked: boolean) {
    setQualityChecks((current) => ({ ...current, [key]: checked }));
  }

  function markRepBoundary(boundary: "start" | "end") {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.currentTime)) return;
    const time = Math.min(video.currentTime, Math.max(0, video.duration - 0.05));
    setEvidenceFrames([]);
    setFrameError("");
    if (boundary === "start") {
      setRepStart(time);
      if (repEnd !== null && repEnd <= time) setRepEnd(null);
      return;
    }
    setRepEnd(time);
    if (repStart === null) setFrameError("请先在一次重复动作开始时标记起点。");
    else if (time - repStart < 1 || time - repStart > 15) setFrameError("单次动作区间需为 1–15 秒，请重新标记终点。");
  }

  function seekVideo(video: HTMLVideoElement, time: number) {
    return new Promise<void>((resolve, reject) => {
      if (Math.abs(video.currentTime - time) < 0.02) {
        resolve();
        return;
      }
      const timeout = window.setTimeout(() => {
        video.removeEventListener("seeked", onSeeked);
        reject(new Error("视频定位超时"));
      }, 4000);
      function onSeeked() {
        window.clearTimeout(timeout);
        resolve();
      }
      video.addEventListener("seeked", onSeeked, { once: true });
      video.currentTime = time;
    });
  }

  async function captureEvidenceFrames() {
    const video = videoRef.current;
    if (!video || !videoMeta || repStart === null || repEnd === null || !repRangeValid) {
      setFrameError("请先标记 1–15 秒内的一次完整重复动作。");
      return;
    }
    setCapturingFrames(true);
    setFrameError("");
    const originalTime = video.currentTime;
    const interval = repEnd - repStart;
    const times = [repStart, repStart + interval / 3, repStart + interval * 2 / 3, repEnd];
    try {
      const frames: EvidenceFrame[] = [];
      for (const time of times) {
        await seekVideo(video, Math.min(time, Math.max(0, video.duration - 0.05)));
        const scale = Math.min(1, 720 / video.videoWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
        canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("浏览器无法创建画面样本");
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        frames.push({ time, dataUrl: canvas.toDataURL("image/jpeg", 0.82) });
      }
      setEvidenceFrames(frames);
      await seekVideo(video, originalTime);
    } catch {
      setEvidenceFrames([]);
      setFrameError("无法从这个视频生成参考帧，请换用 MP4、MOV 或 WebM 后重试。");
    } finally {
      setCapturingFrames(false);
    }
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
    resetVideo();
    setMovement("杠铃深蹲");
    setLoad("60");
    setReps("8");
    setRir("2");
    setAngle("侧前方 45°");
    setPain(false);
    setShowReport(false);
    document.getElementById("analysis")?.scrollIntoView({ behavior: "smooth" });
  }

  function clearLocalHistory() {
    if (!window.confirm("删除这台设备上的全部训练摘要？视频从未保存，不受影响。")) return;
    window.localStorage.removeItem("formproof-history");
    setHistory([]);
  }

  function runDemoAnalysis() {
    if (analysisDisabled) return;
    setAnalyzing(true);
    setShowReport(false);
    window.setTimeout(() => {
      const item: HistoryItem = {
        id: Date.now(),
        movement,
        muscleGroup: selectedMuscleGroup,
        sessionDate: localDateKey(),
        date: todayLabel(),
        load: load || "未记录",
        reps: reps || "未记录",
        rir,
        decision: progression.label,
      };
      const next = [item, ...history].slice(0, 24);
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
              <input ref={fileInputRef} type="file" accept="video/mp4,video/quicktime,video/webm,.m4v" onChange={onFileChange} />
              {previewUrl ? (
                // Training clips are expected to contain no speech; controls remain available for any original audio.
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video ref={videoRef} src={previewUrl} controls playsInline onLoadedMetadata={onVideoMetadata} onTimeUpdate={(event) => setPlayhead(event.currentTarget.currentTime)} aria-label="已选择的视频预览" />
              ) : (
                <div className="drop-copy">
                  <div className="upload-icon" aria-hidden="true"><span>↑</span></div>
                  <strong>{file ? file.name : "拖入训练视频"}</strong>
                  <p>或点击选择 MP4、MOV、WebM</p>
                  <small>建议拍摄完整身体与器械轨迹</small>
                </div>
              )}
            </label>
            {fileError && <div className="file-error" role="alert"><b>视频暂不可用</b><span>{fileError}</span></div>}
            {file && videoMeta && (
              <div className="video-meta" aria-label="视频信息">
                <span><small>时长</small><b>{formatDuration(videoMeta.duration)}</b></span>
                <span><small>画面</small><b>{videoMeta.width} × {videoMeta.height}</b></span>
                <span><small>方向</small><b>{videoMeta.height > videoMeta.width ? "竖屏" : "横屏"}</b></span>
                <span><small>大小</small><b>{videoMeta.sizeMb.toFixed(1)} MB</b></span>
                <button type="button" onClick={resetVideo}>移除</button>
              </div>
            )}
            {file && !fileError && videoMeta && (
              <>
                <fieldset className="quality-gate">
                  <legend>提交前确认拍摄质量</legend>
                  <label><input type="checkbox" checked={qualityChecks.fullBody} onChange={(event) => updateQualityCheck("fullBody", event.target.checked)} /><span>全身与器械轨迹完整入镜</span></label>
                  <label><input type="checkbox" checked={qualityChecks.stableCamera} onChange={(event) => updateQualityCheck("stableCamera", event.target.checked)} /><span>镜头固定，没有跟随缩放</span></label>
                  <label><input type="checkbox" checked={qualityChecks.completeSet} onChange={(event) => updateQualityCheck("completeSet", event.target.checked)} /><span>包含一组完整工作组</span></label>
                  <label><input type="checkbox" checked={qualityChecks.clearView} onChange={(event) => updateQualityCheck("clearView", event.target.checked)} /><span>关键关节无遮挡、无旁人重叠</span></label>
                </fieldset>
                <div className={`rep-selector ${qualityPassed ? "active" : "locked"}`}>
                  <div className="rep-selector-head"><span>本地证据准备</span><b>当前 {formatDuration(playhead)}</b></div>
                  <h3>选择一段完整重复动作</h3>
                  <p>播放视频，在同一次重复动作的开始和结束位置分别标记。系统只生成区间样本，不判断动作阶段。</p>
                  <div className="rep-actions">
                    <button type="button" onClick={() => markRepBoundary("start")} disabled={!qualityPassed}>标记起点</button>
                    <button type="button" onClick={() => markRepBoundary("end")} disabled={!qualityPassed}>标记终点</button>
                    <button className="capture-button" type="button" onClick={captureEvidenceFrames} disabled={!qualityPassed || !repRangeValid || capturingFrames}>{capturingFrames ? "正在生成…" : evidenceReady ? "重新生成 4 张" : "生成 4 张参考帧"}</button>
                  </div>
                  <div className="rep-range"><span>起点 <b>{repStart === null ? "未标记" : formatDuration(repStart)}</b></span><span>终点 <b>{repEnd === null ? "未标记" : formatDuration(repEnd)}</b></span><span>区间 <b>{repRangeValid ? `${repDuration.toFixed(1)} 秒` : "需 1–15 秒"}</b></span></div>
                  {frameError && <div className="frame-error" role="alert">{frameError}</div>}
                  {evidenceReady && <div className="frame-strip" aria-label="用户选定区间参考帧">{evidenceFrames.map((frame, index) => <figure key={`${frame.time}-${index}`}><img src={frame.dataUrl} alt={`用户选定区间样本 ${index + 1}`} /><figcaption>样本 {index + 1} · {formatDuration(frame.time)}</figcaption></figure>)}</div>}
                </div>
              </>
            )}
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
              <div className="field"><label htmlFor="load">重量 <span>kg</span></label><input id="load" type="number" min="0.5" step="0.5" inputMode="decimal" value={load} onChange={(event) => setLoad(event.target.value)} /></div>
              <div className="field"><label htmlFor="reps">次数</label><input id="reps" type="number" min="1" max="100" inputMode="numeric" value={reps} onChange={(event) => setReps(event.target.value)} /></div>
              <div className="field"><label htmlFor="rir">剩余次数 <span>RIR</span></label><select id="rir" value={rir} onChange={(event) => setRir(event.target.value)}><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option><option value="4">4+</option></select></div>
            </div>
            <div className="field full"><label htmlFor="angle">拍摄角度</label><select id="angle" value={angle} onChange={(event) => setAngle(event.target.value)}><option>侧前方 45°</option><option>正侧面</option><option>正前方</option><option>正后方</option><option>不确定</option></select><p className="camera-tip"><b>{movement} 推荐：{cameraGuidance[movement].angle}</b><span>{cameraGuidance[movement].reason}</span></p></div>
            <label className={`pain-check ${pain ? "checked" : ""}`}>
              <input type="checkbox" checked={pain} onChange={(event) => setPain(event.target.checked)} />
              <span className="checkbox">{pain ? "✓" : ""}</span>
              <span><b>动作过程中有疼痛或明显不适</b><small>开启后，安全建议优先于进阶建议</small></span>
            </label>
            <div className={`readiness-card ${file ? (videoReady ? "ready" : "waiting") : "demo"}`} aria-live="polite">
              <span aria-hidden="true">{file ? (videoReady ? "✓" : "!") : "D"}</span>
              <div>
                <b>{file ? (videoReady ? "视频与参考帧已准备完成" : "请完成拍摄检查、区间标记与参考帧生成") : "当前为无视频演示模式"}</b>
                <small>{file ? "这里只确认文件、拍摄条件和用户选定的区间样本；动作技术仍未经过真实视觉模型复核。" : "可以体验记录规则与报告结构，不会生成视频技术结论。"}</small>
              </div>
            </div>
            {!recordReady && <p className="form-error" role="alert">请填写大于 0 的重量和次数。</p>}
            <button className="analyze-button" onClick={runDemoAnalysis} disabled={analysisDisabled}>
              {analyzing ? <><i className="spinner" /> 正在整理训练证据…</> : <>生成演示报告 <span>→</span></>}
            </button>
            <p className="demo-disclaimer">报告只使用你填写的训练记录和拍摄信息；当前不会生成关节角度、速度、次数识别或动作纠错结论。</p>
          </div>
        </div>
      </section>

      {showReport && (
        <section className="report-section" ref={reportRef} aria-live="polite">
          <div className="report-topline">
            <div><div className="section-kicker">演示分析报告</div><h2>{movement} · {load || "—"}kg × {reps || "—"}</h2></div>
            <div className="report-actions"><button type="button" onClick={() => window.print()}>打印 / 保存 PDF</button><div className="report-stamp"><small>报告状态</small><strong>DEMO / 非真实识别</strong></div></div>
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
            <span><small>实际观察动作</small><b>尚未进行视觉复核</b></span>
            <span><small>身份匹配</small><b>无法判断</b></span>
            <span><small>整体证据置信度</small><b>低 · 演示模式</b></span>
          </div>
          <div className="report-source">
            <b>本报告依据：</b>
            <span>用户填写的重量、次数、RIR 与疼痛信息</span>
            <span>{file && videoMeta ? `文件元数据（${formatDuration(videoMeta.duration)}，${videoMeta.width} × ${videoMeta.height}）` : "未选择视频"}</span>
            <em>不包含视频动作技术判断</em>
          </div>

          {evidenceReady && (
            <div className="frame-report">
              <div className="frame-report-head"><div><small>本地生成 · 未上传</small><h3>用户选定区间参考帧</h3></div><span>{formatDuration(repStart ?? 0)}–{formatDuration(repEnd ?? 0)}</span></div>
              <div className="report-frame-grid">{evidenceFrames.map((frame, index) => <figure key={`report-${frame.time}-${index}`}><img src={frame.dataUrl} alt={`用户选定区间参考样本 ${index + 1}`} /><figcaption><b>样本 {index + 1}</b><span>{formatDuration(frame.time)}</span></figcaption></figure>)}</div>
              <p>这些画面按用户选定区间等距抽取，只用于组织后续复核；它们不代表 AI 已识别起始、下降、底部或返回阶段，也不构成动作技术结论。</p>
            </div>
          )}

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
              <p><b>行动：</b>{evidenceReady ? "已生成同一次用户选定区间的四张参考样本；仍需真实模型或教练完成动作身份与阶段复核。" : "完成逐帧复核后，从同一次完整重复动作中选择可辩护的关键画面再作判断。"}</p>
            </article>
            <article>
              <div className="evidence-head"><span className={`confidence ${file && videoMeta ? "high" : "low"}`}>{file && videoMeta ? "高" : "低"}</span><div><small>拍摄信息 · {file && videoMeta ? "文件可读" : "未提供视频"}</small><h3>下次拍摄建议</h3></div></div>
              <p><b>当前记录：</b>{angle}。</p>
              <p><b>意义：</b>{file && videoMeta ? `已确认文件为 ${videoMeta.height > videoMeta.width ? "竖屏" : "横屏"}、${formatDuration(videoMeta.duration)}；画面是否支持动作判断仍需真实复核。` : "没有视频证据，因此不能评价画面可用性或动作技术。"}</p>
              <p><b>行动：</b>优先使用{cameraGuidance[movement].angle}；{cameraGuidance[movement].reason}固定手机、保留动作前后各 1 秒，不要跟随移动镜头。</p>
            </article>
          </div>

          <div className="report-footer-note"><span>!</span><p><b>专业边界：</b>力证 AI 提供训练复盘，不提供医疗诊断。疼痛、受伤或明显失控时应停止动作，并寻求合格的线下帮助。</p></div>
        </section>
      )}

      <section className="history-section">
        <div className="history-heading">
          <div><div className="section-kicker">本机训练记录</div><h2>让下一次建议接得上这一次</h2></div>
          <div className="history-actions"><span>{selectedMuscleGroup} · {growthGateCount}/4 个训练日</span>{history.length > 0 && <button type="button" onClick={clearLocalHistory}>删除本机记录</button>}</div>
        </div>
        <div className="history-grid">
          {history.length ? history.slice(0, 3).map((item) => (
            <article key={item.id}><small>{item.date} · {item.muscleGroup}</small><h3>{item.movement}</h3><div><span>{item.load}kg × {item.reps} · RIR {item.rir}</span><b>{item.decision}</b></div></article>
          )) : (
            <div className="empty-history"><span>＋</span><p>完成第一份演示报告后，训练摘要会仅保存在这台设备上。</p></div>
          )}
          <div className="growth-gate" data-growth-state={growthUnlocked ? "unlocked" : "locked"} data-growth-session-count={groupSessionCount} data-growth-trigger-count="4">
            <small>{selectedMuscleGroup}训练趋势</small>
            <strong>{growthUnlocked ? "已解锁" : `${growthGateCount}/4`}</strong>
            <p>{growthUnlocked ? "已完成 4 个不同训练日，可开始比较可比动作与训练记录；这仍不等于测得肌肉增长。" : `同一用户、同一肌群在 4 个不同日期完成训练后才解锁，当前 ${growthGateCount}/4。`}</p>
          </div>
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
