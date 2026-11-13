/** Всяка страница влиза с кратко избледняване (само прозрачност — за да не се местят закрепените ленти). */
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="pg-in">{children}</div>;
}
