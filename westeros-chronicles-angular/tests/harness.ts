/**
 * Harness mínimo de testes (sem dependências externas).
 *
 * O motor não depende de Angular, então roda direto no Node depois do tsc.
 */

type TestFn = () => void | Promise<void>;

const tests: Array<{ name: string; fn: TestFn }> = [];
let failures = 0;

export function test(name: string, fn: TestFn): void {
  tests.push({ name, fn });
}

export function assert(cond: unknown, msg: string): asserts cond {
  if (!cond) throw new Error(`assert falhou: ${msg}`);
}

export function assertEqual<T>(actual: T, expected: T, msg: string): void {
  if (actual !== expected) {
    throw new Error(`${msg}\n  esperado: ${String(expected)}\n  recebido: ${String(actual)}`);
  }
}

export async function run(): Promise<void> {
  for (const t of tests) {
    const started = Date.now();
    try {
      await t.fn();
      console.log(`  ok   ${t.name} (${Date.now() - started}ms)`);
    } catch (err) {
      failures += 1;
      console.log(`  FALHA ${t.name}`);
      console.log(`       ${(err as Error).message.split('\n').join('\n       ')}`);
    }
  }

  console.log('');
  if (failures > 0) {
    console.log(`${failures} teste(s) falharam.`);
    process.exit(1);
  }
  console.log(`${tests.length} teste(s) passaram.`);
}
