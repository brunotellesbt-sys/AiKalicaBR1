/**
 * Testes de interface no navegador.
 *
 * O motor tem cobertura determinística própria (`npm test`), mas os bugs mais
 * caros desta base foram de UI e nenhum deles apareceria em teste de motor:
 * um *ngFor sem trackBy que destruía os nós SVG antes do clique disparar, um
 * rótulo com pointer-events:none que deixava o clique atravessar até o mar, e
 * uma aba que não abria painel nenhum. Esta suíte cobre justamente isso.
 *
 * Uso: npm run test:ui — sobe o dev server, roda a suíte e derruba o servidor.
 * O runner apenas se conecta: subir o servidor de dentro dele fazia o processo
 * inteiro morrer junto com a árvore do Angular CLI.
 */
import { chromium } from 'playwright';
import { setTimeout as sleep } from 'node:timers/promises';

const PORT = process.env.UI_TEST_PORT || 4300;
const BASE = `http://localhost:${PORT}`;

const tests = [];
let failures = 0;

function test(name, fn) { tests.push({ name, fn }); }
function assert(cond, msg) { if (!cond) throw new Error(`assert falhou: ${msg}`); }
function assertEqual(a, b, msg) {
  if (a !== b) throw new Error(`${msg}\n  esperado: ${b}\n  recebido: ${a}`);
}

/** Começa uma campanha e devolve a página pronta. */
async function startGame(page, houseId = 'stark') {
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.selectOption('select[size="10"]', houseId);
  await page.click('button.btn');
  await page.waitForSelector('nav.tabs', { timeout: 15000 });
}

async function endTurns(page, n) {
  for (let i = 0; i < n; i++) {
    const btn = page.locator('button:has-text("Encerrar turno"):not([disabled])').first();
    if (await btn.count() === 0) break;
    await btn.click();
    await page.waitForTimeout(40);
  }
}

// ---------------------------------------------------------------------------

test('a campanha inicia e mostra o menu de decisões', async (page) => {
  await startGame(page);
  const text = await page.textContent('body');
  assert(/O que você fará/i.test(text), 'o menu principal não apareceu');
  assert(/Ano 150 DC/.test(text), 'a data inicial não é 150 DC');
});

test('todas as abas abrem um painel', async (page) => {
  await startGame(page);
  const abas = ['Mapa', 'Local', 'Torneios', 'Personagem', 'Casa', 'Diplomacia', 'Cânone', 'Crônicas', 'Saves'];
  for (const aba of abas) {
    await page.click(`nav.tabs button:has-text("${aba}")`);
    await page.waitForTimeout(150);
    const painel = page.locator('section.right > *').first();
    assert(await painel.count() > 0, `a aba "${aba}" não renderizou painel`);
  }
});

test('o mapa desenha as nove regiões e a Muralha', async (page) => {
  await startGame(page);
  await page.click('nav.tabs button:has-text("Mapa")');
  await page.waitForSelector('svg.westeros');

  const regioes = await page.locator('path.region-fill').count();
  assert(regioes >= 9, `esperava 9+ formas de região, veio ${regioes}`);
  assert(await page.locator('path.wall').count() === 1, 'a Muralha não foi desenhada');
  assert(await page.locator('g.marker').count() > 10, 'poucos locais no mapa');
});

test('clicar num destino no mapa viaja de verdade', async (page) => {
  await startGame(page);
  await page.click('nav.tabs button:has-text("Mapa")');
  await page.waitForSelector('g.marker.reachable');

  const antes = await page.textContent('.where');
  await page.locator('g.marker.reachable').first().click();
  await page.waitForTimeout(900);
  const depois = await page.textContent('.where');

  assert(antes !== depois, 'a localização não mudou ao clicar no destino');
});

test('clicar numa região seleciona o reino', async (page) => {
  await startGame(page);
  await page.click('nav.tabs button:has-text("Mapa")');
  await page.waitForSelector('path.region');

  // Clica num ponto do polígono, e não no centro do elemento: no centro é
  // comum haver o rótulo de uma cidade por cima (que também é clicável).
  const alvo = page.locator('path.region').nth(3);
  const box = await alvo.boundingBox();
  assert(box, 'a região não tem área visível');
  await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.8);
  await page.waitForTimeout(250);

  assert(await page.locator('path.region.selected').count() >= 1, 'nenhuma região ficou selecionada');
});

test('o turno avança e a data acompanha', async (page) => {
  await startGame(page);
  const antes = await page.textContent('.date');
  await endTurns(page, 6);
  const depois = await page.textContent('.date');
  assert(antes !== depois, `a data não avançou (${antes})`);
});

test('a diplomacia oferece a opção de guerra', async (page) => {
  await startGame(page);

  // o botão no chat, e não a aba de mesmo nome
  await page.click('section.center button:has-text("Diplomacia")');
  await page.waitForTimeout(400);

  const guerra = page.locator('section.center button:has-text("Guerra")');
  assert(await guerra.count() >= 1, 'a opção de guerra não aparece no menu de diplomacia');
});

test('declarar guerra é bloqueado para quem não lidera a Casa', async (page) => {
  await startGame(page);

  // o jogador começa como último na linha de sucessão, nunca como líder
  await page.click('section.center button:has-text("Diplomacia")');
  await page.waitForTimeout(300);
  await page.click('section.center button:has-text("Guerra")');
  await page.waitForTimeout(400);

  const texto = await page.textContent('section.center');
  assert(
    /só o líder da casa pode declarar guerra/i.test(texto),
    'a restrição de liderança não foi aplicada'
  );
});

test('nenhum erro de console durante uma sessão típica', async (page, errors) => {
  await startGame(page);
  await page.click('nav.tabs button:has-text("Mapa")');
  await page.waitForTimeout(200);
  await page.locator('g.marker.reachable').first().click();
  await page.waitForTimeout(700);
  await endTurns(page, 10);
  for (const aba of ['Cânone', 'Diplomacia', 'Personagem', 'Crônicas']) {
    await page.click(`nav.tabs button:has-text("${aba}")`);
    await page.waitForTimeout(150);
  }
  assertEqual(errors.length, 0, `erros no console:\n${errors.join('\n')}`);
});

// ---------------------------------------------------------------------------

async function waitForServer(url, timeoutMs = 120000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch { /* ainda subindo */ }
    await sleep(2000);
  }
  return false;
}

async function main() {
  if (!await waitForServer(BASE)) {
    console.log(`  FALHA: nenhum servidor respondendo em ${BASE}`);
    console.log('  Suba com: npx ng serve --port ' + PORT);
    process.exit(1);
  }

  const browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium',
    headless: false,
    args: ['--headless=new', '--no-sandbox'],
  });

  for (const t of tests) {
    const started = Date.now();
    const errors = [];
    const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

    try {
      await t.fn(page, errors);
      console.log(`  ok   ${t.name} (${Date.now() - started}ms)`);
    } catch (err) {
      failures += 1;
      console.log(`  FALHA ${t.name}`);
      console.log(`       ${String(err.message).split('\n').join('\n       ')}`);
    } finally {
      await page.close();
    }
  }

  await browser.close();

  console.log('');
  if (failures > 0) {
    console.log(`${failures} teste(s) de UI falharam.`);
    process.exit(1);
  }
  console.log(`${tests.length} teste(s) de UI passaram.`);
}

main();
