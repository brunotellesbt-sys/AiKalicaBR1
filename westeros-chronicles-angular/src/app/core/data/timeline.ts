/**
 * Timeline (150 DC) – propositalmente enxuta.
 * Você pode adicionar entradas históricas (canônicas ou "semi-canônicas") aqui,
 * mas sem transformar o jogo em um recontar fixo: o jogador pode desviar eventos.
 */
export interface ScheduledEvent {
  year: number;
  turn: number; // 1..20
  title: string;
  body: string;
  tags: string[];
}

export const SCHEDULED_EVENTS: ScheduledEvent[] = [
  // Exemplo de marcação de contexto (não é "missão obrigatória")
  {
    year: 150,
    turn: 2,
    title: 'Rumores na Corte',
    body: 'Sussurros em Porto Real falam de disputas antigas reacendendo sob a calmaria do reinado de Aegon III.',
    tags: ['corte', 'porto-real']
  }
];
