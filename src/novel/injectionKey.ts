import type { InjectionKey } from 'vue';
import type { NovelEngine } from './useNovelEngine';

export const NovelEngineKey: InjectionKey<NovelEngine> = Symbol('NovelEngine');
