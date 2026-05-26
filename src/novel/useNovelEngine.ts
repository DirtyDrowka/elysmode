import { ref, computed, onScopeDispose } from 'vue';
import type { NovelScript, NovelNode, NodeId } from './types';

const TYPE_SPEED_MS = 25;

export function useNovelEngine(script: NovelScript) {
  const nodeMap = new Map<NodeId, NovelNode>(script.nodes.map(n => [n.id, n]));

  const currentNodeId = ref<NodeId>(script.startNodeId);
  const displayedText = ref('');
  const isTyping = ref(false);
  let timerId: ReturnType<typeof setTimeout> | null = null;

  const currentNode = computed<NovelNode>(() => {
    const n = nodeMap.get(currentNodeId.value);
    if (!n) throw new Error(`Node ${currentNodeId.value} not found`);
    return n;
  });

  const isChoice = computed(() => currentNode.value.type === 'choice');

  function cancelTimer() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  function getFullText(node: NovelNode): string {
    if (node.type === 'narrator' || node.type === 'dialogue') return node.text;
    return node.prompt ?? '';
  }

  function startTypewriter() {
    cancelTimer();
    const full = getFullText(currentNode.value);
    displayedText.value = '';
    if (full.length === 0) {
      isTyping.value = false;
      return;
    }
    isTyping.value = true;
    let i = 0;
    const tick = () => {
      i++;
      displayedText.value = full.slice(0, i);
      if (i < full.length) {
        timerId = setTimeout(tick, TYPE_SPEED_MS);
      } else {
        isTyping.value = false;
        timerId = null;
      }
    };
    timerId = setTimeout(tick, TYPE_SPEED_MS);
  }

  function goTo(id: NodeId) {
    currentNodeId.value = id;
    startTypewriter();
  }

  function tap() {
    if (isChoice.value) return;
    if (isTyping.value) {
      cancelTimer();
      displayedText.value = getFullText(currentNode.value);
      isTyping.value = false;
      return;
    }
    const node = currentNode.value;
    if (node.type === 'narrator' || node.type === 'dialogue') {
      goTo(node.next);
    }
  }

  function selectChoice(optionIndex: number) {
    const node = currentNode.value;
    if (node.type !== 'choice') return;
    const opt = node.options[optionIndex];
    if (!opt) return;
    goTo(opt.next);
  }

  function reset() {
    goTo(script.startNodeId);
  }

  onScopeDispose(() => cancelTimer());

  // запуск
  startTypewriter();

  return { currentNode, displayedText, isTyping, isChoice, tap, selectChoice, reset };
}

export type NovelEngine = ReturnType<typeof useNovelEngine>;
