import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useAppStore } from '../../shared/store';
import type { TreeItemType } from '../../shared/types';
import { ConfirmDialog } from './ConfirmDialog';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { getSpaceRootDndId, getTreeItemDndId, useTreeDnd } from './TreeDndProvider';
import { TreeNode } from './TreeNode';
import { useKeyboardNavigation } from './useKeyboardNavigation';
import styles from './FolderTree.module.css';

interface FolderTreeProps {
	onOpenImport: () => void;
}
type EditingState =
	| { itemId: string; mode: 'folder-name' }
	| { itemId: string; mode: 'bookmark-name' }
	| { itemId: string; mode: 'bookmark-form' }
	| null;

interface FolderChoice {
	id: string;
	label: string;
}

interface DeleteCandidate {
	itemId: string;
	itemType: TreeItemType;
	nextFocusId: string | null;
}


function isBrowserBookmarkUrl(url: string): boolean {
	return /^https?:\/\//i.test(url);
}

function getCurrentTabBookmarkData(tab: chrome.tabs.Tab | undefined): { title: string; url: string } | null {
	const url = tab?.url?.trim() ?? '';

	if (!isBrowserBookmarkUrl(url)) {
		return null;
	}

	const fallbackTitle = (() => {
		try {
			return new URL(url).hostname;
		} catch {
			return 'Current Tab';
		}
	})();

	return {
		title: tab?.title?.trim() || fallbackTitle,
		url,
	};
}

function flattenFolderChoices(
	rootFolderIds: string[],
	folders: ReturnType<typeof useAppStore.getState>['folders'],
	depth = 0,
): FolderChoice[] {
	return rootFolderIds.flatMap((folderId) => {
		const folder = folders[folderId];

		if (!folder) {
			return [];
		}

		const children = flattenFolderChoices(
			folder.childIds.filter((childId) => Boolean(folders[childId])),
			folders,
			depth + 1,
		);

		return [
			{
				id: folder.id,
				label: `${depth > 0 ? `${'  '.repeat(depth)}↳ ` : ''}${folder.name}`,
			},
			...children,
		];
	});
}

function flattenVisibleTreeItems(
	itemIds: string[],
	folders: ReturnType<typeof useAppStore.getState>['folders'],
	bookmarks: ReturnType<typeof useAppStore.getState>['bookmarks'],
): Array<{
	id: string;
	itemType: TreeItemType;
	parentId: string | null;
	spaceId: string;
	expanded?: boolean;
	childIds?: string[];
}> {
	return itemIds.flatMap((itemId) => {
		if (folders[itemId]) {
			const folder = folders[itemId];
			return [
				{
					id: folder.id,
					itemType: 'folder' as const,
					parentId: folder.parentId,
					spaceId: folder.spaceId,
					expanded: folder.expanded,
					childIds: folder.childIds,
				},
				...(folder.expanded ? flattenVisibleTreeItems(folder.childIds, folders, bookmarks) : []),
			];
		}

		if (bookmarks[itemId]) {
			return [
				{
					id: itemId,
					itemType: 'bookmark' as const,
					parentId: bookmarks[itemId].parentId,
					spaceId: bookmarks[itemId].spaceId,
				},
			];
		}

		return [];
	});
}

export function FolderTree({ onOpenImport }: FolderTreeProps) {
	const spaces = useAppStore((state) => state.spaces);
	const folders = useAppStore((state) => state.folders);
	const bookmarks = useAppStore((state) => state.bookmarks);
	const activeSpaceId = useAppStore((state) => state.activeSpaceId);
	const addFolder = useAppStore((state) => state.addFolder);
	const addBookmark = useAppStore((state) => state.addBookmark);
	const deleteBookmark = useAppStore((state) => state.deleteBookmark);
	const deleteFolder = useAppStore((state) => state.deleteFolder);
	const { activeItem, preview } = useTreeDnd();
	const activeSpace = spaces.find((space) => space.id === activeSpaceId) ?? null;
	const toastTimeoutRef = useRef<number | null>(null);
	const previousEditingStateRef = useRef<EditingState | null>(null);
	const [editingState, setEditingState] = useState<EditingState>(null);
	const [deleteCandidate, setDeleteCandidate] = useState<DeleteCandidate | null>(null);
	const [folderPicker, setFolderPicker] = useState<{ items: ContextMenuItem[]; x: number; y: number } | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	const folderChoices = useMemo(
		() => (activeSpace ? flattenFolderChoices(activeSpace.rootFolderIds, folders) : []),
		[activeSpace, folders],
	);
	const visibleTreeItems = useMemo(
		() => (activeSpace ? flattenVisibleTreeItems(activeSpace.rootFolderIds, folders, bookmarks) : []),
		[activeSpace, bookmarks, folders],
	);
	const visibleTreeIds = useMemo(() => visibleTreeItems.map((item) => getTreeItemDndId(item.id)), [visibleTreeItems]);
	const { setNodeRef: setRootDropRef, isOver: isRootDropHovered } = useDroppable({
		id: getSpaceRootDndId(activeSpaceId),
		data: {
			kind: 'space-root',
			spaceId: activeSpaceId,
		},
	});

	useEffect(() => {
		return () => {
			if (toastTimeoutRef.current !== null) {
				window.clearTimeout(toastTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (!editingState) {
			return;
		}

		const state = useAppStore.getState();
		const itemExists = editingState.mode === 'folder-name'
			? Boolean(state.folders[editingState.itemId])
			: Boolean(state.bookmarks[editingState.itemId]);

		if (!itemExists) {
			setEditingState(null);
		}
	}, [editingState, folders]);

	useEffect(() => {
		setEditingState(null);
		setFolderPicker(null);
		setDeleteCandidate(null);
	}, [activeSpaceId]);

	const { focusItem, getTreeItemProps, getTreeProps } = useKeyboardNavigation({
		items: visibleTreeItems,
		editingItemId: editingState?.itemId ?? null,
		onStartFolderRename: (itemId) => setEditingState({ itemId, mode: 'folder-name' }),
		onStartBookmarkRename: (itemId) => setEditingState({ itemId, mode: 'bookmark-name' }),
		onStartBookmarkForm: (itemId) => setEditingState({ itemId, mode: 'bookmark-form' }),
		onRequestDelete: setDeleteCandidate,
		onShowStatus: showStatus,
	});

	useEffect(() => {
		const previousEditingState = previousEditingStateRef.current;
		previousEditingStateRef.current = editingState;

		if (previousEditingState && !editingState) {
			focusItem(previousEditingState.itemId);
		}
	}, [editingState, focusItem]);

	function showStatus(message: string) {
		setStatusMessage(message);

		if (toastTimeoutRef.current !== null) {
			window.clearTimeout(toastTimeoutRef.current);
		}

		toastTimeoutRef.current = window.setTimeout(() => {
			setStatusMessage(null);
			toastTimeoutRef.current = null;
		}, 1800);
	}

	function createRootFolder() {
		if (!activeSpaceId) {
			return;
		}

		const beforeIds = new Set(Object.keys(useAppStore.getState().folders));
		addFolder(activeSpaceId, null, 'New Folder');
		const nextFolder = Object.values(useAppStore.getState().folders)
			.filter((folder) => !beforeIds.has(folder.id) && folder.spaceId === activeSpaceId && folder.parentId === null)
			.sort((left, right) => right.createdAt - left.createdAt)[0];

		if (nextFolder) {
			setEditingState({ itemId: nextFolder.id, mode: 'folder-name' });
		}
	}

	async function addCurrentTabToFolder(folderId: string) {
		if (!activeSpaceId) {
			return;
		}

		const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
		const bookmarkData = getCurrentTabBookmarkData(activeTab);

		if (!bookmarkData) {
			showStatus('This page cannot be added as a bookmark');
			return;
		}

		addBookmark(activeSpaceId, folderId, bookmarkData.title, bookmarkData.url);
		showStatus('Current tab added');
	}

	async function handleAddCurrentTab(button: HTMLButtonElement | null) {
		if (!activeSpace || !button) {
			return;
		}

		if (folderChoices.length === 0) {
			showStatus('Create a folder first');
			return;
		}

		if (folderChoices.length === 1) {
			await addCurrentTabToFolder(folderChoices[0].id);
			return;
		}

		const rect = button.getBoundingClientRect();

		setFolderPicker({
			x: rect.left,
			y: rect.bottom + 8,
			items: folderChoices.map((folder) => ({
				label: folder.label,
				onClick: () => {
					void addCurrentTabToFolder(folder.id);
				},
			})),
		});
	}

	if (!activeSpace) {
		return null;
	}

	const isRootDropTarget = Boolean(activeItem) && preview?.mode === 'root' && preview.targetSpaceId === activeSpaceId;
	const isRootDropInvalid = isRootDropTarget && Boolean(preview?.invalidReason);

	return (
		<div className={styles.panel}>
			<div className={styles.toolbar}>
				<button type="button" className={styles.primaryButton} onClick={createRootFolder}>
					+ New Folder
				</button>
				<button
					type="button"
					className={styles.secondaryButton}
					onClick={(event) => {
						void handleAddCurrentTab(event.currentTarget);
					}}
				>
					+ Add Current Tab
				</button>
			</div>

			{activeSpace.rootFolderIds.length === 0 ? (
				<div
					ref={setRootDropRef}
					className={`${styles.emptyState} ${isRootDropTarget ? styles.emptyStateDropTarget : ''} ${isRootDropInvalid ? styles.emptyStateDropInvalid : ''}`}
					tabIndex={-1}
					data-tree-root="true"
				>
					<div className={styles.emptyTitle}>No bookmarks yet</div>
					<p className={styles.emptyMessage}>Create a folder or import your Arc export to start building this space.</p>
					<div className={styles.emptyActions}>
						<button type="button" className={styles.emptyAction} onClick={createRootFolder}>
							Add Folder
						</button>
						<button type="button" className={styles.emptySecondaryAction} onClick={onOpenImport}>
							Import from Arc
						</button>
					</div>
				</div>
			) : (
				<SortableContext items={visibleTreeIds} strategy={verticalListSortingStrategy}>
					<div
						className={styles.tree}
						tabIndex={-1}
						data-tree-root="true"
						role="tree"
						aria-label="Bookmarks"
						{...getTreeProps()}
					>
						{activeSpace.rootFolderIds.map((folderId) => (
							<TreeNode
								key={folderId}
								itemId={folderId}
								itemType="folder"
								depth={0}
								editingState={editingState}
								onClearEditing={() => setEditingState(null)}
								onShowStatus={showStatus}
								onStartBookmarkForm={(itemId) => setEditingState({ itemId, mode: 'bookmark-form' })}
								onStartFolderRename={(itemId) => setEditingState({ itemId, mode: 'folder-name' })}
								onStartBookmarkRename={(itemId) => setEditingState({ itemId, mode: 'bookmark-name' })}
								getTreeItemProps={getTreeItemProps}
							/>
						))}
						<div
							ref={setRootDropRef}
							className={`${styles.rootDropZone} ${isRootDropTarget || isRootDropHovered ? styles.rootDropZoneActive : ''} ${isRootDropInvalid ? styles.rootDropZoneInvalid : ''}`}
							aria-hidden="true"
						/>
					</div>
				</SortableContext>
			)}

			<div className={styles.srOnly} aria-live="polite" aria-atomic="true">
				{statusMessage}
			</div>

			{statusMessage ? <div className={styles.toast} role="status">{statusMessage}</div> : null}

			{folderPicker ? (
				<ContextMenu
					items={folderPicker.items}
					position={{ x: folderPicker.x, y: folderPicker.y }}
					onClose={() => setFolderPicker(null)}
				/>
			) : null}

			{deleteCandidate ? (
				<ConfirmDialog
					title={deleteCandidate.itemType === 'folder' ? 'Delete folder?' : 'Delete bookmark?'}
					message={deleteCandidate.itemType === 'folder'
						? `Everything inside "${folders[deleteCandidate.itemId]?.name ?? 'this folder'}" will be removed.`
						: `"${bookmarks[deleteCandidate.itemId]?.title ?? 'This bookmark'}" will be removed.`}
					confirmLabel="Delete"
					destructive
					onCancel={() => setDeleteCandidate(null)}
					onConfirm={() => {
						if (deleteCandidate.itemType === 'folder') {
							deleteFolder(deleteCandidate.itemId);
							showStatus('Folder deleted');
						} else {
							deleteBookmark(deleteCandidate.itemId);
							showStatus('Bookmark deleted');
						}

						setDeleteCandidate(null);
						focusItem(deleteCandidate.nextFocusId, true);
					}}
				/>
			) : null}
		</div>
	);
}