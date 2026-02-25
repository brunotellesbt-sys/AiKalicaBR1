export class Rng {
  private seed: number;

  constructor(seed: number) {
    // garante seed 32-bit
    this.seed = seed >>> 0;
  }

  // xorshift32
  next(): number {
    let x = this.seed;
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    this.seed = x >>> 0;
    return (this.seed >>> 0) / 0xFFFFFFFF;
  }

  int(min: number, max: number): number {
    return Math.floor(this.next() * (max - min + 1)) + min;
  }

  float(min: number, max: number): number {
    return this.next() * (max - min) + min;
  }

  pick<T>(arr: T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  getSeed(): number {
    return this.seed >>> 0;
  }

  setSeed(seed: number): void {
    this.seed = seed >>> 0;
  }
}
