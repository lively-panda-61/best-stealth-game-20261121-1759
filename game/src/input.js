// Keyboard and mouse input for THE BRASS CROW.
// WASD/arrows move, Shift sneaks, Space sprints, click throws a coin at
// the clicked spot, Q smoke, E douse, H field notes, M mute, Esc/P pause.
export function createInput() {
  return {
    left: false, right: false, up: false, down: false,
    sneak: false, sprint: false,
    clickTarget: null,
  };
}

const MOVE_KEYS = {
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
};

export function bindKeyboard(input, onAction) {
  window.addEventListener('keydown', (event) => {
    const move = MOVE_KEYS[event.code];
    if (move) {
      input[move] = true;
      event.preventDefault();
      return;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') input.sneak = true;
    else if (event.code === 'Space') {
      input.sprint = true;
      event.preventDefault();
    } else if (['Enter', 'KeyR', 'KeyQ', 'KeyE', 'KeyH', 'KeyM', 'Escape', 'KeyP'].includes(event.code)) {
      onAction(event.code);
    }
  });
  window.addEventListener('keyup', (event) => {
    const move = MOVE_KEYS[event.code];
    if (move) input[move] = false;
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') input.sneak = false;
    else if (event.code === 'Space') input.sprint = false;
  });
  window.addEventListener('blur', () => {
    input.left = input.right = input.up = input.down = false;
    input.sneak = input.sprint = false;
  });
}
