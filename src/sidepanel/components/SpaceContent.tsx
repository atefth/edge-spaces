import { forwardRef, useRef } from 'react';

import { useAppStore } from '../../shared/store';
import { FolderTree } from './FolderTree';
import { PinnedGrid } from './PinnedGrid';
import { SearchBar } from './SearchBar';
import { SearchResults, type SearchResultsHandle } from './SearchResults';
import styles from './SpaceContent.module.css';

interface SpaceContentProps {
	onOpenImport: () => void;
}

export const SpaceContent = forwardRef<HTMLInputElement, SpaceContentProps>(function SpaceContent(
	{ onOpenImport },
	searchInputRef,
) {
	const spaces = useAppStore((state) => state.spaces);
	const activeSpaceId = useAppStore((state) => state.activeSpaceId);
	const searchQuery = useAppStore((state) => state.searchQuery);
	const activeSpace = spaces.find((space) => space.id === activeSpaceId) ?? null;
	const searchResultsRef = useRef<SearchResultsHandle>(null);
    const activeTabId = activeSpaceId ? `space-tab-${activeSpaceId}` : undefined;

	return (
		<div className={styles.content} role="tabpanel" aria-labelledby={activeTabId} data-view={searchQuery.trim() ? 'search' : 'tree'}>
			<div className={styles.section}>
				<div className={styles.sectionLabel}>Pinned Sites</div>
				<PinnedGrid activeSpaceId={activeSpaceId} pinnedSites={activeSpace?.pinnedSites ?? []} />
			</div>

			<div className={styles.section}>
				<div className={styles.sectionLabel}>Search</div>
				<SearchBar ref={searchInputRef} onArrowDown={() => searchResultsRef.current?.focusFirstResult()} />
			</div>

			<div className={styles.sectionGrow}>
				<div className={styles.sectionLabel}>Bookmarks</div>
				{searchQuery.trim() ? (
					<SearchResults ref={searchResultsRef} query={searchQuery} />
				) : activeSpace ? (
					<FolderTree onOpenImport={onOpenImport} />
				) : null}
			</div>
		</div>
	);
});