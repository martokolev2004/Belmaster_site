// Наши аксесоари, нарисувани в стила на „Adventurer“ (координати 0..762, дебел черен контур)
const K = 'stroke="#000" stroke-width="9" stroke-linejoin="round" stroke-linecap="round"';

export const EXTRA_SVG: Record<string, string> = {
  none: '',
  crown: `<path d="M240 190 L222 52 L312 122 L390 26 L468 122 L558 52 L540 190 Z" fill="#f7c948" ${K}/>
    <path d="M240 190 L540 190 L540 226 Q390 246 240 226 Z" fill="#e0a82e" ${K}/>
    <circle cx="390" cy="102" r="22" fill="#ff4b4b" ${K}/><circle cx="286" cy="208" r="13" fill="#1cb0f6" stroke="#000" stroke-width="6"/><circle cx="494" cy="208" r="13" fill="#1cb0f6" stroke="#000" stroke-width="6"/>`,
  laurel: (() => {
    let s = '';
    for (let i = 0; i < 7; i++) {
      for (const side of [-1, 1]) {
        const t = (i / 6) * 0.95;
        const x = 390 + side * (60 + 210 * Math.sin(t * 1.55));
        const y = 150 + 190 * (1 - Math.cos(t * 1.55));
        const rot = side * (95 - i * 13);
        s += `<ellipse cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="46" ry="20" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})" fill="#f7c948" stroke="#000" stroke-width="7"/>`;
      }
    }
    return s + `<circle cx="390" cy="150" r="20" fill="#e0a82e" stroke="#000" stroke-width="7"/>`;
  })(),
  quill: `<path d="M612 470 Q760 300 724 70 Q666 230 588 440 Z" fill="#fffdf6" ${K}/>
    <path d="M604 452 Q690 280 720 82" fill="none" stroke="#000" stroke-width="6"/>
    <path d="M650 300 L700 290 M640 340 L688 334 M664 250 L712 236" stroke="#000" stroke-width="5" stroke-linecap="round"/>`,
  helmet: `<path d="M120 352 Q110 92 390 74 Q670 92 660 352 L612 318 Q390 252 168 318 Z" fill="#c3ccd3" ${K}/>
    <path d="M168 318 Q390 252 612 318 L612 354 Q390 290 168 354 Z" fill="#8b979e" ${K}/>
    <path d="M390 74 L390 270" stroke="#000" stroke-width="8"/>
    <path d="M390 80 Q470 -10 560 30 Q500 40 470 96" fill="#ff4b4b" ${K}/>
    <circle cx="230" cy="250" r="10" fill="#000"/><circle cx="550" cy="250" r="10" fill="#000"/>`,
};

export const FRAME_SVG: Record<string, string> = {
  none: '',
  bronze: `<rect x="14" y="14" width="734" height="734" rx="150" fill="none" stroke="#b0703a" stroke-width="28"/>`,
  silver: `<rect x="14" y="14" width="734" height="734" rx="150" fill="none" stroke="#c9d1d6" stroke-width="28"/><rect x="38" y="38" width="686" height="686" rx="128" fill="none" stroke="#8b979e" stroke-width="8"/>`,
  gold: `<rect x="14" y="14" width="734" height="734" rx="150" fill="none" stroke="#f2c230" stroke-width="30"/><rect x="40" y="40" width="682" height="682" rx="126" fill="none" stroke="#fff3c4" stroke-width="8"/>`,
  legend: `<defs><linearGradient id="bm-legend" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#7a4fd6"/><stop offset=".5" stop-color="#1cb0f6"/><stop offset="1" stop-color="#ff4b8a"/></linearGradient></defs><rect x="14" y="14" width="734" height="734" rx="150" fill="none" stroke="url(#bm-legend)" stroke-width="34"/>`,
};
