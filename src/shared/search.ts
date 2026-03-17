import type { Bookmark, Folder, Space } from './types';

export interface SearchResult {
	item: Bookmark | Folder;
	space: Space;
	breadcrumb: string;
	matchField: 'title' | 'url' | 'name';
	matchIndices: [number, number][];
}

interface SearchState {
	spaces: Space[];
	folders: Record<string, Folder>;
	bookmarks: Record<string, Bookmark>;
}

export function findMatchIndices(value: string, query: string): [number, number][] {
	const normalizedValue = value.toLowerCase();
	const normalizedQuery = query.trim().toLowerCase();

	if (!normalizedQuery) {
		return [];
	}

	const matches: [number, number][] = [];
	let searchIndex = 0;

	while (searchIndex < normalizedValue.length) {
		const matchIndex = normalizedValue.indexOf(normalizedQuery, searchIndex);

		if (matchIndex === -1) {
			break;
		}

		matches.push([matchIndex, matchIndex + normalizedQuery.length]);
		searchIndex = matchIndex + normalizedQuery.length;
	}

	return matches;
}

function getFolderAncestors(folderId: string, folders: Record<string, Folder>): Folder[] {
	const ancestors: Folder[] = [];
	let currentFolder: Folder | undefined = folders[folderId];

	while (currentFolder) {
		ancestors.unshift(currentFolder);
		currentFolder = currentFolder.parentId ? folders[currentFolder.parentId] : undefined;
	}

	return ancestors;
}

function buildBreadcrumb(space: Space, labels: string[]): string {
	return [space.name, ...labels].join(' > ');
}

export function searchItems({ spaces, folders, bookmarks }: SearchState, query: string): SearchResult[] {
	const normalizedQuery = query.trim();

	if (!normalizedQuery) {
		return [];
	}

	const results: SearchResult[] = [];

	for (const space of spaces) {
		for (const folderId of space.rootFolderIds) {
			if (!folders[folderId]) {
				continue;
			}
		}
	}

	for (const folder of Object.values(folders)) {
		const space = spaces.find((candidate) => candidate.id === folder.spaceId);

		if (!space) {
			continue;
		}

		const nameMatches = findMatchIndices(folder.name, normalizedQuery);

		if (nameMatches.length > 0) {
			const ancestors = getFolderAncestors(folder.id, folders);
			const breadcrumbLabels = ancestors.slice(0, -1).map((ancestor) => ancestor.name);

			results.push({
				item: folder,
				space,
				breadcrumb: buildBreadcrumb(space, breadcrumbLabels),
				matchField: 'name',
				matchIndices: nameMatches,
			});
		}
	}

	for (const bookmark of Object.values(bookmarks)) {
		const space = spaces.find((candidate) => candidate.id === bookmark.spaceId);
		const parentFolder = folders[bookmark.parentId];

		if (!space || !parentFolder) {
			continue;
		}

		const titleMatches = findMatchIndices(bookmark.title, normalizedQuery);
		const urlMatches = findMatchIndices(bookmark.url, normalizedQuery);

		if (titleMatches.length === 0 && urlMatches.length === 0) {
			continue;
		}

		const ancestors = getFolderAncestors(parentFolder.id, folders);
		const breadcrumbLabels = ancestors.map((ancestor) => ancestor.name);

		results.push({
			item: bookmark,
			space,
			breadcrumb: buildBreadcrumb(space, breadcrumbLabels),
			matchField: titleMatches.length > 0 ? 'title' : 'url',
			matchIndices: titleMatches.length > 0 ? titleMatches : urlMatches,
		});
	}

	return results.sort((left, right) => {
		if (left.space.name !== right.space.name) {
			return left.space.name.localeCompare(right.space.name);
		}

		return left.breadcrumb.localeCompare(right.breadcrumb) || getResultLabel(left).localeCompare(getResultLabel(right));
	});
}

export function getResultLabel(result: SearchResult): string {
	return result.item.type === 'folder' ? result.item.name : result.item.title;
}