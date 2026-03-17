import { type HTMLAttributes, type KeyboardEvent as ReactKeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useAppStore } from '../../shared/store';
import type { Folder, TreeItemType } from '../../shared/types';

interface TreeNavigationItem {
	id: string;
	itemType: TreeItemType;
	parentId: string | null;
	spaceId: string;
	expanded?: boolean;
	childIds?: string[];
}

interface DeleteRequest {
	itemId: string;
	itemType: TreeItemType;
	nextFocusId: string | null;
}

interface UseKeyboardNavigationOptions {
	items: TreeNavigationItem[];
	editingItemId: string | null;
	onStartFolderRename: (itemId: string) => void;
	onStartBookmarkRename: (itemId: string) => void;
	onStartBookmarkForm: (itemId: string) => void;
	onRequestDelete: (request: DeleteRequest) => void;
	onShowStatus: (message: string) => void;
}

function focusTreeItem(itemId: string | null, shouldScroll = false): void {
	if (!itemId) {
		return;
	}

	window.requestAnimationFrame(() => {
		const row = document.querySelector<HTMLElement>(`[data-tree-item-id="${itemId}"]`);

		if (!row) {
			return;
		}

		if (shouldScroll) {
			row.scrollIntoView({ block: 'nearest' });
		}

		row.focus();
	});
}

function findCurrentItemId(target: EventTarget | null): string | null {
	if (!(target instanceof HTMLElement)) {
		return null;
	}

	return target.closest<HTMLElement>('[data-tree-item-id]')?.dataset.treeItemId ?? null;
}

function collectDescendantIds(folderId: string, folders: Record<string, Folder>): Set<string> {
	const descendants = new Set<string>([folderId]);
	const queue = [folderId];

	while (queue.length > 0) {
		const currentId = queue.shift();

		if (!currentId) {
			continue;
		}

		const folder = folders[currentId];

		if (!folder) {
			continue;
		}

		for (const childId of folder.childIds) {
			descendants.add(childId);

			if (folders[childId]) {
				queue.push(childId);
			}
		}
	}

	return descendants;
}

export function useKeyboardNavigation({
	items,
	editingItemId,
	onStartFolderRename,
	onStartBookmarkRename,
	onStartBookmarkForm,
	onRequestDelete,
	onShowStatus,
}: UseKeyboardNavigationOptions) {
	const addBookmark = useAppStore((state) => state.addBookmark);
	const bookmarks = useAppStore((state) => state.bookmarks);
	const folders = useAppStore((state) => state.folders);
	const toggleFolder = useAppStore((state) => state.toggleFolder);
	const [focusedItemId, setFocusedItemId] = useState<string | null>(null);
	const pendingFocusIdRef = useRef<string | null>(null);
	const itemMap = useMemo(() => new Map(items.map((item) => [item.id, item])), [items]);

	const focusItem = useCallback((itemId: string | null, shouldScroll = false) => {
		setFocusedItemId(itemId);
		focusTreeItem(itemId, shouldScroll);
	}, []);

	useEffect(() => {
		if (pendingFocusIdRef.current && itemMap.has(pendingFocusIdRef.current)) {
			const nextFocusId = pendingFocusIdRef.current;
			pendingFocusIdRef.current = null;
			focusItem(nextFocusId, true);
			return;
		}

		if (focusedItemId && itemMap.has(focusedItemId)) {
			return;
		}

		setFocusedItemId(items[0]?.id ?? null);
	}, [focusItem, focusedItemId, itemMap, items]);

	const moveFocus = useCallback(
		(direction: -1 | 1, currentItemId: string | null) => {
			if (items.length === 0) {
				return;
			}

			if (!currentItemId) {
				focusItem(direction > 0 ? items[0]?.id ?? null : items.at(-1)?.id ?? null, true);
				return;
			}

			const currentIndex = items.findIndex((item) => item.id === currentItemId);
			const nextIndex = Math.max(0, Math.min(items.length - 1, currentIndex + direction));
			focusItem(items[nextIndex]?.id ?? currentItemId, true);
		},
		[focusItem, items],
	);

	const getNextFocusIdAfterDelete = useCallback(
		(itemId: string, itemType: TreeItemType): string | null => {
			const currentItem = itemMap.get(itemId);

			if (!currentItem) {
				return null;
			}

			const removedIds = itemType === 'folder' ? collectDescendantIds(itemId, folders) : new Set([itemId]);
			const firstRemovedIndex = items.findIndex((item) => removedIds.has(item.id));

			if (firstRemovedIndex === -1) {
				return currentItem.parentId;
			}

			for (let index = firstRemovedIndex + 1; index < items.length; index += 1) {
				if (!removedIds.has(items[index].id)) {
					return items[index].id;
				}
			}

			for (let index = firstRemovedIndex - 1; index >= 0; index -= 1) {
				if (!removedIds.has(items[index].id)) {
					return items[index].id;
				}
			}

			return currentItem.parentId;
		},
		[folders, itemMap, items],
	);

	const handleTreeKeyDown = useCallback(
		(event: ReactKeyboardEvent<HTMLDivElement>) => {
			const target = event.target as HTMLElement;
			const tagName = target.tagName;
			const isTypingTarget = tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || target.isContentEditable;

			if (editingItemId || (isTypingTarget && event.key !== 'Escape')) {
				return;
			}

			const currentItemId = findCurrentItemId(event.target) ?? focusedItemId;
			const currentItem = currentItemId ? itemMap.get(currentItemId) ?? null : null;

			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'n') {
				event.preventDefault();

				if (!currentItem) {
					return;
				}

				const targetFolderId = currentItem.itemType === 'folder' ? currentItem.id : currentItem.parentId;
				const targetFolder = targetFolderId ? useAppStore.getState().folders[targetFolderId] : null;

				if (!targetFolderId || !targetFolder) {
					return;
				}

				const beforeIds = new Set(Object.keys(useAppStore.getState().bookmarks));
				addBookmark(targetFolder.spaceId, targetFolderId, 'New Bookmark', 'https://');
				const nextBookmark = Object.values(useAppStore.getState().bookmarks).find((bookmark) => !beforeIds.has(bookmark.id));

				if (nextBookmark) {
					onShowStatus(`Bookmark added to ${targetFolder.name}`);
					onStartBookmarkForm(nextBookmark.id);
					pendingFocusIdRef.current = nextBookmark.id;
				}

				return;
			}

			switch (event.key) {
				case 'ArrowDown':
					event.preventDefault();
					moveFocus(1, currentItemId);
					break;
				case 'ArrowUp':
					event.preventDefault();
					moveFocus(-1, currentItemId);
					break;
				case 'ArrowRight': {
					if (!currentItem || currentItem.itemType !== 'folder') {
						return;
					}

					event.preventDefault();

					if (!currentItem.expanded) {
						toggleFolder(currentItem.id);
						return;
					}

					focusItem(currentItem.childIds?.[0] ?? currentItem.id, true);
					break;
				}
				case 'ArrowLeft': {
					if (!currentItem) {
						return;
					}

					event.preventDefault();

					if (currentItem.itemType === 'folder' && currentItem.expanded) {
						toggleFolder(currentItem.id);
						return;
					}

					focusItem(currentItem.parentId, true);
					break;
				}
				case 'Enter': {
					if (!currentItem) {
						return;
					}

					event.preventDefault();

					if (currentItem.itemType === 'folder') {
						toggleFolder(currentItem.id);
						return;
					}

					const bookmark = bookmarks[currentItem.id];

					if (!bookmark) {
						return;
					}

					void chrome.tabs.update({ url: bookmark.url }).catch(() => {
						onShowStatus('Unable to open bookmark');
					});
					break;
				}
				case 'Backspace':
				case 'Delete':
					if (!currentItem) {
						return;
					}

					event.preventDefault();
					onRequestDelete({
						itemId: currentItem.id,
						itemType: currentItem.itemType,
						nextFocusId: getNextFocusIdAfterDelete(currentItem.id, currentItem.itemType),
					});
					break;
				case 'F2':
					if (!currentItem) {
						return;
					}

					event.preventDefault();

					if (currentItem.itemType === 'folder') {
						onStartFolderRename(currentItem.id);
						return;
					}

					onStartBookmarkRename(currentItem.id);
					break;
				default:
					break;
			}
		},
		[
			addBookmark,
			bookmarks,
			editingItemId,
			focusItem,
			focusedItemId,
			getNextFocusIdAfterDelete,
			itemMap,
			moveFocus,
			onRequestDelete,
			onShowStatus,
			onStartBookmarkForm,
			onStartBookmarkRename,
			onStartFolderRename,
			toggleFolder,
		],
	);

	const getTreeProps = useCallback(
		(): HTMLAttributes<HTMLDivElement> => ({
			onKeyDown: handleTreeKeyDown,
			onFocus: (event) => {
				if (event.target !== event.currentTarget) {
					return;
				}

				focusItem(focusedItemId ?? items[0]?.id ?? null, true);
			},
		}),
		[focusItem, focusedItemId, handleTreeKeyDown, items],
	);

	const getTreeItemProps = useCallback(
		(itemId: string): HTMLAttributes<HTMLDivElement> & { tabIndex: number; 'aria-selected': boolean } => ({
			tabIndex: focusedItemId === itemId ? 0 : -1,
			'aria-selected': focusedItemId === itemId,
			onFocusCapture: () => {
				setFocusedItemId(itemId);
			},
			onMouseDown: () => {
				setFocusedItemId(itemId);
			},
		}),
		[focusedItemId],
	);

	return {
		focusedItemId,
		focusItem,
		getTreeProps,
		getTreeItemProps,
	};
}