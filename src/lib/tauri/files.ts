import { invoke } from '@tauri-apps/api/core';
import { open, save } from '@tauri-apps/plugin-dialog';
import type { RecentFile } from '../../stores/documentStore';

const MD_FILTERS = [
  {
    name: 'Markdown',
    extensions: ['md', 'markdown', 'mdown', 'txt'],
  },
];

export async function readTextFile(path: string): Promise<string> {
  return invoke<string>('read_text_file', { path });
}

export async function writeTextFile(path: string, contents: string): Promise<void> {
  await invoke('write_text_file', { path, contents });
}

export async function listRecent(): Promise<RecentFile[]> {
  return invoke<RecentFile[]>('list_recent');
}

export async function pushRecent(path: string): Promise<RecentFile[]> {
  return invoke<RecentFile[]>('push_recent', { path });
}

export async function clearRecent(): Promise<void> {
  await invoke('clear_recent');
}

export async function pickOpenPath(): Promise<string | null> {
  const selected = await open({
    multiple: false,
    directory: false,
    filters: MD_FILTERS,
  });
  if (selected === null) return null;
  if (Array.isArray(selected)) return selected[0] ?? null;
  return selected;
}

export async function pickSavePath(defaultPath?: string): Promise<string | null> {
  const path = await save({
    filters: MD_FILTERS,
    defaultPath: defaultPath ?? 'Untitled.md',
  });
  return path;
}
