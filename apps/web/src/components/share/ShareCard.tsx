'use client';

/**
 * „Сподели резултата“: рисува картинка за story (1080×1920) с аватара, резултата и логото и я подава към
 * менюто за споделяне на телефона (Instagram, TikTok, Facebook, Viber…). На компютър — изтегляне.
 * Първото споделяне носи диаманти (веднъж на профил).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Download, Share2, X } from 'lucide-react';
import { sanitizeAvatar } from '@belmaster/shared';
import { avatarSvg } from '@/components/avatar/UserAvatar';
import { claimShareRewardAction, shareInfoAction } from '@/app/actions/share';
import { play } from '@/lib/sound';
import './share.css';

export interface ShareData {
  /** над резултата, напр. „Кула на Словото“ */
  kicker: string;
  /** големият резултат, напр. „85%“ или „12“ */
  value: string;
  /** под резултата, напр. „9 от 10 верни“ */
  line: string;
  /** цвят на акцента */
  color?: string;
}

const W = 1080, H = 1920;
const SITE = 'belmaster.eu';

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((res, rej) => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = rej;
    img.src = src;
  });
}
function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}
/** текст, свит така, че да се побере в ширината */
function fit(c: CanvasRenderingContext2D, text: string, font: (px: number) => string, max: number, px: number) {
  let size = px;
  c.font = font(size);
  while (c.measureText(text).width > max && size > 24) c.font = font((size -= 6));
  return size;
}

async function draw(canvas: HTMLCanvasElement, d: ShareData, who: { id: string; name: string; avatar: unknown }) {
  const c = canvas.getContext('2d')!;
  const color = d.color ?? '#6ea2ff';
  const DISPLAY = (px: number) => `900 ${px}px "Unbounded Variable", "Unbounded", system-ui, sans-serif`;
  const TEXT = (px: number, w = 800) => `${w} ${px}px "Nunito Variable", "Nunito", system-ui, sans-serif`;
  await Promise.all([document.fonts.load(DISPLAY(100), 'БЕЛ 12'), document.fonts.load(TEXT(50), 'абв')]).catch(() => {});

  // фон
  const bg = c.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0f1a52');
  bg.addColorStop(0.55, '#080d2c');
  bg.addColorStop(1, '#04061a');
  c.fillStyle = bg;
  c.fillRect(0, 0, W, H);
  // лъчи зад аватара
  c.save();
  c.translate(W / 2, 640);
  for (let i = 0; i < 18; i++) {
    c.rotate((Math.PI * 2) / 18);
    const g = c.createLinearGradient(0, 0, 0, -1300);
    g.addColorStop(0, color + '55');
    g.addColorStop(1, color + '00');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, 0);
    c.lineTo(-90, -1300);
    c.lineTo(90, -1300);
    c.closePath();
    c.fill();
  }
  c.restore();
  const glow = c.createRadialGradient(W / 2, 640, 0, W / 2, 640, 620);
  glow.addColorStop(0, color + '66');
  glow.addColorStop(1, color + '00');
  c.fillStyle = glow;
  c.fillRect(0, 0, W, H);
  // конфети
  for (let i = 0; i < 46; i++) {
    const r = (n: number) => {
      const v = Math.sin(i * 91.7 + n * 17.3) * 43758.5453;
      return v - Math.floor(v);
    };
    c.save();
    c.translate(r(1) * W, 180 + r(2) * 1500);
    c.rotate(r(3) * 6);
    c.globalAlpha = 0.35 + r(4) * 0.5;
    c.fillStyle = ['#ffd166', '#5fe0d0', '#ff7a8a', '#c59bff', '#ffffff'][i % 5];
    rr(c, -14, -7, 28, 14, 4);
    c.fill();
    c.restore();
  }

  // лого
  c.textAlign = 'left';
  c.textBaseline = 'middle';
  c.font = DISPLAY(58);
  const w1 = c.measureText('БЕЛ ').width, w2 = c.measureText('МАСТЪР').width;
  const lx = (W - (96 + 26 + w1 + w2)) / 2;
  const lg = c.createLinearGradient(lx, 110, lx + 96, 206);
  lg.addColorStop(0, '#6ea2ff');
  lg.addColorStop(1, '#2f5fe0');
  c.fillStyle = lg;
  rr(c, lx, 110, 96, 96, 22);
  c.fill();
  c.fillStyle = '#fff';
  c.font = DISPLAY(56);
  c.textAlign = 'center';
  c.fillText('Б', lx + 48, 162);
  c.textAlign = 'left';
  c.font = DISPLAY(58);
  c.fillText('БЕЛ ', lx + 122, 160);
  c.fillStyle = '#8fb8ff';
  c.fillText('МАСТЪР', lx + 122 + w1, 160);

  // аватар
  const cfg = sanitizeAvatar(who.avatar, null, who.id);
  const svg = avatarSvg(cfg).replace('<svg ', '<svg width="460" height="460" ');
  const AX = W / 2 - 230, AY = 410;
  c.fillStyle = color;
  rr(c, AX - 14, AY - 14, 488, 488, 116);
  c.fill();
  try {
    const img = await loadImage(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`);
    c.save();
    rr(c, AX, AY, 460, 460, 104);
    c.clip();
    c.drawImage(img, AX, AY, 460, 460);
    c.restore();
  } catch {
    /* без аватар — остава цветната рамка */
  }
  c.textAlign = 'center';
  c.fillStyle = '#fff';
  fit(c, who.name, (px) => TEXT(px, 900), 900, 64);
  c.fillText(who.name, W / 2, 960);

  // резултат
  c.fillStyle = color;
  c.font = TEXT(40, 900);
  c.fillText(d.kicker.toUpperCase().split('').join(' '), W / 2, 1090);
  const size = fit(c, d.value, DISPLAY, 940, 330);
  const vg = c.createLinearGradient(0, 1290 - size / 2, 0, 1290 + size / 2);
  vg.addColorStop(0, '#ffffff');
  vg.addColorStop(1, color);
  c.fillStyle = vg;
  c.shadowColor = color + 'aa';
  c.shadowBlur = 60;
  c.fillText(d.value, W / 2, 1290);
  c.shadowBlur = 0;
  c.fillStyle = 'rgba(255,255,255,.9)';
  fit(c, d.line, (px) => TEXT(px, 800), 940, 58);
  c.fillText(d.line, W / 2, 1490);

  // покана
  c.fillStyle = '#fff';
  c.font = DISPLAY(54);
  c.fillText('Можеш ли повече?', W / 2, 1660);
  c.font = TEXT(46, 900);
  const sw = c.measureText(SITE).width + 110;
  const pg = c.createLinearGradient(0, 1730, 0, 1830);
  pg.addColorStop(0, '#6ea2ff');
  pg.addColorStop(1, '#2f5fe0');
  c.fillStyle = pg;
  rr(c, (W - sw) / 2, 1730, sw, 100, 50);
  c.fill();
  c.fillStyle = '#fff';
  c.fillText(SITE, W / 2, 1782);
}

export function ShareButton({ data, className, label = 'Сподели резултата' }: { data: ShareData; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={className ?? 'shr-open'}>
        <Share2 className="size-4" /> {label}
      </button>
      {open && <ShareDialog data={data} onClose={() => setOpen(false)} />}
    </>
  );
}

function ShareDialog({ data, onClose }: { data: ShareData; onClose: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [ready, setReady] = useState(false);
  const [reward, setReward] = useState(0);
  const [got, setGot] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const canShareFiles = useRef(false);

  useEffect(() => {
    let alive = true;
    shareInfoAction().then(async (who) => {
      if (!alive || !who || !canvas.current) return;
      setReward(who.reward);
      await draw(canvas.current, data, who);
      if (alive) setReady(true);
    });
    try {
      canShareFiles.current = !!navigator.canShare?.({ files: [new File([''], 'a.png', { type: 'image/png' })] });
    } catch {
      canShareFiles.current = false;
    }
    return () => {
      alive = false;
    };
  }, [data]);

  const claim = useCallback(async () => {
    if (!reward || got) return;
    const n = await claimShareRewardAction();
    if (n) {
      setGot(n);
      play('unlock');
    }
  }, [reward, got]);

  const blob = () => new Promise<Blob | null>((res) => canvas.current!.toBlob(res, 'image/png'));
  const download = async () => {
    const b = await blob();
    if (!b) return;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b);
    a.download = 'belmaster-rezultat.png';
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };
  const share = async () => {
    const b = await blob();
    if (!b) return;
    const file = new File([b], 'belmaster-rezultat.png', { type: 'image/png' });
    if (canShareFiles.current) {
      try {
        await navigator.share({ files: [file], title: 'БЕЛ Мастър', text: `${data.kicker}: ${data.value} — можеш ли повече? ${SITE}` });
        await claim();
      } catch {
        /* отказано от менюто — без награда */
      }
      return;
    }
    // компютър: няма меню за споделяне на файлове → сваляме картинката
    await download();
    setNote('Картинката е свалена. Качи я като story във Facebook, Instagram или TikTok.');
    await claim();
  };

  return (
    <div className="shr nx" role="dialog" aria-modal onClick={onClose}>
      <div className="shr-box" onClick={(e) => e.stopPropagation()}>
        <button className="shr-x" onClick={onClose} aria-label="Затвори">
          <X className="size-5" />
        </button>
        <div className="shr-frame" data-ready={ready}>
          <canvas ref={canvas} width={W} height={H} />
        </div>
        <div className="shr-side">
          <h2 className="ln-display">Сподели резултата</h2>
          <p>Готова картинка за story — Instagram, TikTok, Facebook или направо във Viber.</p>
          {got > 0 ? (
            <p className="shr-reward" data-got>
              💎 +{got} диаманта — благодарим, че сподели!
            </p>
          ) : reward > 0 ? (
            <p className="shr-reward">
              💎 +{reward} диаманта за първото ти споделяне
            </p>
          ) : null}
          <button className="ln-btn ln-btn-primary" onClick={share} disabled={!ready}>
            <Share2 className="size-5" /> Сподели
          </button>
          <button className="ln-btn ln-btn-ghost" onClick={download} disabled={!ready}>
            <Download className="size-5" /> Само изтегли
          </button>
          {note && <p className="shr-note">{note}</p>}
        </div>
      </div>
    </div>
  );
}
