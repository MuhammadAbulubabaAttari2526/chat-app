import Avatar from './Avatar';
import { formatListTime } from '../utils';

export default function Sidebar({
  me,
  users,
  loading,
  search,
  onSearch,
  activeId,
  onSelect,
  onlineIds,
  typing,
  connected,
  onLogout,
}) {
  return (
    <aside className="sidebar">
      <header className="sidebar-head">
        <Avatar name={me.username} size={40} />
        <div className="me">
          <strong>{me.username}</strong>
          <span className={`conn ${connected ? 'conn-on' : ''}`}>
            {connected ? 'Connected' : 'Reconnecting…'}
          </span>
        </div>
        <button className="btn-ghost" onClick={onLogout}>Log out</button>
      </header>

      <div className="search">
        <input
          type="search"
          value={search}
          onChange={(e) => onSearch(e.target.value)}
          placeholder="Search people"
          aria-label="Search people"
        />
      </div>

      <ul className="user-list">
        {loading && <li className="empty">Loading people…</li>}
        {!loading && users.length === 0 && (
          <li className="empty">
            {search
              ? `No one matches “${search}”.`
              : 'No one else has joined yet. Open the app in a second browser and register another account.'}
          </li>
        )}
        {users.map((u) => {
          const online = onlineIds.has(u._id);
          const isTyping = typing[u._id];
          return (
            <li key={u._id}>
              <button
                className={`user-row ${activeId === u._id ? 'is-active' : ''}`}
                onClick={() => onSelect(u)}
              >
                <Avatar name={u.username} online={online} />
                <span className="user-main">
                  <span className="user-top">
                    <span className="user-name">{u.username}</span>
                    {u.lastMessage && (
                      <time className="user-time">{formatListTime(u.lastMessage.createdAt)}</time>
                    )}
                  </span>
                  <span className="user-bottom">
                    <span className={`user-preview ${isTyping ? 'is-typing' : ''}`}>
                      {isTyping
                        ? 'typing…'
                        : u.lastMessage
                        ? `${u.lastMessage.fromMe ? 'You: ' : ''}${u.lastMessage.text}`
                        : online
                        ? 'Online'
                        : 'Say hello'}
                    </span>
                    {u.unreadCount > 0 && (
                      <span className="badge" aria-label={`${u.unreadCount} unread`}>
                        {u.unreadCount > 99 ? '99+' : u.unreadCount}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
