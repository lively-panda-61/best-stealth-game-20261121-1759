// Keyboard (and click-to-move target) input for SHADOW PROTOCOL.
// Tracks held keys as a movement state the game logic consumes each frame.

export function createInput() {
  return {
    up: false,
    down: false,
    left: false,
    right: false,
    sneak: false,
    // Click-to-move destination in canvas pixels, or null.
    clickTarget: null,
  };
}

const KEYMAP = {
  KeyW: 'up',
  ArrowUp: 'up',
  KeyS: 'down',
  ArrowDown: 'down',
  KeyA: 'left',
  ArrowLeft: 'left',
  KeyD: 'right',
  ArrowRight: 'right',
  ShiftLeft: 'sneak',
  ShiftRight: 'sneak',
};

export function bindKeyboard(input, onAction) {
  window.addEventListener('keydown', (event) => {
    const field = KEYMAP[event.code];
    if (field) {
      input[field] = true;
      input.clickTarget = null; // keys override click-to-move
      event.preventDefault();
      return;
    }
    if (event.code === 'Enter' || event.code === 'KeyR' || event.code === 'Space') {
      onAction(event.code);
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => {
    const field = KEYMAP[event.code];
    if (field) input[field] = false;
  });
  window.addEventListener('blur', () => {
    input.up = input.down = input.left = input.right = input.sneak = false;
  });
}

// Turn a click target into movement input when no key is held.
export function inputFromClickTarget(input, player, deadZone = 6) {
  if (!input.clickTarget) return;
  const dx = input.clickTarget.x - player.x;
  const dy = input.clickTarget.y - player.y;
  if (Math.hypot(dx, dy) < deadZone) {
    input.clickTarget = null;
    return;
  }
  if (dx > deadZone) input.right = true;
  if (dx < -deadZone) input.left = true;
  if (dy > deadZone) input.down = true;
  if (dy < -deadZone) input.up = true;
}

export function anyMovementKey(input) {
  return input.up || input.down || input.left || input.right;
}
