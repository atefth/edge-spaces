import { type CSSProperties, type HTMLAttributes, type Ref, useEffect, useRef, useState } from 'react';

import { MAX_FOLDER_DEPTH } from '../../shared/constants';
import { useAppStore } from '../../shared/store';
import { ConfirmDialog } from './ConfirmDialog';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { InlineEdit } from './InlineEdit';
import styles from './FolderItem.module.css';

interface FolderItemProps {
	folderId: string;
	depth: number;
	isEditing: boolean;
	rowAttributes?: HTMLAttributes<HTMLDivElement> & Record<string, unknown>;
	rowClassName?: string;
	rowRef?: Ref<HTMLDivElement>;
	rowStyle?: CSSProperties;
	onStartFolderRename: (itemId: string) => void;
	onStartBookmarkRename: (itemId: string) => void;
	onStartBookmarkForm: (itemId: string) => void;
	onClearEditing: () => void;
	onShowStatus: (message: string) => void;
}

function FolderIcon({ expanded }: { expanded: boolean }) {
	if (expanded) {
		return (
			<svg viewBox="0 0 24 24" className={styles.folderIcon} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
				<path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" fill="currentColor" opacity="0.2" />
				<path d="M2 10s2.5 2 5 2 5-2 5-2 2.5 2 5 2 5-2 5-2" />
				<path d="M20 6h-8.263l-1.855-2.47a1 1 0 0 0-.8-.4H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2Z" />
			</svg>
		);
	}

	return (
		<svg viewBox="0 0 24 24" className={styles.folderIcon} aria-hidden="true">
			<path d="M3.75 7.25h5l1.45 1.8H20a1.75 1.75 0 0 1 1.75 1.75v5.95A2.5 2.5 0 0 1 19.25 19H4.75a2.5 2.5 0 0 1-2.5-2.5V9a1.75 1.75 0 0 1 1.5-1.75Z" fill="currentColor" opacity="0.26" />
			<path d="M3.25 8.75A2.75 2.75 0 0 1 6 6h3.38c.54 0 1.05.25 1.38.68l.96 1.22H18A2.75 2.75 0 0 1 20.75 10v6A2.75 2.75 0 0 1 18 18.75H6A2.75 2.75 0 0 1 3.25 16Zm2.75-1.25A1.25 1.25 0 0 0 4.75 8.75V16c0 .69.56 1.25 1.25 1.25h12A1.25 1.25 0 0 0 19.25 16v-6c0-.69-.56-1.25-1.25-1.25h-6.64l-1.41-1.8A.25.25 0 0 0 9.75 6.9H6Z" fill="currentColor" />
		</svg>
	);
}

function isBrowserBookmarkUrl(url: string): boolean {
	return /^https?:\/\//i.test(url);
}

export function FolderItem({
	folderId,
	depth,
	isEditing,
	rowAttributes,
	rowClassName,
	rowRef,
	rowStyle,
	onStartFolderRename,
	onStartBookmarkRename,
	onStartBookmarkForm,
	onClearEditing,
	onShowStatus,
}: FolderItemProps) {
	const folder = useAppStore((state) => state.folders[folderId]);
	const addFolder = useAppStore((state) => state.addFolder);
	const addBookmark = useAppStore((state) => state.addBookmark);
	const deleteFolder = useAppStore((state) => state.deleteFolder);
	const renameFolder = useAppStore((state) => state.renameFolder);
	const toggleFolder = useAppStore((state) => state.toggleFolder);
	const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
	const [showDeleteDialog, setShowDeleteDialog] = useState(false);
	const clickTimeoutRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (clickTimeoutRef.current !== null) {
				window.clearTimeout(clickTimeoutRef.current);
			}
		};
	}, []);

	if (!folder) {
		return null;
	}

	const hasChildren = folder.childIds.length > 0;
	const canAddSubfolder = depth + 1 < MAX_FOLDER_DEPTH;

	function clearPendingToggle() {
		if (clickTimeoutRef.current !== null) {
			window.clearTimeout(clickTimeoutRef.current);
			clickTimeoutRef.current = null;
		}
	}

	function createSubfolder() {
		const beforeIds = new Set(Object.keys(useAppStore.getState().folders));
		addFolder(folder.spaceId, folder.id, 'New Folder');
		const nextFolder = Object.values(useAppStore.getState().folders)
			.filter((candidate) => !beforeIds.has(candidate.id) && candidate.parentId === folder.id)
			.sort((left, right) => right.createdAt - left.createdAt)[0];

		if (nextFolder) {
			onStartFolderRename(nextFolder.id);
		}
	}

	function createBookmarkFromTemplate(title: string, url: string, startEditing = false) {
		const beforeIds = new Set(Object.keys(useAppStore.getState().bookmarks));
		addBookmark(folder.spaceId, folder.id, title, url);
		const nextBookmark = Object.values(useAppStore.getState().bookmarks)
			.filter((candidate) => !beforeIds.has(candidate.id) && candidate.parentId === folder.id)
			.sort((left, right) => right.createdAt - left.createdAt)[0];

		if (nextBookmark && startEditing) {
			onStartBookmarkRename(nextBookmark.id);
		}
	}

	async function addCurrentTab() {
		const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
		const url = activeTab?.url?.trim() ?? '';

		if (!isBrowserBookmarkUrl(url)) {
			onShowStatus('This page cannot be added as a bookmark');
			return;
		}

		createBookmarkFromTemplate(activeTab?.title?.trim() || 'Current Tab', url);
		onShowStatus(`Bookmark added to ${folder.name}`);
	}

	function handleDelete() {
		if (!hasChildren) {
			deleteFolder(folder.id);
			return;
		}

		setShowDeleteDialog(true);
	}

	function openMenu(x: number, y: number) {
		setContextMenuPosition({ x, y });
	}

	const menuItems: ContextMenuItem[] = [
		{
			label: 'New Bookmark',
			onClick: () => {
				createBookmarkFromTemplate('New Bookmark', 'https://', true);
			},
		},
		{
			label: 'New Subfolder',
			disabled: !canAddSubfolder,
			onClick: createSubfolder,
		},
		{
			label: 'Add Current Tab',
			onClick: () => {
				void addCurrentTab();
			},
		},
		{ label: 'Rename', onClick: () => onStartFolderRename(folder.id) },
		{ label: 'Delete', destructive: true, onClick: handleDelete },
	];

	return (
		<>
			<div
				ref={rowRef}
				className={`${styles.row} ${rowClassName ?? ''}`.trim()}
				style={{ ...rowStyle, '--node-depth': depth } as CSSProperties}
				{...rowAttributes}
				onContextMenu={(event) => {
					rowAttributes?.onContextMenu?.(event);

					if (event.defaultPrevented) {
						return;
					}

					event.preventDefault();
					openMenu(event.clientX, event.clientY);
				}}
			>
				<div className={styles.content}>
					<div className={styles.labelRow}>
						<FolderIcon expanded={folder.expanded} />
						{isEditing ? (
							<InlineEdit
								value={folder.name}
								onCancel={onClearEditing}
								onSave={(nextName) => {
									renameFolder(folder.id, nextName);
									onClearEditing();
								}}
							/>
						) : (
							<button
								type="button"
								className={styles.labelButton}
								onClick={(event) => {
									if (event.detail !== 1) {
										return;
									}

									clearPendingToggle();
									clickTimeoutRef.current = window.setTimeout(() => {
										toggleFolder(folder.id);
										clickTimeoutRef.current = null;
									}, 180);
								}}
								onDoubleClick={(event) => {
									event.preventDefault();
									clearPendingToggle();
									onStartFolderRename(folder.id);
								}}
							>
								<span className={styles.label}>{folder.name}</span>
							</button>
						)}
					</div>
				</div>

				<button
					type="button"
					className={styles.menuButton}
					onClick={(event) => {
						const rect = event.currentTarget.getBoundingClientRect();
						openMenu(rect.right - 8, rect.bottom + 6);
					}}
					aria-label={`Folder actions for ${folder.name}`}
				>
					⋯
				</button>
			</div>

			{contextMenuPosition ? (
				<ContextMenu
					items={menuItems}
					position={contextMenuPosition}
					onClose={() => setContextMenuPosition(null)}
				/>
			) : null}

			{showDeleteDialog ? (
				<ConfirmDialog
					title="Delete folder?"
					message={`Everything inside "${folder.name}" will be removed.`}
					confirmLabel="Delete"
					destructive
					onCancel={() => setShowDeleteDialog(false)}
					onConfirm={() => {
						deleteFolder(folder.id);
						setShowDeleteDialog(false);
					}}
				/>
			) : null}
		</>
	);
}