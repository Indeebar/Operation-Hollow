export type GameState = 'MENU' | 'PLAYING' | 'PAUSED' | 'ENDING';

export class Game {
  state: GameState = 'MENU';

  transition(next: GameState): void {
    console.log(`[Game] ${this.state} → ${next}`);
    this.state = next;
  }
}
