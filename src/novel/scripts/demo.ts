import type { NovelScript } from '../types';

export const demoScript: NovelScript = {
  id: 'demo',
  title: 'Поздний вечер',
  startNodeId: 'n1',
  nodes: [
    {
      id: 'n1',
      type: 'narrator',
      background: { kind: 'preset', value: 'street_night' },
      character: { id: null },
      text: 'Поздний вечер. Город дышит холодом и неоновым светом, отражённым в лужах. Откуда-то издалека доносится приглушённый бас музыки.',
      next: 'n2',
    },
    {
      id: 'n2',
      type: 'narrator',
      background: { kind: 'preset', value: 'street_night' },
      character: { id: null },
      text: 'Шаги по мокрому асфальту звучат глухо. Где-то впереди — её окно, тёплое жёлтое пятно среди серых стен.',
      next: 'n3',
    },
    {
      id: 'n3',
      type: 'dialogue',
      background: { kind: 'preset', value: 'room_warm' },
      character: { id: 'elys' },
      speaker: 'Элис',
      text: 'Ты всё-таки пришёл. Я думала, ты уже не придёшь.',
      next: 'n4',
    },
    {
      id: 'n4',
      type: 'narrator',
      background: { kind: 'preset', value: 'room_warm' },
      character: { id: 'elys' },
      text: 'Тёплый свет торшера ложится на её плечо. В комнате пахнет цитрусом и старыми книгами.',
      next: 'n5',
    },
    {
      id: 'n5',
      type: 'choice',
      background: { kind: 'preset', value: 'room_warm' },
      character: { id: 'elys' },
      prompt: 'Что ответить?',
      options: [
        { label: 'Я думал о тебе всю неделю.', next: 'n1' },
        { label: 'Просто проходил мимо.', next: 'n1' },
        { label: 'Молча подойти и обнять.', next: 'n1', cost: 15 },
      ],
    },
  ],
};
