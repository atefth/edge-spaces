import { useSortable } from '@dnd-kit/sortable';
import type { HTMLAttributes } from 'react';

import { useAppStore } from '../../shared/store';
import type { TreeItemType } from '../../shared/types';
import { BookmarkItem } from './BookmarkItem';
import { FolderItem } from './FolderItem';
import { getTreeItemDndId, toRowTransform, useTreeDnd } from './TreeDndProvider';
import styles from './TreeNode.module.css';

interface EditingState {
	itemId: string;
	mode: 'folder-name' | 'bookmark-name' | 'bookmark-form';
}

interface TreeNodeProps {
	itemId: string;
	itemType: TreeItemType;
	depth: number;
	editingState: EditingState | null;
	onStartFolderRename: (itemId: string) => void;
	onStartBookmarkRename: (itemId: string) => void;
	onStartBookmarkForm: (itemId: string) => void;
	onClearEditing: () => void;
	onShowStatus: (message: string) => void;
	getTreeItemProps: (itemId: string) => HTMLAttributes<HTMLDivElement> & { tabIndex: number; 'aria-selected': boolean };
}

export function TreeNode({
	itemId,
	itemType,
	depth,
	editingState,
	onStartFolderRename,
	onStartBookmarkRename,
	onStartBookmarkForm,
	onClearEditing,
	onShowStatus,
	getTreeItemProps,
}: TreeNodeProps) {
	const folders = useAppStore((state) => state.folders);
	const bookmarks = useAppStore((state) => state.bookmarks);
	const { instructionsId, preview } = useTreeDnd();
	const isEditing = editingState?.itemId === itemId;
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: getTreeItemDndId(itemId),
		data: {
			kind: 'tree-item',
			itemId,
			itemType,
		},
		disabled: isEditing,
	});
	const isDropTarget = preview?.overItemId === itemId;
	const isDropInvalid = isDropTarget && Boolean(preview?.invalidReason);
	const rowClassName = [
		styles.rowShell,
		isDragging ? styles.rowDragging : '',
		isDropTarget && preview?.mode === 'inside' ? styles.rowInside : '',
		isDropTarget && preview?.mode === 'before' ? styles.rowBefore : '',
		isDropTarget && preview?.mode === 'after' ? styles.rowAfter : '',
		isDropInvalid ? styles.rowInvalid : '',
	]
		.filter(Boolean)
		.join(' ');
	const rowStyle = {
		transform: toRowTransform(transform),
		transition,
		zIndex: isDragging ? 25 : undefined,
	} as React.CSSProperties;
	const rowAttributes = {
		...attributes,
		...listeners,
		...getTreeItemProps(itemId),
		'aria-describedby': instructionsId,
		'aria-label': itemType === 'folder' ? 'Draggable folder row' : 'Draggable bookmark row',
		'aria-roledescription': 'sortable item',
		'data-tree-item-id': itemId,
		'data-focused': getTreeItemProps(itemId)['aria-selected'] ? 'true' : 'false',
	};

	if (itemType === 'folder') {
		const folder = folders[itemId];

		if (!folder) {
			return null;
		}

		return (
			<div className={styles.node}>
				<FolderItem
					folderId={folder.id}
					depth={depth}
					isEditing={editingState?.itemId === folder.id && editingState.mode === 'folder-name'}
					rowAttributes={{
						...rowAttributes,
						role: 'treeitem',
						'aria-expanded': folder.expanded,
						'aria-level': depth + 1,
						'data-folder-id': folder.id,
					}}
					rowClassName={rowClassName}
					rowRef={setNodeRef}
					rowStyle={rowStyle}
					onClearEditing={onClearEditing}
					onShowStatus={onShowStatus}
					onStartBookmarkForm={onStartBookmarkForm}
					onStartBookmarkRename={onStartBookmarkRename}
					onStartFolderRename={onStartFolderRename}
				/>

				<div className={`${styles.children} ${folder.expanded ? styles.childrenExpanded : ''}`} role="group">
					<div className={styles.childrenInner}>
						{folder.childIds.map((childId) => {
							const childType: TreeItemType | null = folders[childId]
								? 'folder'
								: bookmarks[childId]
									? 'bookmark'
									: null;

							if (!childType) {
								return null;
							}

							return (
								<TreeNode
									key={childId}
									itemId={childId}
									itemType={childType}
									depth={depth + 1}
									editingState={editingState}
									onClearEditing={onClearEditing}
									onShowStatus={onShowStatus}
									onStartBookmarkForm={onStartBookmarkForm}
									onStartFolderRename={onStartFolderRename}
									onStartBookmarkRename={onStartBookmarkRename}
								/>
							);
						})}
					</div>
				</div>
			</div>
		);
	}

	const bookmark = bookmarks[itemId];

	if (!bookmark) {
		return null;
	}

	return (
		<BookmarkItem
			bookmarkId={bookmark.id}
			depth={depth}
			isEditingForm={editingState?.itemId === bookmark.id && editingState.mode === 'bookmark-form'}
			isRenaming={editingState?.itemId === bookmark.id && editingState.mode === 'bookmark-name'}
			rowAttributes={{ ...rowAttributes, role: 'treeitem', 'aria-level': depth + 1 }}
			rowClassName={rowClassName}
			rowRef={setNodeRef}
			rowStyle={rowStyle}
			onClearEditing={onClearEditing}
			onShowStatus={onShowStatus}
			onStartBookmarkForm={onStartBookmarkForm}
			onStartBookmarkRename={onStartBookmarkRename}
		/>
	);
}