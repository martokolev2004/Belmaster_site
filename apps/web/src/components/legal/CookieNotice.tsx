'use client';

/**
 * Кратко съобщение за бисквитките при първото отваряне на сайта. Сайтът ползва само необходими бисквитки,
 * затова е само известие (без „Отказвам“). Затварянето се помни в браузъра.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const KEY = 'bm_cookies';

export function CookieNotice() {
  const path = usePathname();
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      setShow(localStorage.getItem(KEY) !== 'ok');
    } catch {
      setShow(false);
    }
  }, []);
  // не пречим по време на игра
  if (!show || /^\/(play\/|tower)/.test(path)) return null;
  const close = () => {
    try {
      localStorage.setItem(KEY, 'ok');
    } catch {
      /* без localStorage — ще излезе пак, нищо страшно */
    }
    setShow(false);
  };
  return (
    <div className="ck" role="region" aria-label="Бисквитки">
      <span className="ck-ic" aria-hidden>
        🍪
      </span>
      <p>
        Ползваме само <b>необходими бисквитки</b> — за да останеш влязъл и да запомним настройките ти. Без реклами и проследяване.{' '}
        <Link href="/cookies">Научи повече</Link>
      </p>
      <button onClick={close}>Разбрах</button>
    </div>
  );
}
