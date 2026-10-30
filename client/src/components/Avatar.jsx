import { avatarColor, initials } from '../utils';

export default function Avatar({ name, online, size = 44 }) {
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: avatarColor(name), fontSize: size * 0.36 }}
      aria-hidden="true"
    >
      {initials(name)}
      {online !== undefined && (
        <span className={`presence ${online ? 'presence-on' : ''}`} title={online ? 'Online' : 'Offline'} />
      )}
    </span>
  );
}
