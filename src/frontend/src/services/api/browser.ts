/**
 * THÉRÈSE v2 - Browser Automation API
 *
 * Service frontend pour la navigation web et l'interaction avec les pages.
 */

import { API_BASE, apiFetch } from './core';

export interface BrowserActionRequest {
  url?: string;
  action?: string;
  selector?: string;
  value?: string;
}

export interface BrowserActionResponse {
  success: boolean;
  action: string;
  url: string;
  title: string;
  content: string;
  screenshot_path: string | null;
  error: string | null;
}

export interface BrowserStatus {
  active: boolean;
  current_url: string | null;
}

export async function browserNavigate(url: string): Promise<BrowserActionResponse> {
  const response = await apiFetch(`${API_BASE}/api/browser/navigate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  return response.json();
}

export async function browserAction(req: BrowserActionRequest): Promise<BrowserActionResponse> {
  const response = await apiFetch(`${API_BASE}/api/browser/action`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(req),
  });
  return response.json();
}

export async function browserStatus(): Promise<BrowserStatus> {
  const response = await apiFetch(`${API_BASE}/api/browser/status`);
  return response.json();
}

export async function browserClose(): Promise<void> {
  await apiFetch(`${API_BASE}/api/browser/close`, { method: 'POST' });
}
