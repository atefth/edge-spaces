import { useAppStore } from '../../shared/store';
import type { TreeItemType } from '../../shared/types';
import { BookmarkItem } from './BookmarkItem';
import { FolderItem } from './FolderItem';
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
}: TreeNodeProps) {
	const folders = useAppStore((state) => state.folders);
	const bookmarks = useAppStore((state) => state.bookmarks);

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
					onClearEditing={onClearEditing}
					onShowStatus={onShowStatus}
					onStartBookmarkForm={onStartBookmarkForm}
					onStartBookmarkRename={onStartBookmarkRename}
					onStartFolderRename={onStartFolderRename}
				/>

				{folder.expanded ? (
					<div className={styles.children}>
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
				) : null}
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
			onClearEditing={onClearEditing}
			onShowStatus={onShowStatus}
			onStartBookmarkForm={onStartBookmarkForm}
			onStartBookmarkRename={onStartBookmarkRename}
		/>
	);
}