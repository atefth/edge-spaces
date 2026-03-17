import {
	DndContext,
	DragOverlay,
	type DragEndEvent,
	type DragOverEvent,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import {
	createContext,
	type ReactNode,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from 'react';

import { DND_AUTO_EXPAND_MS, MAX_FOLDER_DEPTH } from '../../shared/constants';
import { getFaviconUrl } from '../../shared/favicon';
import { useAppStore } from '../../shared/store';
import type { Bookmark, Folder, TreeItemType } from '../../shared/types';
import styles from './TreeDndProvider.module.css';

type DropTargetKind = 'tree-item' | 'space-tab' | 'space-root';

interface TreeDragItem {
	itemId: string;
	itemType: TreeItemType;
}

export interface TreeDropPreview {
	kind: DropTargetKind;
	overItemId?: string;
	mode: 'before' | 'after' | 'inside' | 'root';
	targetParentId: string | null;
	targetSpaceId: string;
	targetIndex: number;
	invalidReason: string | null;
}

interface TreeDndContextValue {
	activeItem: TreeDragItem | null;
	preview: TreeDropPreview | null;
	instructionsId: string;
	liveMessage: string;
}

interface TreeDndProviderProps {
	children: ReactNode;
}

interface TreeItemMeta {
	itemId: string;
	itemType: TreeItemType;
	parentId: string | null;
	spaceId: string;
}

interface ParsedDropId {
	kind: DropTargetKind;
	itemId?: string;
	spaceId?: string;
}

const TreeDndContextValue = createContext<TreeDndContextValue>({
	activeItem: null,
	preview: null,
	instructionsId: 'tree-dnd-instructions',
	liveMessage: '',
});

const treeInstructionText = 'Press space to pick up an item, arrow keys to move it, and space again to drop it.';

export function getTreeItemDndId(itemId: string): string {
	return `tree:${itemId}`;
}

export function getSpaceTabDndId(spaceId: string): string {
	return `space-tab:${spaceId}`;
}

export function getSpaceRootDndId(spaceId: string): string {
	return `space-root:${spaceId}`;
}

function parseDropId(rawId: string): ParsedDropId | null {
	if (rawId.startsWith('tree:')) {
		return { kind: 'tree-item', itemId: rawId.slice(5) };
	}

	if (rawId.startsWith('space-tab:')) {
		return { kind: 'space-tab', spaceId: rawId.slice(10) };
	}

	if (rawId.startsWith('space-root:')) {
		return { kind: 'space-root', spaceId: rawId.slice(11) };
	}

	return null;
}

function getTreeItemMeta(itemId: string): TreeItemMeta | null {
	const state = useAppStore.getState();
	const folder = state.folders[itemId];

	if (folder) {
		return {
			itemId,
			itemType: 'folder',
			parentId: folder.parentId,
			spaceId: folder.spaceId,
		};
	}

	const bookmark = state.bookmarks[itemId];

	if (!bookmark) {
		return null;
	}

	return {
		itemId,
		itemType: 'bookmark',
		parentId: bookmark.parentId,
		spaceId: bookmark.spaceId,
	};
}

function getFolderDepth(parentId: string | null, folders: Record<string, Folder>): number {
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

function getSiblingIds(parentId: string | null, spaceId: string): string[] {
	const state = useAppStore.getState();

	if (parentId) {
		return state.folders[parentId]?.childIds ?? [];
	}

	return state.spaces.find((space) => space.id === spaceId)?.rootFolderIds ?? [];
}

function toRowTransform(transform: { x: number; y: number; scaleX: number; scaleY: number } | null): string | undefined {
	if (!transform) {
		return undefined;
	}

	return `translate3d(${Math.round(transform.x)}px, ${Math.round(transform.y)}px, 0) scaleX(${transform.scaleX}) scaleY(${transform.scaleY})`;
}

function getPointerCenterY(event: DragOverEvent | DragEndEvent): number | null {
	const translatedRect = event.active.rect.current.translated;

	if (translatedRect) {
		return translatedRect.top + translatedRect.height / 2;
	}

	const initialRect = event.active.rect.current.initial;

	if (initialRect) {
		return initialRect.top + initialRect.height / 2;
	}

	return null;
}

function getInvalidReason(activeItem: TreeDragItem, targetParentId: string | null): string | null {
	const state = useAppStore.getState();

	if (activeItem.itemType === 'bookmark' && targetParentId === null) {
		return 'Bookmarks must stay inside folders';
	}

	if (activeItem.itemType !== 'folder') {
		return null;
	}

	if (targetParentId === activeItem.itemId) {
		return 'Folders cannot be dropped into themselves';
	}

	if (targetParentId && isDescendantFolder(targetParentId, activeItem.itemId, state.folders)) {
		return 'Folders cannot be dropped into their descendants';
	}

	const subtreeHeight = getFolderSubtreeHeight(activeItem.itemId, state.folders);
	const parentDepth = getFolderDepth(targetParentId, state.folders);

	if (parentDepth + subtreeHeight > MAX_FOLDER_DEPTH) {
		return 'That move would exceed the maximum folder depth';
	}

	return null;
}

function buildPreview(event: DragOverEvent | DragEndEvent, activeItem: TreeDragItem): TreeDropPreview | null {
	if (!event.over) {
		return null;
	}

	const over = parseDropId(String(event.over.id));
	const activeMeta = getTreeItemMeta(activeItem.itemId);

	if (!over || !activeMeta) {
		return null;
	}

	if (over.kind === 'space-tab' || over.kind === 'space-root') {
		const targetSpaceId = over.spaceId ?? activeMeta.spaceId;
		const siblingIds = getSiblingIds(null, targetSpaceId);
		let targetIndex = siblingIds.length;

		if (activeMeta.parentId === null && activeMeta.spaceId === targetSpaceId) {
			const currentIndex = siblingIds.indexOf(activeMeta.itemId);

			if (currentIndex !== -1 && currentIndex < targetIndex) {
				targetIndex -= 1;
			}
		}

		return {
			kind: over.kind,
			mode: 'root',
			targetParentId: null,
			targetSpaceId,
			targetIndex,
			invalidReason: getInvalidReason(activeItem, null),
		};
	}

	const targetMeta = over.itemId ? getTreeItemMeta(over.itemId) : null;

	if (!targetMeta) {
		return null;
	}

	const state = useAppStore.getState();
	const targetFolder = targetMeta.itemType === 'folder' ? state.folders[targetMeta.itemId] : null;
	const pointerCenterY = getPointerCenterY(event);
	const overRect = event.over.rect;
	let mode: TreeDropPreview['mode'] = 'after';

	if (targetFolder && pointerCenterY !== null) {
		const insideTop = overRect.top + overRect.height * 0.3;
		const insideBottom = overRect.bottom - overRect.height * 0.3;

		if (pointerCenterY >= insideTop && pointerCenterY <= insideBottom) {
			mode = 'inside';
		} else if (pointerCenterY < overRect.top + overRect.height / 2) {
			mode = 'before';
		} else {
			mode = 'after';
		}
	} else if (pointerCenterY !== null && pointerCenterY < overRect.top + overRect.height / 2) {
		mode = 'before';
	}

	if (mode === 'inside' && targetFolder) {
		return {
			kind: 'tree-item',
			overItemId: targetFolder.id,
			mode,
			targetParentId: targetFolder.id,
			targetSpaceId: targetFolder.spaceId,
			targetIndex: targetFolder.childIds.length,
			invalidReason: getInvalidReason(activeItem, targetFolder.id),
		};
	}

	const siblingIds = getSiblingIds(targetMeta.parentId, targetMeta.spaceId);
	const targetSiblingIndex = siblingIds.indexOf(targetMeta.itemId);
	let targetIndex = targetSiblingIndex + (mode === 'after' ? 1 : 0);

	if (activeMeta.parentId === targetMeta.parentId && activeMeta.spaceId === targetMeta.spaceId) {
		const activeSiblingIndex = siblingIds.indexOf(activeMeta.itemId);

		if (activeSiblingIndex !== -1 && activeSiblingIndex < targetIndex) {
			targetIndex -= 1;
		}
	}

	return {
		kind: 'tree-item',
		overItemId: targetMeta.itemId,
		mode,
		targetParentId: targetMeta.parentId,
		targetSpaceId: targetMeta.spaceId,
		targetIndex,
		invalidReason: getInvalidReason(activeItem, targetMeta.parentId),
	};
}

function FolderOverlayIcon() {
	return (
		<svg viewBox="0 0 24 24" className={styles.overlayFolderIcon} aria-hidden="true">
			<path d="M3.75 7.25h5l1.45 1.8H20a1.75 1.75 0 0 1 1.75 1.75v5.95A2.5 2.5 0 0 1 19.25 19H4.75a2.5 2.5 0 0 1-2.5-2.5V9a1.75 1.75 0 0 1 1.5-1.75Z" opacity="0.26" />
			<path d="M3.25 8.75A2.75 2.75 0 0 1 6 6h3.38c.54 0 1.05.25 1.38.68l.96 1.22H18A2.75 2.75 0 0 1 20.75 10v6A2.75 2.75 0 0 1 18 18.75H6A2.75 2.75 0 0 1 3.25 16Zm2.75-1.25A1.25 1.25 0 0 0 4.75 8.75V16c0 .69.56 1.25 1.25 1.25h12A1.25 1.25 0 0 0 19.25 16v-6c0-.69-.56-1.25-1.25-1.25h-6.64l-1.41-1.8A.25.25 0 0 0 9.75 6.9H6Z" />
		</svg>
	);
}

function BookmarkOverlayIcon({ bookmark }: { bookmark: Bookmark }) {
	const [hasImageError, setHasImageError] = useState(false);
	const faviconUrl = bookmark.faviconUrl || getFaviconUrl(bookmark.url, 16);

	if (!hasImageError && faviconUrl) {
		return (
			<img
				className={styles.overlayBookmarkIcon}
				src={faviconUrl}
				alt=""
				onError={() => setHasImageError(true)}
			/>
		);
	}

	return (
		<svg viewBox="0 0 32 32" className={styles.overlayFallbackIcon} aria-hidden="true">
			<circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="1.75" />
			<path d="M6 16h20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
			<path d="M16 6c3.5 3.2 3.5 16.8 0 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
			<path d="M16 6c-3.5 3.2-3.5 16.8 0 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
		</svg>
	);
}

function TreeDragOverlay({ activeItem }: { activeItem: TreeDragItem }) {
	const state = useAppStore();
	const folder = activeItem.itemType === 'folder' ? state.folders[activeItem.itemId] : null;
	const bookmark = activeItem.itemType === 'bookmark' ? state.bookmarks[activeItem.itemId] : null;

	if (folder) {
		return (
			<div className={styles.overlay}>
				<FolderOverlayIcon />
				<div className={styles.overlayLabelBlock}>
					<div className={styles.overlayTitle}>{folder.name}</div>
					<div className={styles.overlayUrl}>Folder</div>
				</div>
			</div>
		);
	}

	if (!bookmark) {
		return null;
	}

	return (
		<div className={styles.overlay}>
			<BookmarkOverlayIcon bookmark={bookmark} />
			<div className={styles.overlayLabelBlock}>
				<div className={styles.overlayTitle}>{bookmark.title}</div>
				<div className={styles.overlayUrl}>{bookmark.url}</div>
			</div>
		</div>
	);
}

export function TreeDndProvider({ children }: TreeDndProviderProps) {
	const activeSpaceId = useAppStore((state) => state.activeSpaceId);
	const moveItem = useAppStore((state) => state.moveItem);
	const setActiveSpace = useAppStore((state) => state.setActiveSpace);
	const toggleFolder = useAppStore((state) => state.toggleFolder);
	const [activeItem, setActiveItem] = useState<TreeDragItem | null>(null);
	const [preview, setPreview] = useState<TreeDropPreview | null>(null);
	const [liveMessage, setLiveMessage] = useState('');
	const folderHoverIdRef = useRef<string | null>(null);
	const folderHoverTimeoutRef = useRef<number | null>(null);
	const spaceHoverIdRef = useRef<string | null>(null);
	const spaceHoverTimeoutRef = useRef<number | null>(null);

	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	useEffect(() => {
		return () => {
			if (folderHoverTimeoutRef.current !== null) {
				window.clearTimeout(folderHoverTimeoutRef.current);
			}

			if (spaceHoverTimeoutRef.current !== null) {
				window.clearTimeout(spaceHoverTimeoutRef.current);
			}
		};
	}, []);

	function clearFolderHoverTimer() {
		if (folderHoverTimeoutRef.current !== null) {
			window.clearTimeout(folderHoverTimeoutRef.current);
			folderHoverTimeoutRef.current = null;
		}

		folderHoverIdRef.current = null;
	}

	function clearSpaceHoverTimer() {
		if (spaceHoverTimeoutRef.current !== null) {
			window.clearTimeout(spaceHoverTimeoutRef.current);
			spaceHoverTimeoutRef.current = null;
		}

		spaceHoverIdRef.current = null;
	}

	function resetDragState() {
		clearFolderHoverTimer();
		clearSpaceHoverTimer();
		setActiveItem(null);
		setPreview(null);
	}

	function scheduleFolderExpand(folderId: string) {
		if (folderHoverIdRef.current === folderId) {
			return;
		}

		clearFolderHoverTimer();
		folderHoverIdRef.current = folderId;
		folderHoverTimeoutRef.current = window.setTimeout(() => {
			const folder = useAppStore.getState().folders[folderId];

			if (folder && !folder.expanded) {
				toggleFolder(folderId);
			}

			folderHoverTimeoutRef.current = null;
		}, DND_AUTO_EXPAND_MS);
	}

	function scheduleSpaceSwitch(spaceId: string) {
		if (spaceHoverIdRef.current === spaceId || spaceId === useAppStore.getState().activeSpaceId) {
			return;
		}

		clearSpaceHoverTimer();
		spaceHoverIdRef.current = spaceId;
		spaceHoverTimeoutRef.current = window.setTimeout(() => {
			setActiveSpace(spaceId);
			spaceHoverTimeoutRef.current = null;
		}, DND_AUTO_EXPAND_MS);
	}

	function handleDragStart(event: DragStartEvent) {
		const parsed = parseDropId(String(event.active.id));

		if (parsed?.kind !== 'tree-item' || !parsed.itemId) {
			return;
		}

		const meta = getTreeItemMeta(parsed.itemId);

		if (!meta) {
			return;
		}

		setActiveItem({ itemId: meta.itemId, itemType: meta.itemType });

		const label = meta.itemType === 'folder'
			? useAppStore.getState().folders[meta.itemId]?.name
			: useAppStore.getState().bookmarks[meta.itemId]?.title;

		setLiveMessage(label ? `Picked up ${label}. ${treeInstructionText}` : treeInstructionText);
	}

	function handleDragOver(event: DragOverEvent) {
		if (!activeItem) {
			return;
		}

		const nextPreview = buildPreview(event, activeItem);
		setPreview(nextPreview);

		if (nextPreview?.kind === 'tree-item' && nextPreview.mode === 'inside' && nextPreview.overItemId) {
			const folder = useAppStore.getState().folders[nextPreview.overItemId];

			if (folder && !folder.expanded) {
				scheduleFolderExpand(folder.id);
			} else {
				clearFolderHoverTimer();
			}
		} else {
			clearFolderHoverTimer();
		}

		if (nextPreview?.kind === 'space-tab') {
			scheduleSpaceSwitch(nextPreview.targetSpaceId);
		} else {
			clearSpaceHoverTimer();
		}
	}

	function handleDragEnd(event: DragEndEvent) {
		if (!activeItem) {
			resetDragState();
			return;
		}

		const finalPreview = preview ?? buildPreview(event, activeItem);

		if (!finalPreview) {
			setLiveMessage('Drag cancelled.');
			resetDragState();
			return;
		}

		if (finalPreview.invalidReason) {
			setLiveMessage(finalPreview.invalidReason);
			resetDragState();
			return;
		}

		moveItem(
			activeItem.itemId,
			activeItem.itemType,
			finalPreview.targetParentId,
			finalPreview.targetSpaceId,
			finalPreview.targetIndex,
		);
		setActiveSpace(finalPreview.targetSpaceId);

		const label = activeItem.itemType === 'folder'
			? useAppStore.getState().folders[activeItem.itemId]?.name
			: useAppStore.getState().bookmarks[activeItem.itemId]?.title;

		setLiveMessage(label ? `Moved ${label}.` : 'Item moved.');
		resetDragState();
	}

	const contextValue = useMemo<TreeDndContextValue>(
		() => ({
			activeItem,
			preview,
			instructionsId: 'tree-dnd-instructions',
			liveMessage,
		}),
		[activeItem, liveMessage, preview],
	);

	return (
		<TreeDndContextValue.Provider value={contextValue}>
			<div id="tree-dnd-instructions" className={styles.srOnly}>
				{treeInstructionText}
			</div>
			<div className={styles.srOnly} aria-live="polite" aria-atomic="true">
				{liveMessage}
			</div>
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragStart={handleDragStart}
				onDragOver={handleDragOver}
				onDragEnd={handleDragEnd}
				onDragCancel={resetDragState}
			>
				{children}
				<DragOverlay>
					{activeItem ? <TreeDragOverlay activeItem={activeItem} /> : null}
				</DragOverlay>
			</DndContext>
		</TreeDndContextValue.Provider>
	);
}

export function useTreeDnd() {
	return useContext(TreeDndContextValue);
}

export { toRowTransform };