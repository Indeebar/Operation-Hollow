export class Time {
  delta: number = 0;
  elapsed: number = 0;
  fps: number = 0;

  private last: number = 0;
  private fpsSmooth: number = 0;

  tick(now: number): void {
    if (this.last === 0) this.last = now;
    const raw = Math.min((now - this.last) / 1000, 0.1);
    this.delta = raw;
    this.elapsed += raw;
    this.last = now;
    // exponential moving avg fps
    const instantFps = raw > 0 ? 1 / raw : 0;
    this.fpsSmooth = this.fpsSmooth === 0
      ? instantFps
      : this.fpsSmooth * 0.9 + instantFps * 0.1;
    this.fps = Math.round(this.fpsSmooth);
  }
}
