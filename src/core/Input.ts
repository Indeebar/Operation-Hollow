export class Input {
  private keys: Set<string> = new Set();
  private justPressedKeys: Set<string> = new Set();
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
    document.addEventListener('mousemove', e => {
      if (this.pointerLocked) {
        this.mouseMovX += e.movementX;
        this.mouseMovY += e.movementY;
      }
    });
    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
    });
    canvas.addEventListener('click', () => {
      if (!this.pointerLocked) canvas.requestPointerLock();
    });
  }

  isDown(code: string): boolean {
    return this.keys.has(code);
  }

  isJustPressed(code: string): boolean {
    return this.justPressedKeys.has(code);
  }

  clearFrame(): void {
    this.justPressedKeys.clear();
  }

  flushMouse(): { x: number; y: number } {
    const r = { x: this.mouseMovX, y: this.mouseMovY };
    this.mouseMovX = 0;
    this.mouseMovY = 0;
    return r;
  }
}
