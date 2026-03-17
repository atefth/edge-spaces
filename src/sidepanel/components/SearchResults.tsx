import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';

import { getFaviconUrl } from '../../shared/favicon';
import { findMatchIndices, getResultLabel, searchItems, type SearchResult } from '../../shared/search';
import { useAppStore } from '../../shared/store';
import styles from './SearchResults.module.css';

export interface SearchResultsHandle {
	focusFirstResult: () => void;
}

interface SearchResultsProps {
	query: string;
}

function highlightText(value: string, ranges: [number, number][]) {
	if (ranges.length === 0) {
		return value;
	}

	const fragments: Array<string | JSX.Element> = [];
	let cursor = 0;

	ranges.forEach(([start, end], index) => {
		if (cursor < start) {
			fragments.push(value.slice(cursor, start));
		}

		fragments.push(
			<span key={`${start}-${end}-${index}`} className={styles.highlight}>
				{value.slice(start, end)}
			</span>,
		);

		cursor = end;
	});

	if (cursor < value.length) {
		fragments.push(value.slice(cursor));
	}

	return fragments;
}

function FolderIcon() {
	return (
		<svg viewBox="0 0 24 24" className={styles.folderIcon} aria-hidden="true">
			<path d="M3.75 7.25h5l1.45 1.8H20a1.75 1.75 0 0 1 1.75 1.75v5.95A2.5 2.5 0 0 1 19.25 19H4.75a2.5 2.5 0 0 1-2.5-2.5V9a1.75 1.75 0 0 1 1.5-1.75Z" opacity="0.26" />
			<path d="M3.25 8.75A2.75 2.75 0 0 1 6 6h3.38c.54 0 1.05.25 1.38.68l.96 1.22H18A2.75 2.75 0 0 1 20.75 10v6A2.75 2.75 0 0 1 18 18.75H6A2.75 2.75 0 0 1 3.25 16Zm2.75-1.25A1.25 1.25 0 0 0 4.75 8.75V16c0 .69.56 1.25 1.25 1.25h12A1.25 1.25 0 0 0 19.25 16v-6c0-.69-.56-1.25-1.25-1.25h-6.64l-1.41-1.8A.25.25 0 0 0 9.75 6.9H6Z" />
		</svg>
	);
}

function GlobeIcon() {
	return (
		<svg viewBox="0 0 32 32" className={styles.fallbackIcon} aria-hidden="true">
			<circle cx="16" cy="16" r="10" fill="none" stroke="currentColor" strokeWidth="1.75" />
			<path d="M6 16h20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
			<path d="M16 6c3.5 3.2 3.5 16.8 0 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
			<path d="M16 6c-3.5 3.2-3.5 16.8 0 20" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
		</svg>
	);
}

function focusTreeRoot() {
	window.setTimeout(() => {
		const treeRoot = document.querySelector<HTMLElement>('[data-tree-root="true"]');
		treeRoot?.focus();
	}, 0);
}

export const SearchResults = forwardRef<SearchResultsHandle, SearchResultsProps>(function SearchResults(
	{ query },
	ref,
) {
	const state = useAppStore();
	const setActiveSpace = useAppStore((store) => store.setActiveSpace);
	const setSearchQuery = useAppStore((store) => store.setSearchQuery);
	const toggleFolder = useAppStore((store) => store.toggleFolder);
	const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
	const results = useMemo(
		() => searchItems({ spaces: state.spaces, folders: state.folders, bookmarks: state.bookmarks }, query),
		[query, state.bookmarks, state.folders, state.spaces],
	);

	useImperativeHandle(ref, () => ({
		focusFirstResult() {
			resultRefs.current[0]?.focus();
		},
	}));

	const groupedResults = useMemo(() => {
		return results.reduce<Array<{ spaceId: string; label: string; items: SearchResult[] }>>((groups, result) => {
			const lastGroup = groups.at(-1);

			if (lastGroup && lastGroup.spaceId === result.space.id) {
				lastGroup.items.push(result);
				return groups;
			}

			groups.push({
				spaceId: result.space.id,
				label: result.space.name,
				items: [result],
			});

			return groups;
		}, []);
	}, [results]);

	function clearSearchAndFocusTree() {
		setSearchQuery('');
		focusTreeRoot();
	}

	async function openBookmark(url: string, openInNewTab: boolean) {
		if (openInNewTab) {
			await chrome.tabs.create({ url });
			return;
		}

		await chrome.tabs.update({ url });
	}

	function revealFolder(folderId: string, spaceId: string) {
		const folder = useAppStore.getState().folders[folderId];

		if (!folder) {
			return;
		}

		const folderIdsToExpand: string[] = [];
		let currentFolder: typeof folder | undefined = folder;

		while (currentFolder) {
			folderIdsToExpand.unshift(currentFolder.id);
			currentFolder = currentFolder.parentId ? useAppStore.getState().folders[currentFolder.parentId] : undefined;
		}

		setActiveSpace(spaceId);

		folderIdsToExpand.forEach((candidateId) => {
			const candidate = useAppStore.getState().folders[candidateId];

			if (candidate && !candidate.expanded) {
				toggleFolder(candidateId);
			}
		});

		setSearchQuery('');

		window.setTimeout(() => {
			const row = document.querySelector<HTMLElement>(`[data-folder-id="${folderId}"]`);
			row?.scrollIntoView({ block: 'center', behavior: 'smooth' });
			row?.focus();
		}, 80);
	}

	if (results.length === 0) {
		return <div className={styles.emptyState}>No results for “{query}”</div>;
	}

	let runningIndex = 0;

	return (
		<div className={styles.panel} role="listbox" aria-label="Search results">
			{groupedResults.map((group) => (
				<div key={group.spaceId} className={styles.group}>
					<div className={styles.groupLabel}>{group.label}</div>
					{group.items.map((result) => {
						const itemIndex = runningIndex;
						runningIndex += 1;
						const titleText = result.item.type === 'folder' ? result.item.name : result.item.title;
						const titleRanges = findMatchIndices(titleText, query);
						const urlRanges = result.item.type === 'bookmark' ? findMatchIndices(result.item.url, query) : [];
						const faviconUrl = result.item.type === 'bookmark'
							? result.item.faviconUrl || getFaviconUrl(result.item.url, 16)
							: null;

						return (
							<button
								key={`${result.item.id}-${result.matchField}`}
								type="button"
								ref={(node) => {
									resultRefs.current[itemIndex] = node;
								}}
								className={styles.resultButton}
								style={{ '--search-result-index': Math.min(itemIndex, 9) } as React.CSSProperties}
								role="option"
								onClick={() => {
									if (result.item.type === 'folder') {
										revealFolder(result.item.id, result.space.id);
										return;
									}

									void openBookmark(result.item.url, false);
								}}
								onAuxClick={(event) => {
									if (event.button === 1 && result.item.type === 'bookmark') {
										event.preventDefault();
										void openBookmark(result.item.url, true);
									}
								}}
								onKeyDown={(event) => {
									if (event.key === 'ArrowDown') {
										event.preventDefault();
										resultRefs.current[itemIndex + 1]?.focus();
									}

									if (event.key === 'ArrowUp') {
										event.preventDefault();
										if (itemIndex === 0) {
											const searchInput = document.querySelector<HTMLInputElement>('input[type="search"]');
											searchInput?.focus();
											return;
										}

										resultRefs.current[itemIndex - 1]?.focus();
									}

									if (event.key === 'Escape') {
										event.preventDefault();
										clearSearchAndFocusTree();
									}
								}}
							>
								{result.item.type === 'folder' ? (
									<FolderIcon />
								) : faviconUrl ? (
									<img src={faviconUrl} alt="" className={styles.icon} />
								) : (
									<GlobeIcon />
								)}
								<div className={styles.content}>
									<div className={styles.title}>{highlightText(titleText, titleRanges)}</div>
									{result.item.type === 'bookmark' ? (
										<div className={styles.url}>{highlightText(result.item.url, urlRanges)}</div>
									) : null}
									<div className={styles.breadcrumb}>{result.breadcrumb || getResultLabel(result)}</div>
								</div>
							</button>
						);
					})}
				</div>
			))}
		</div>
	);
});