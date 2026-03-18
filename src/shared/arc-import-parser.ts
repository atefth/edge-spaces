import { MAX_FOLDER_DEPTH, STORAGE_VERSION } from './constants';
import { getFaviconUrl } from './favicon';
import type { Bookmark, Folder, PinnedSite, Space, SpaceColor, StorageData } from './types';

const SPACE_COLOR_ROTATION: SpaceColor[] = ['green', 'blue', 'purple', 'orange', 'red', 'pink'];
const SPACE_SUFFIX = ' - Space';
const TOP_APPS_LABEL = 'Top Apps';
const PINNED_BOOKMARKS_LABEL = 'Pinned bookmarks';
const ROOT_BOOKMARKS_FOLDER_NAME = 'Imported Bookmarks';

export interface ParseResult {
	spaces: ParsedSpace[];
	totalFolders: number;
	totalBookmarks: number;
	totalPinnedSites: number;
	warnings: string[];
}

export interface ParsedSpace {
	name: string;
	color: SpaceColor;
	pinnedSites: Omit<PinnedSite, 'id'>[];
	rootFolders: ParsedFolder[];
}

export interface ParsedFolder {
	name: string;
	children: Array<ParsedFolder | ParsedBookmark>;
}

export interface ParsedBookmark {
	title: string;
	url: string;
}

interface ParseContext {
	totalFolders: number;
	totalBookmarks: number;
	totalPinnedSites: number;
	warnings: string[];
}

interface ParsedContainerResult {
	folders: ParsedFolder[];
	bookmarks: ParsedBookmark[];
}

function createId(): string {
	if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID();
	}

	return `fallback-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeText(value: string | null | undefined): string {
	return (value ?? '').replace(/\s+/g, ' ').trim();
}

function isParsedBookmark(item: ParsedFolder | ParsedBookmark): item is ParsedBookmark {
	return 'url' in item;
}

function isValidImportUrl(url: string): boolean {
	if (!/^https?:\/\//i.test(url.trim())) {
		return false;
	}

	try {
		const parsedUrl = new URL(url.trim());
		return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
	} catch {
		return false;
	}
}

function getDirectDtElements(container: Element): HTMLDTElement[] {
	const entries: HTMLDTElement[] = [];

	for (const child of Array.from(container.children)) {
		if (child.tagName === 'DT') {
			entries.push(child as HTMLDTElement);
			continue;
		}

		if (child.tagName === 'P') {
			for (const nestedChild of Array.from(child.children)) {
				if (nestedChild.tagName === 'DT') {
					entries.push(nestedChild as HTMLDTElement);
				}
			}
		}
	}

	return entries;
}

function getNestedList(dt: HTMLDTElement): HTMLDListElement | null {
	for (const child of Array.from(dt.children)) {
		if (child.tagName === 'DL') {
			return child as HTMLDListElement;
		}
	}

	let sibling = dt.nextElementSibling;

	while (sibling && sibling.tagName === 'P' && sibling.childElementCount === 0) {
		sibling = sibling.nextElementSibling;
	}

	return sibling?.tagName === 'DL' ? (sibling as HTMLDListElement) : null;
}

function getHeading(dt: HTMLDTElement): string | null {
	const heading = dt.querySelector('h3');
	return heading ? normalizeText(heading.textContent) : null;
}

function getAnchor(dt: HTMLDTElement): HTMLAnchorElement | null {
	return dt.querySelector('a[href]');
}

function createRootBookmarksFolder(bookmarks: ParsedBookmark[]): ParsedFolder | null {
	if (bookmarks.length === 0) {
		return null;
	}

	return {
		name: ROOT_BOOKMARKS_FOLDER_NAME,
		children: bookmarks,
	};
}

function countBookmarks(items: Array<ParsedFolder | ParsedBookmark>): number {
	return items.reduce((total, item) => total + (isParsedBookmark(item) ? 1 : countBookmarks(item.children)), 0);
}

export class ArcImportParser {
	parse(html: string): ParseResult {
		const context: ParseContext = {
			totalFolders: 0,
			totalBookmarks: 0,
			totalPinnedSites: 0,
			warnings: [],
		};

		try {
			const document = new DOMParser().parseFromString(html, 'text/html');
			const rootContainer = document.body.childElementCount > 0 ? document.body : document.documentElement;
			const topLevelEntries = getDirectDtElements(rootContainer);
			const spaces: ParsedSpace[] = [];
			const looseFolders: ParsedFolder[] = [];
			const looseBookmarks: ParsedBookmark[] = [];
			let topApps: Omit<PinnedSite, 'id'>[] = [];

			for (const entry of topLevelEntries) {
				const heading = getHeading(entry);
				const nestedList = getNestedList(entry);

				if (heading) {
					if (heading === TOP_APPS_LABEL) {
						topApps = this.parsePinnedSites(nestedList, context);
						continue;
					}

					if (heading.endsWith(SPACE_SUFFIX)) {
						spaces.push(
							this.parseSpaceSection(
								heading.slice(0, -SPACE_SUFFIX.length).trim() || 'Imported',
								nestedList,
								SPACE_COLOR_ROTATION[spaces.length % SPACE_COLOR_ROTATION.length],
								context,
							),
						);
						continue;
					}

					const folderResult = this.parseContainerFolder(heading, nestedList, 1, context, heading);

					if (folderResult) {
						looseFolders.push(folderResult);
					}

					continue;
				}

				const bookmark = this.parseBookmarkEntry(entry, context, 'top-level bookmark');

				if (bookmark) {
					looseBookmarks.push(bookmark);
				}
			}

			const looseBookmarksFolder = createRootBookmarksFolder(looseBookmarks);

			if (looseBookmarksFolder) {
				context.totalFolders += 1;
				looseFolders.push(looseBookmarksFolder);
			}

			if (spaces.length === 0) {
				return {
					spaces: [
						{
							name: 'Imported',
							color: SPACE_COLOR_ROTATION[0],
							pinnedSites: topApps,
							rootFolders: looseFolders,
						},
					],
					totalFolders: context.totalFolders,
					totalBookmarks: context.totalBookmarks,
					totalPinnedSites: context.totalPinnedSites,
					warnings: context.warnings,
				};
			}

			if (topApps.length > 0) {
				spaces[0] = {
					...spaces[0],
					pinnedSites: [...topApps, ...spaces[0].pinnedSites],
				};
			}

			if (looseFolders.length > 0) {
				context.warnings.push('Imported top-level folders into the first detected space.');
				spaces[0] = {
					...spaces[0],
					rootFolders: [...spaces[0].rootFolders, ...looseFolders],
				};
			}

			return {
				spaces,
				totalFolders: context.totalFolders,
				totalBookmarks: context.totalBookmarks,
				totalPinnedSites: context.totalPinnedSites,
				warnings: context.warnings,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Unknown parser failure';
			context.warnings.push(`Import parser recovered from malformed HTML: ${message}`);

			return {
				spaces: [
					{
						name: 'Imported',
						color: SPACE_COLOR_ROTATION[0],
						pinnedSites: [],
						rootFolders: [],
					},
				],
				totalFolders: context.totalFolders,
				totalBookmarks: context.totalBookmarks,
				totalPinnedSites: context.totalPinnedSites,
				warnings: context.warnings,
			};
		}
	}

	private parseSpaceSection(
		name: string,
		list: HTMLDListElement | null,
		color: SpaceColor,
		context: ParseContext,
	): ParsedSpace {
		const rootItems = this.parseContainerItems(list, 1, context, name);
		const rootFolders = [...rootItems.folders];
		const looseBookmarksFolder = createRootBookmarksFolder(rootItems.bookmarks);

		if (looseBookmarksFolder) {
			context.totalFolders += 1;
			rootFolders.push(looseBookmarksFolder);
		}

		return {
			name,
			color,
			pinnedSites: [],
			rootFolders,
		};
	}

	private parsePinnedSites(list: HTMLDListElement | null, context: ParseContext): Omit<PinnedSite, 'id'>[] {
		if (!list) {
			return [];
		}

		const pinnedSites: Omit<PinnedSite, 'id'>[] = [];

		for (const entry of getDirectDtElements(list)) {
			const bookmark = this.parseBookmarkEntry(entry, context, TOP_APPS_LABEL);

			if (!bookmark) {
				if (getHeading(entry)) {
					context.warnings.push(`Skipped nested folder inside ${TOP_APPS_LABEL}.`);
				}

				continue;
			}

			pinnedSites.push({
				title: bookmark.title,
				url: bookmark.url,
				faviconUrl: getFaviconUrl(bookmark.url, 32),
				position: pinnedSites.length,
			});
			context.totalPinnedSites += 1;
		}

		return pinnedSites;
	}

	private parseContainerItems(
		list: HTMLDListElement | null,
		folderDepth: number,
		context: ParseContext,
		location: string,
	): ParsedContainerResult {
		const result: ParsedContainerResult = {
			folders: [],
			bookmarks: [],
		};

		if (!list) {
			return result;
		}

		const seenUrls = new Set<string>();

		for (const entry of getDirectDtElements(list)) {
			const heading = getHeading(entry);
			const nestedList = getNestedList(entry);

			if (heading) {
				if (heading === PINNED_BOOKMARKS_LABEL) {
					const promotedItems = this.parseContainerItems(nestedList, folderDepth, context, `${location}/${heading}`);
					result.folders.push(...promotedItems.folders);
					for (const bookmark of promotedItems.bookmarks) {
						if (seenUrls.has(bookmark.url)) {
							context.warnings.push(`Duplicate URL skipped in ${location}: ${bookmark.url}`);
							continue;
						}

						seenUrls.add(bookmark.url);
						result.bookmarks.push(bookmark);
					}
					continue;
				}

				if (folderDepth > MAX_FOLDER_DEPTH) {
					context.warnings.push(`Flattened folder beyond max depth (${MAX_FOLDER_DEPTH}): ${heading}`);
					const flattenedItems = this.parseContainerItems(nestedList, folderDepth, context, `${location}/${heading}`);
					result.folders.push(...flattenedItems.folders);
					for (const bookmark of flattenedItems.bookmarks) {
						if (seenUrls.has(bookmark.url)) {
							context.warnings.push(`Duplicate URL skipped in ${location}: ${bookmark.url}`);
							continue;
						}

						seenUrls.add(bookmark.url);
						result.bookmarks.push(bookmark);
					}
					continue;
				}

				const folder = this.parseContainerFolder(heading, nestedList, folderDepth, context, `${location}/${heading}`);

				if (folder) {
					result.folders.push(folder);
				}

				continue;
			}

			const bookmark = this.parseBookmarkEntry(entry, context, location);

			if (!bookmark) {
				continue;
			}

			if (seenUrls.has(bookmark.url)) {
				context.warnings.push(`Duplicate URL skipped in ${location}: ${bookmark.url}`);
				continue;
			}

			seenUrls.add(bookmark.url);
			result.bookmarks.push(bookmark);
		}

		return result;
	}

	private parseContainerFolder(
		name: string,
		list: HTMLDListElement | null,
		depth: number,
		context: ParseContext,
		location: string,
	): ParsedFolder | null {
		const normalizedName = normalizeText(name) || 'Imported Folder';
		const childItems = this.parseContainerItems(list, depth + 1, context, location);
		const children: Array<ParsedFolder | ParsedBookmark> = [...childItems.folders, ...childItems.bookmarks];

		context.totalFolders += 1;

		return {
			name: normalizedName,
			children,
		};
	}

	private parseBookmarkEntry(
		entry: HTMLDTElement,
		context: ParseContext,
		location: string,
	): ParsedBookmark | null {
		const anchor = getAnchor(entry);

		if (!anchor) {
			return null;
		}

		const rawUrl = anchor.getAttribute('href')?.trim() ?? '';

		if (!isValidImportUrl(rawUrl)) {
			context.warnings.push(`Skipped invalid URL: ${rawUrl || '(empty)'}${location ? ` in ${location}` : ''}`);
			return null;
		}

		const normalizedUrl = rawUrl.trim();
		const title = normalizeText(anchor.textContent) || normalizedUrl;

		context.totalBookmarks += 1;

		return {
			title,
			url: normalizedUrl,
		};
	}
}

export function convertToStorageData(result: ParseResult): Partial<StorageData> {
	const spaces: Space[] = [];
	const folders: Record<string, Folder> = {};
	const bookmarks: Record<string, Bookmark> = {};
	const createdAt = Date.now();

	for (const parsedSpace of result.spaces) {
		const spaceId = createId();
		const rootFolderIds: string[] = [];

		for (const parsedFolder of parsedSpace.rootFolders) {
			rootFolderIds.push(
				createFolderTree({
					parsedFolder,
					spaceId,
					parentId: null,
					folders,
					bookmarks,
					createdAt,
				}),
			);
		}

		spaces.push({
			id: spaceId,
			name: parsedSpace.name,
			color: parsedSpace.color,
			pinnedSites: parsedSpace.pinnedSites.map((site, index) => ({
				id: createId(),
				title: site.title,
				url: site.url,
				faviconUrl: site.faviconUrl || getFaviconUrl(site.url, 32),
				position: index,
			})),
			rootFolderIds,
		});
	}

	return {
		spaces,
		folders,
		bookmarks,
		activeSpaceId: spaces[0]?.id ?? '',
		version: STORAGE_VERSION,
	};
}

function createFolderTree({
	parsedFolder,
	spaceId,
	parentId,
	folders,
	bookmarks,
	createdAt,
}: {
	parsedFolder: ParsedFolder;
	spaceId: string;
	parentId: string | null;
	folders: Record<string, Folder>;
	bookmarks: Record<string, Bookmark>;
	createdAt: number;
}): string {
	const folderId = createId();
	const childIds: string[] = [];

	for (const child of parsedFolder.children) {
		if (isParsedBookmark(child)) {
			const bookmarkId = createId();

			bookmarks[bookmarkId] = {
				id: bookmarkId,
				type: 'bookmark',
				spaceId,
				parentId: folderId,
				title: child.title,
				url: child.url,
				faviconUrl: getFaviconUrl(child.url, 16) || undefined,
				createdAt,
			};

			childIds.push(bookmarkId);
			continue;
		}

		childIds.push(
			createFolderTree({
				parsedFolder: child,
				spaceId,
				parentId: folderId,
				folders,
				bookmarks,
				createdAt,
			}),
		);
	}

	folders[folderId] = {
		id: folderId,
		type: 'folder',
		spaceId,
		parentId,
		name: parsedFolder.name,
		childIds,
		expanded: false,
		createdAt,
	};

	return folderId;
}

export function getParsedFolderBookmarkCount(folder: ParsedFolder): number {
	return countBookmarks(folder.children);
}