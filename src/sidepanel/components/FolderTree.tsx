import { useEffect, useMemo, useRef, useState } from 'react';

import { useAppStore } from '../../shared/store';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { TreeNode } from './TreeNode';
import styles from './FolderTree.module.css';

type EditingState =
	| { itemId: string; mode: 'folder-name' }
	| { itemId: string; mode: 'bookmark-name' }
	| { itemId: string; mode: 'bookmark-form' }
	| null;

interface FolderChoice {
	id: string;
	label: string;
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

export function FolderTree() {
	const spaces = useAppStore((state) => state.spaces);
	const folders = useAppStore((state) => state.folders);
	const activeSpaceId = useAppStore((state) => state.activeSpaceId);
	const addFolder = useAppStore((state) => state.addFolder);
	const addBookmark = useAppStore((state) => state.addBookmark);
	const activeSpace = spaces.find((space) => space.id === activeSpaceId) ?? null;
	const toastTimeoutRef = useRef<number | null>(null);
	const [editingState, setEditingState] = useState<EditingState>(null);
	const [folderPicker, setFolderPicker] = useState<{ items: ContextMenuItem[]; x: number; y: number } | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);

	const folderChoices = useMemo(
		() => (activeSpace ? flattenFolderChoices(activeSpace.rootFolderIds, folders) : []),
		[activeSpace, folders],
	);

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
	}, [activeSpaceId]);

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
				<div className={styles.emptyState}>
					<div className={styles.emptyTitle}>No bookmarks yet</div>
					<p className={styles.emptyMessage}>Create a folder to start building this space.</p>
					<button type="button" className={styles.emptyAction} onClick={createRootFolder}>
						Add Folder
					</button>
				</div>
			) : (
				<div className={styles.tree}>
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
						/>
					))}
				</div>
			)}

			{statusMessage ? <div className={styles.toast}>{statusMessage}</div> : null}

			{folderPicker ? (
				<ContextMenu
					items={folderPicker.items}
					position={{ x: folderPicker.x, y: folderPicker.y }}
					onClose={() => setFolderPicker(null)}
				/>
			) : null}
		</div>
	);
}