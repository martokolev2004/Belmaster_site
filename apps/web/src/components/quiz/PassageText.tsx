/** Текст за четене; [[img:/път/към/картинка.png|описание]] се показва като картинка (напр. диаграма). */
export function PassageText({ text }: { text: string }) {
  const parts = text.split(/(\[\[img:[^\]]+\]\])/g);
  return (
    <div className="whitespace-pre-line leading-relaxed">
      {parts.map((part, i) => {
        const m = part.match(/^\[\[img:([^|\]]+)(?:\|([^\]]*))?\]\]$/);
        if (!m) return <span key={i}>{part}</span>;
        return (
          <figure key={i} className="my-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <a href={m[1]} target="_blank" rel="noreferrer" title="Отвори в цял размер">
              <img src={m[1]} alt={m[2] ?? ''} className="w-full cursor-zoom-in rounded-xl border-2 border-line bg-white" loading="lazy" />
            </a>
            <figcaption className="mt-1 text-xs text-muted">{m[2] ? `${m[2]} · ` : ''}цъкни за цял размер</figcaption>
          </figure>
        );
      })}
    </div>
  );
}
