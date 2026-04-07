/**
 * TH\u00c9R\u00c8SE - API Biblioth\u00e8que de prompts
 *
 * Service d'acc\u00e8s \u00e0 la biblioth\u00e8que de prompts pr\u00eats \u00e0 l'emploi.
 */

import { request } from './core';

export interface PromptItem {
  id: string;
  title: string;
  category: string;
  description: string;
  prompt: string;
  tags: string[];
}

export interface PromptCategory {
  category: string;
  label: string;
  prompts: PromptItem[];
}

export interface PromptLibraryResponse {
  total: number;
  categories: PromptCategory[];
}

export interface PromptSearchResponse {
  query: string;
  total: number;
  categories: PromptCategory[];
}

/**
 * R\u00e9cup\u00e8re la biblioth\u00e8que compl\u00e8te group\u00e9e par cat\u00e9gorie.
 */
export async function getPromptLibrary(): Promise<PromptLibraryResponse> {
  return request<PromptLibraryResponse>('/api/prompts/library');
}

/**
 * Recherche dans la biblioth\u00e8que par mots-cl\u00e9s.
 */
export async function searchPromptLibrary(query: string): Promise<PromptSearchResponse> {
  return request<PromptSearchResponse>(
    `/api/prompts/library/search?q=${encodeURIComponent(query)}`
  );
}
