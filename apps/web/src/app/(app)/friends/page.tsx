import { redirect } from 'next/navigation';

/** Приятелите вече са част от „Класация“ — старият адрес води там. */
export default function FriendsPage() {
  redirect('/leaderboard#friends');
}
