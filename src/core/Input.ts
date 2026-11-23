export class Input {
  private keys: Set<string> = new Set();
  private justPressedKeys: Set<string> = new Set();
  private mouseButtons: Set<number> = new Set();
  private justPressedMouseButtons: Set<number> = new Set();
  private mouseMovX: number = 0;
  private mouseMovY: number = 0;
  pointerLocked: boolean = false;

  constructor(private canvas: HTMLCanvasElement) {
    window.addEventListener('keydown', e => {
      if (!this.keys.has(e.code)) {
        this.justPressedKeys.add(e.code);
      }
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', e => {
      this.keys.delete(e.code);
    });

    window.addEventListener('mousedown', e => {
      if (!this.pointerLocked) {
        this.canvas.requestPointerLock();
      } else {
        if (!this.mouseButtons.has(e.button)) {
          this.justPressedMouseButtons.add(e.button);
        }
        this.mouseButtons.add(e.button);
      }
    });

    window.addEventListener('mouseup', e => {
      this.mouseButtons.delete(e.button);
    });

    window.addEventListener('contextmenu', e => {
      if (this.pointerLocked) e.preventDefault();
    });

    document.addEventListener('mousemove', e => {
      if (this.pointerLocked) {
        this.mouseMovX += e.movementX;
        this.mouseMovY += e.movementY;
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      if (!this.pointerLocked) {
        this.mouseButtons.clear();
        this.keys.clear();
      }
    });
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  isJustPressed(code: string): boolean {
    return this.justPressedKeys.has(code);
  }

  isMouseDown(button: number): boolean {
    return this.mouseButtons.has(button);
  }

  isMouseJustPressed(button: number): boolean {
    return this.justPressedMouseButtons.has(button);
  }

  clearFrame(): void {
    this.justPressedKeys.clear();
    this.justPressedMouseButtons.clear();
  }

  flushMouse(): { x: number; y: number } {
    const r = { x: this.mouseMovX, y: this.mouseMovY };
    this.mouseMovX = 0;
    this.mouseMovY = 0;
    return r;
  }
}
