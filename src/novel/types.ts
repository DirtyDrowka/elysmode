export type NodeId = string;

export interface BackgroundRef {
  kind: 'preset' | 'url';
  value: string;
}

export interface CharacterRef {
  id: string | null;
  pose?: string;
}

interface BaseNode {
  id: NodeId;
  background: BackgroundRef;
  character: CharacterRef;
}

export interface NarratorNode extends BaseNode {
  type: 'narrator';
  text: string;
  next: NodeId;
}

export interface DialogueNode extends BaseNode {
  type: 'dialogue';
  speaker: string;
  text: string;
  next: NodeId;
}

export interface ChoiceOption {
  label: string;
  next: NodeId;
  cost?: number;
}

export interface ChoiceNode extends BaseNode {
  type: 'choice';
  prompt?: string;
  options: ChoiceOption[];
}

export type NovelNode = NarratorNode | DialogueNode | ChoiceNode;

export interface NovelScript {
  id: string;
  title: string;
  startNodeId: NodeId;
  nodes: NovelNode[];
}
