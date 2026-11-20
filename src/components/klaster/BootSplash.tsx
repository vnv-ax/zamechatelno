export function BootSplash() {
  return (
    <div
      id="boot-splash"
      className="boot-splash"
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 2147483647,
        backgroundColor: '#D6BFA3',
        transition: 'opacity 320ms ease',
      }}
    />
  );
}
