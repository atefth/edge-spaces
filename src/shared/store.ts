import { create } from 'zustand';

import {
	MAX_FOLDER_DEPTH,
	MAX_PINNED_SITES,
	PERSIST_DEBOUNCE_MS,
	STORAGE_VERSION,
} from './constants';
import { getFaviconUrl } from './favicon';
import { storageService } from './storage';
import type {
	AppState,
	Bookmark,
	Folder,
	PreferencesData,
	PinnedSite,
	Space,
	SpaceColor,
	StorageData,
	ThemePreference,
	TreeItemType,
} from './types';

interface AppActions {
	hydrate(): Promise<void>;
	setTheme(theme: ThemePreference): void;
	setActiveSpace(spaceId: string): void;
	addSpace(name: string, color: SpaceColor): void;
	renameSpace(spaceId: string, name: string): void;
	deleteSpace(spaceId: string): void;
	setSpaceColor(spaceId: string, color: SpaceColor): void;
	addPinnedSite(spaceId: string, site: Omit<PinnedSite, 'id' | 'position'>): void;
	removePinnedSite(spaceId: string, siteId: string): void;
	reorderPinnedSites(spaceId: string, siteIds: string[]): void;
	addFolder(spaceId: string, parentId: string | null, name: string): void;
	renameFolder(folderId: string, name: string): void;
	deleteFolder(folderId: string): void;
	toggleFolder(folderId: string): void;
	addBookmark(spaceId: string, parentId: string, title: string, url: string): void;
	updateBookmark(bookmarkId: string, updates: Partial<Pick<Bookmark, 'title' | 'url'>>): void;
	deleteBookmark(bookmarkId: string): void;
	moveItem(itemId: string, itemType: TreeItemType, newParentId: string | null, newSpaceId: string, newIndex: number): void;
	setSearchQuery(query: string): void;
	importData(data: Partial<StorageData>, mode: 'merge' | 'replace'): void;
}

export type AppStore = AppState & AppActions;

const initialState: AppState = {
	spaces: [],
	folders: {},
	bookmarks: {},
	activeSpaceId: '',
	searchQuery: '',
	theme: 'auto',
	version: STORAGE_VERSION,
};

function debounce<T extends (...args: Parameters<T>) => void>(fn: T, ms: number): T {
	let timeoutId: ReturnType<typeof setTimeout> | undefined;

	return ((...args: Parameters<T>) => {
		if (timeoutId) {
			clearTimeout(timeoutId);
		}

		timeoutId = setTimeout(() => {
			fn(...args);
		}, ms);
	}) as T;
}

function createId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	return `fallback-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function isValidHttpUrl(url: string): boolean {
	try {
		const parsedUrl = new URL(url);
		return /^https?:$/.test(parsedUrl.protocol);
	} catch {
		return false;
	}
}

function isValidBookmarkUrlDraft(url: string): boolean {
	return /^https?:\/\//i.test(url.trim());
}

function normalizeName(name: string): string {
	return name.trim();
}

function extractStorageData(state: AppState): StorageData {
	return {
		spaces: state.spaces,
		folders: state.folders,
		bookmarks: state.bookmarks,
		activeSpaceId: state.activeSpaceId,
		version: state.version,
	};
}

function extractPreferences(state: AppState): PreferencesData {
	return {
		theme: state.theme,
	};
}

function insertAt<T>(items: T[], item: T, index: number): T[] {
	const nextItems = [...items];
	const safeIndex = Math.max(0, Math.min(index, nextItems.length));
	nextItems.splice(safeIndex, 0, item);
	return nextItems;
}

function removeFromArray(items: string[], id: string): string[] {
	return items.filter((item) => item !== id);
}

function getFolderDepth(folders: Record<string, Folder>, parentId: string | null): number {
	let depth = 0;
	let currentId = parentId;

	while (currentId) {
		const currentFolder = folders[currentId];

		if (!currentFolder) {
			break;
		}

		depth += 1;
		currentId = currentFolder.parentId;
	}

	return depth;
}

function getFolderSubtreeHeight(folderId: string, folders: Record<string, Folder>): number {
	const folder = folders[folderId];

	if (!folder) {
		return 0;
	}

	let tallestChildHeight = 0;

	for (const childId of folder.childIds) {
		if (!folders[childId]) {
			continue;
		}

		tallestChildHeight = Math.max(tallestChildHeight, getFolderSubtreeHeight(childId, folders));
	}

	return 1 + tallestChildHeight;
}

function collectFolderDescendants(folderId: string, folders: Record<string, Folder>, bookmarks: Record<string, Bookmark>): {
	folderIds: string[];
	bookmarkIds: string[];
} {
	const folderIds: string[] = [folderId];
	const bookmarkIds: string[] = [];
	const queue: string[] = [folderId];

	while (queue.length > 0) {
		const currentId = queue.shift();

		if (!currentId) {
			continue;
		}

		const currentFolder = folders[currentId];

		if (!currentFolder) {
			continue;
		}

		for (const childId of currentFolder.childIds) {
			if (folders[childId]) {
				folderIds.push(childId);
				queue.push(childId);
				continue;
			}

			if (bookmarks[childId]) {
				bookmarkIds.push(childId);
			}
		}
	}

	return { folderIds, bookmarkIds };
}

function updateFolderSubtreeSpace(
	rootFolderId: string,
	nextSpaceId: string,
	folders: Record<string, Folder>,
	bookmarks: Record<string, Bookmark>,
): void {
	const queue: string[] = [rootFolderId];

	while (queue.length > 0) {
		const currentId = queue.shift();

		if (!currentId) {
			continue;
		}

		const currentFolder = folders[currentId];

		if (!currentFolder) {
			continue;
		}

		folders[currentId] = {
			...currentFolder,
			spaceId: nextSpaceId,
		};

		for (const childId of currentFolder.childIds) {
			if (folders[childId]) {
				queue.push(childId);
			}

			if (bookmarks[childId]) {
				bookmarks[childId] = {
					...bookmarks[childId],
					spaceId: nextSpaceId,
				};
			}
		}
	}
}

function isDescendantFolder(folderId: string, possibleAncestorId: string, folders: Record<string, Folder>): boolean {
	let currentId: string | null = folderId;

	while (currentId) {
		if (currentId === possibleAncestorId) {
			return true;
		}

		currentId = folders[currentId]?.parentId ?? null;
	}

	return false;
}

function normalizeStorageData(data: StorageData): Omit<AppState, 'theme'> {
	const hasActiveSpace = data.spaces.some((space) => space.id === data.activeSpaceId);

	return {
		spaces: data.spaces,
		folders: data.folders,
		bookmarks: data.bookmarks,
		activeSpaceId: hasActiveSpace ? data.activeSpaceId : data.spaces[0]?.id ?? '',
		searchQuery: '',
		version: data.version ?? STORAGE_VERSION,
	};
}

const persistState = debounce((state: AppState) => {
	void storageService.save(extractStorageData(state));
}, PERSIST_DEBOUNCE_MS);

const persistPrefs = debounce((state: AppState) => {
	void storageService.savePrefs(extractPreferences(state));
}, PERSIST_DEBOUNCE_MS);

function persistFromStore(): void {
	persistState(useAppStore.getState());
}

function persistPrefsFromStore(): void {
	persistPrefs(useAppStore.getState());
}

export const useAppStore = create<AppStore>((set, get) => ({
	...initialState,

	async hydrate() {
		const [loadedState, loadedPrefs] = await Promise.all([storageService.load(), storageService.loadPrefs()]);
		const nextState = normalizeStorageData(loadedState ?? storageService.getDefaultState());

		set({
			...nextState,
			theme: loadedPrefs?.theme ?? storageService.getDefaultPrefs().theme,
		});

		if (!loadedState) {
			persistFromStore();
		}

		if (!loadedPrefs) {
			persistPrefsFromStore();
		}
	},

	setTheme(theme) {
		set({ theme });
		persistPrefsFromStore();
	},

	setActiveSpace(spaceId) {
		if (!get().spaces.some((space) => space.id === spaceId)) {
			return;
		}

		set({ activeSpaceId: spaceId });
		persistFromStore();
	},

	addSpace(name, color) {
		const trimmedName = normalizeName(name) || 'New Space';
		const newSpace: Space = {
			id: createId(),
			name: trimmedName,
			color,
			pinnedSites: [],
			rootFolderIds: [],
		};

		set((state) => ({
			spaces: [...state.spaces, newSpace],
			activeSpaceId: newSpace.id,
		}));

		persistFromStore();
	},

	renameSpace(spaceId, name) {
		const trimmedName = normalizeName(name);

		if (!trimmedName) {
			return;
		}

		set((state) => ({
			spaces: state.spaces.map((space) =>
				space.id === spaceId
					? {
							...space,
							name: trimmedName,
						}
					: space,
			),
		}));

		persistFromStore();
	},

	deleteSpace(spaceId) {
		const state = get();

		if (state.spaces.length <= 1 || !state.spaces.some((space) => space.id === spaceId)) {
			return;
		}

		const nextFolders = { ...state.folders };
		const nextBookmarks = { ...state.bookmarks };

		for (const folder of Object.values(state.folders)) {
			if (folder.spaceId !== spaceId || folder.parentId !== null) {
				continue;
			}

			const descendants = collectFolderDescendants(folder.id, nextFolders, nextBookmarks);

			for (const folderId of descendants.folderIds) {
				delete nextFolders[folderId];
			}

			for (const bookmarkId of descendants.bookmarkIds) {
				delete nextBookmarks[bookmarkId];
			}
		}

		const nextSpaces = state.spaces.filter((space) => space.id !== spaceId);
		const nextActiveSpaceId = state.activeSpaceId === spaceId ? nextSpaces[0]?.id ?? '' : state.activeSpaceId;

		set({
			spaces: nextSpaces,
			folders: nextFolders,
			bookmarks: nextBookmarks,
			activeSpaceId: nextActiveSpaceId,
		});

		persistFromStore();
	},

	setSpaceColor(spaceId, color) {
		set((state) => ({
			spaces: state.spaces.map((space) =>
				space.id === spaceId
					? {
							...space,
							color,
						}
					: space,
			),
		}));

		persistFromStore();
	},

	addPinnedSite(spaceId, site) {
		if (!isValidHttpUrl(site.url)) {
			return;
		}

		set((state) => ({
			spaces: state.spaces.map((space) => {
				if (space.id !== spaceId || space.pinnedSites.length >= MAX_PINNED_SITES) {
					return space;
				}

				const pinnedSite: PinnedSite = {
					...site,
					id: createId(),
					position: space.pinnedSites.length,
				};

				return {
					...space,
					pinnedSites: [...space.pinnedSites, pinnedSite],
				};
			}),
		}));

		persistFromStore();
	},

	removePinnedSite(spaceId, siteId) {
		set((state) => ({
			spaces: state.spaces.map((space) => {
				if (space.id !== spaceId) {
					return space;
				}

				return {
					...space,
					pinnedSites: space.pinnedSites
						.filter((site) => site.id !== siteId)
						.map((site, index) => ({
							...site,
							position: index,
						})),
				};
			}),
		}));

		persistFromStore();
	},

	reorderPinnedSites(spaceId, siteIds) {
		set((state) => ({
			spaces: state.spaces.map((space) => {
				if (space.id !== spaceId) {
					return space;
				}

				const pinnedSiteMap = new Map(space.pinnedSites.map((site) => [site.id, site]));
				const nextSites = siteIds
					.map((siteId) => pinnedSiteMap.get(siteId))
					.filter((site): site is PinnedSite => Boolean(site));

				for (const site of space.pinnedSites) {
					if (!siteIds.includes(site.id)) {
						nextSites.push(site);
					}
				}

				return {
					...space,
					pinnedSites: nextSites.map((site, index) => ({
						...site,
						position: index,
					})),
				};
			}),
		}));

		persistFromStore();
	},

	addFolder(spaceId, parentId, name) {
		const trimmedName = normalizeName(name) || 'New Folder';
		const state = get();
		const parentFolder = parentId ? state.folders[parentId] : null;

		if (!state.spaces.some((space) => space.id === spaceId)) {
			return;
		}

		if (parentId && !parentFolder) {
			return;
		}

		if (getFolderDepth(state.folders, parentId) >= MAX_FOLDER_DEPTH) {
			return;
		}

		const newFolder: Folder = {
			id: createId(),
			type: 'folder',
			spaceId,
			parentId,
			name: trimmedName,
			childIds: [],
			expanded: true,
			createdAt: Date.now(),
		};

		set((currentState) => {
			const nextFolders = {
				...currentState.folders,
				[newFolder.id]: newFolder,
			};

			const nextSpaces = currentState.spaces.map((space) => {
				if (space.id !== spaceId || parentId !== null) {
					return space;
				}

				return {
					...space,
					rootFolderIds: [...space.rootFolderIds, newFolder.id],
				};
			});

			if (parentId && currentState.folders[parentId]) {
				nextFolders[parentId] = {
					...currentState.folders[parentId],
					childIds: [...currentState.folders[parentId].childIds, newFolder.id],
					expanded: true,
				};
			}

			return {
				folders: nextFolders,
				spaces: nextSpaces,
			};
		});

		persistFromStore();
	},

	renameFolder(folderId, name) {
		const trimmedName = normalizeName(name);

		if (!trimmedName || !get().folders[folderId]) {
			return;
		}

		set((state) => ({
			folders: {
				...state.folders,
				[folderId]: {
					...state.folders[folderId],
					name: trimmedName,
				},
			},
		}));

		persistFromStore();
	},

	deleteFolder(folderId) {
		const state = get();
		const folder = state.folders[folderId];

		if (!folder) {
			return;
		}

		const descendants = collectFolderDescendants(folderId, state.folders, state.bookmarks);
		const nextFolders = { ...state.folders };
		const nextBookmarks = { ...state.bookmarks };

		for (const descendantFolderId of descendants.folderIds) {
			delete nextFolders[descendantFolderId];
		}

		for (const bookmarkId of descendants.bookmarkIds) {
			delete nextBookmarks[bookmarkId];
		}

		set((currentState) => {
			const nextSpaces = currentState.spaces.map((space) => {
				if (space.id !== folder.spaceId || folder.parentId !== null) {
					return space;
				}

				return {
					...space,
					rootFolderIds: removeFromArray(space.rootFolderIds, folderId),
				};
			});

			if (folder.parentId && currentState.folders[folder.parentId]) {
				nextFolders[folder.parentId] = {
					...currentState.folders[folder.parentId],
					childIds: removeFromArray(currentState.folders[folder.parentId].childIds, folderId),
				};
			}

			return {
				folders: nextFolders,
				bookmarks: nextBookmarks,
				spaces: nextSpaces,
			};
		});

		persistFromStore();
	},

	toggleFolder(folderId) {
		if (!get().folders[folderId]) {
			return;
		}

		set((state) => ({
			folders: {
				...state.folders,
				[folderId]: {
					...state.folders[folderId],
					expanded: !state.folders[folderId].expanded,
				},
			},
		}));

		persistFromStore();
	},

	addBookmark(spaceId, parentId, title, url) {
		const trimmedTitle = normalizeName(title) || 'New Bookmark';

		if (!isValidBookmarkUrlDraft(url)) {
			return;
		}

		const state = get();
		const parentFolder = state.folders[parentId];

		if (!parentFolder || parentFolder.spaceId !== spaceId) {
			return;
		}

		const newBookmark: Bookmark = {
			id: createId(),
			type: 'bookmark',
			spaceId,
			parentId,
			title: trimmedTitle,
			url,
			faviconUrl: getFaviconUrl(url, 16) || undefined,
			createdAt: Date.now(),
		};

		set((currentState) => ({
			bookmarks: {
				...currentState.bookmarks,
				[newBookmark.id]: newBookmark,
			},
			folders: {
				...currentState.folders,
				[parentId]: {
					...currentState.folders[parentId],
					childIds: [...currentState.folders[parentId].childIds, newBookmark.id],
					expanded: true,
				},
			},
		}));

		persistFromStore();
	},

	updateBookmark(bookmarkId, updates) {
		const bookmark = get().bookmarks[bookmarkId];

		if (!bookmark) {
			return;
		}

		if (updates.url !== undefined && !isValidBookmarkUrlDraft(updates.url)) {
			return;
		}

		const nextTitle = updates.title !== undefined ? normalizeName(updates.title) : bookmark.title;

		if (!nextTitle) {
			return;
		}

		const nextUrl = updates.url ?? bookmark.url;

		set((state) => ({
			bookmarks: {
				...state.bookmarks,
				[bookmarkId]: {
					...bookmark,
					title: nextTitle,
					url: nextUrl,
					faviconUrl: getFaviconUrl(nextUrl, 16) || undefined,
				},
			},
		}));

		persistFromStore();
	},

	deleteBookmark(bookmarkId) {
		const bookmark = get().bookmarks[bookmarkId];

		if (!bookmark) {
			return;
		}

		set((state) => {
			const nextBookmarks = { ...state.bookmarks };
			delete nextBookmarks[bookmarkId];

			return {
				bookmarks: nextBookmarks,
				folders: {
					...state.folders,
					[bookmark.parentId]: {
						...state.folders[bookmark.parentId],
						childIds: removeFromArray(state.folders[bookmark.parentId].childIds, bookmarkId),
					},
				},
			};
		});

		persistFromStore();
	},

	moveItem(itemId, itemType, newParentId, newSpaceId, newIndex) {
		const state = get();

		if (!state.spaces.some((space) => space.id === newSpaceId)) {
			return;
		}

		if (itemType === 'bookmark' && newParentId === null) {
			return;
		}

		if (newParentId && !state.folders[newParentId]) {
			return;
		}

		if (itemType === 'folder') {
			const folder = state.folders[itemId];

			if (!folder) {
				return;
			}

			if (newParentId === itemId || (newParentId && isDescendantFolder(newParentId, itemId, state.folders))) {
				return;
			}

			if (getFolderDepth(state.folders, newParentId) + getFolderSubtreeHeight(itemId, state.folders) > MAX_FOLDER_DEPTH) {
				return;
			}
		}

		const nextFolders = { ...state.folders };
		const nextBookmarks = { ...state.bookmarks };
		let nextSpaces = state.spaces.map((space) => ({ ...space, pinnedSites: [...space.pinnedSites], rootFolderIds: [...space.rootFolderIds] }));

		if (itemType === 'folder') {
			const folder = nextFolders[itemId];

			if (!folder) {
				return;
			}

			if (folder.parentId) {
				const oldParent = nextFolders[folder.parentId];

				if (oldParent) {
					nextFolders[folder.parentId] = {
						...oldParent,
						childIds: removeFromArray(oldParent.childIds, itemId),
					};
				}
			} else {
				nextSpaces = nextSpaces.map((space) =>
					space.id === folder.spaceId
						? {
								...space,
								rootFolderIds: removeFromArray(space.rootFolderIds, itemId),
							}
						: space,
				);
			}

			if (newParentId) {
				const newParent = nextFolders[newParentId];

				if (!newParent) {
					return;
				}

				nextFolders[newParentId] = {
					...newParent,
					childIds: insertAt(removeFromArray(newParent.childIds, itemId), itemId, newIndex),
					expanded: true,
				};
			} else {
				nextSpaces = nextSpaces.map((space) =>
					space.id === newSpaceId
						? {
								...space,
								rootFolderIds: insertAt(removeFromArray(space.rootFolderIds, itemId), itemId, newIndex),
							}
						: space,
				);
			}

			nextFolders[itemId] = {
				...folder,
				parentId: newParentId,
			};

			if (folder.spaceId !== newSpaceId) {
				updateFolderSubtreeSpace(itemId, newSpaceId, nextFolders, nextBookmarks);
			}
		}

		if (itemType === 'bookmark') {
			const bookmark = nextBookmarks[itemId];

			if (!bookmark || !newParentId) {
				return;
			}

			const oldParent = nextFolders[bookmark.parentId];
			const newParent = nextFolders[newParentId];

			if (!newParent) {
				return;
			}

			if (oldParent) {
				nextFolders[bookmark.parentId] = {
					...oldParent,
					childIds: removeFromArray(oldParent.childIds, itemId),
				};
			}

			nextFolders[newParentId] = {
				...newParent,
				childIds: insertAt(removeFromArray(newParent.childIds, itemId), itemId, newIndex),
				expanded: true,
			};

			nextBookmarks[itemId] = {
				...bookmark,
				parentId: newParentId,
				spaceId: newSpaceId,
			};
		}

		set({
			spaces: nextSpaces,
			folders: nextFolders,
			bookmarks: nextBookmarks,
		});

		persistFromStore();
	},

	setSearchQuery(query) {
		set({ searchQuery: query });
	},

	importData(data, mode) {
		const defaultState = storageService.getDefaultState();

		if (mode === 'replace') {
			const replacementData: StorageData = {
				spaces: data.spaces ?? defaultState.spaces,
				folders: data.folders ?? defaultState.folders,
				bookmarks: data.bookmarks ?? defaultState.bookmarks,
				activeSpaceId: data.activeSpaceId ?? data.spaces?.[0]?.id ?? defaultState.activeSpaceId,
				version: data.version ?? STORAGE_VERSION,
			};

			set(normalizeStorageData(replacementData));
			persistFromStore();
			return;
		}

		const currentState = get();
		const incomingSpaces = data.spaces ?? [];
		const mergedSpaces = [...currentState.spaces, ...incomingSpaces.filter((space) => !currentState.spaces.some((existing) => existing.id === space.id))];

		set({
			spaces: mergedSpaces,
			folders: {
				...currentState.folders,
				...(data.folders ?? {}),
			},
			bookmarks: {
				...currentState.bookmarks,
				...(data.bookmarks ?? {}),
			},
			activeSpaceId: currentState.activeSpaceId || data.activeSpaceId || mergedSpaces[0]?.id || defaultState.activeSpaceId,
			version: data.version ?? currentState.version,
		});

		persistFromStore();
	},
}));

export const appStore = useAppStore;