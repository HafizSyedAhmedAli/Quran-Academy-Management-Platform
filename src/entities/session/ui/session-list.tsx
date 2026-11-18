import { formatSessionStart } from '../lib/format-session-time';

type Item = { id: string; studentName: string; startsAt: Date };

export function SessionList({ sessions }: { sessions: Item[] }) {
  if (sessions.length === 0) return <p>No upcoming classes.</p>;
  return (
    <ul className="space-y-2">
      {sessions.map((s) => (
        <li key={s.id} data-testid="session-item">
          <strong>{s.studentName}</strong> · {formatSessionStart(s.startsAt)}
        </li>
      ))}
    </ul>
  );
}
