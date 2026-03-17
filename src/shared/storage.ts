import { PREFS_STORAGE_KEY, STORAGE_KEY, STORAGE_VERSION } from './constants';
import type { PreferencesData, Space, StorageData } from './types';

function createId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	return `fallback-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function getStorageArea(): chrome.storage.StorageArea | null {
	if (typeof chrome === 'undefined' || !chrome.storage?.local) {
		return null;
	}

	return chrome.storage.local;
}

function isStorageData(value: unknown): value is StorageData {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as Partial<StorageData>;

	return (
		Array.isArray(candidate.spaces) &&
		typeof candidate.folders === 'object' &&
		candidate.folders !== null &&
		typeof candidate.bookmarks === 'object' &&
		candidate.bookmarks !== null &&
		typeof candidate.activeSpaceId === 'string' &&
		typeof candidate.version === 'number'
	);
}

function isPreferencesData(value: unknown): value is PreferencesData {
	if (!value || typeof value !== 'object') {
		return false;
	}

	const candidate = value as Partial<PreferencesData>;

	return candidate.theme === 'auto' || candidate.theme === 'light' || candidate.theme === 'dark';
}

class StorageService {
	private static instance: StorageService | null = null;

	static getInstance(): StorageService {
		if (!StorageService.instance) {
			StorageService.instance = new StorageService();
		}

		return StorageService.instance;
	}

	async load(): Promise<StorageData | null> {
		const storageArea = getStorageArea();

		if (!storageArea) {
			return null;
		}

		const result = await storageArea.get(STORAGE_KEY);
		const storedValue = result[STORAGE_KEY] as unknown;

		return isStorageData(storedValue) ? storedValue : null;
	}

	async save(data: StorageData): Promise<void> {
		const storageArea = getStorageArea();

		if (!storageArea) {
			return;
		}

		await storageArea.set({ [STORAGE_KEY]: data });
	}

	async loadPrefs(): Promise<PreferencesData | null> {
		const storageArea = getStorageArea();

		if (!storageArea) {
			return null;
		}

		const result = await storageArea.get(PREFS_STORAGE_KEY);
		const storedValue = result[PREFS_STORAGE_KEY] as unknown;

		return isPreferencesData(storedValue) ? storedValue : null;
	}

	async savePrefs(prefs: PreferencesData): Promise<void> {
		const storageArea = getStorageArea();

		if (!storageArea) {
			return;
		}

		await storageArea.set({ [PREFS_STORAGE_KEY]: prefs });
	}

	getDefaultPrefs(): PreferencesData {
		return {
			theme: 'auto',
		};
	}

	getDefaultState(): StorageData {
		const defaultSpace: Space = {
			id: createId(),
			name: 'Work',
			color: 'green',
			pinnedSites: [],
			rootFolderIds: [],
		};

		return {
			spaces: [defaultSpace],
			folders: {},
			bookmarks: {},
			activeSpaceId: defaultSpace.id,
			version: STORAGE_VERSION,
		};
	}

	onChange(callback: (data: StorageData) => void): () => void {
		if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
			return () => undefined;
		}

		const listener: Parameters<typeof chrome.storage.onChanged.addListener>[0] = (changes, areaName) => {
			if (areaName !== 'local') {
				return;
			}

			const nextValue = changes[STORAGE_KEY]?.newValue as unknown;

			if (isStorageData(nextValue)) {
				callback(nextValue);
			}
		};

		chrome.storage.onChanged.addListener(listener);

		return () => {
			chrome.storage.onChanged.removeListener(listener);
		};
	}
}

export const storageService = StorageService.getInstance();
export { StorageService };