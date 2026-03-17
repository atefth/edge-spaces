export type SpaceColor = 'green' | 'blue' | 'purple' | 'orange' | 'red' | 'pink' | 'gray';

export type TreeItemType = 'folder' | 'bookmark';

export interface PinnedSite {
	id: string;
	title: string;
	url: string;
	faviconUrl: string;
	position: number;
}

export interface Space {
	id: string;
	name: string;
	color: SpaceColor;
	pinnedSites: PinnedSite[];
	rootFolderIds: string[];
}

export interface Folder {
	id: string;
	type: 'folder';
	spaceId: string;
	parentId: string | null;
	name: string;
	childIds: string[];
	expanded: boolean;
	createdAt: number;
}

export interface Bookmark {
	id: string;
	type: 'bookmark';
	spaceId: string;
	parentId: string;
	title: string;
	url: string;
	faviconUrl?: string;
	createdAt: number;
}

export type TreeItem = Folder | Bookmark;

export interface AppState {
	spaces: Space[];
	folders: Record<string, Folder>;
	bookmarks: Record<string, Bookmark>;
	activeSpaceId: string;
	searchQuery: string;
	version: number;
}

export interface StorageData {
	spaces: Space[];
	folders: Record<string, Folder>;
	bookmarks: Record<string, Bookmark>;
	activeSpaceId: string;
	version: number;
}