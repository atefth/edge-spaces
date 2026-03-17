import { useRef } from 'react';

import { useAppStore } from '../../shared/store';
import { FolderTree } from './FolderTree';
import { PinnedGrid } from './PinnedGrid';
import { SearchBar } from './SearchBar';
import { SearchResults, type SearchResultsHandle } from './SearchResults';
import styles from './SpaceContent.module.css';

interface SpaceContentProps {
	onOpenImport: () => void;
}

export function SpaceContent({ onOpenImport }: SpaceContentProps) {
	const spaces = useAppStore((state) => state.spaces);
	const activeSpaceId = useAppStore((state) => state.activeSpaceId);
	const searchQuery = useAppStore((state) => state.searchQuery);
	const activeSpace = spaces.find((space) => space.id === activeSpaceId) ?? null;
	const searchResultsRef = useRef<SearchResultsHandle>(null);

	return (
		<div className={styles.content}>
			<div className={styles.section}>
				<div className={styles.sectionLabel}>Pinned Sites</div>
				<PinnedGrid activeSpaceId={activeSpaceId} pinnedSites={activeSpace?.pinnedSites ?? []} />
			</div>

			<div className={styles.section}>
				<div className={styles.sectionLabel}>Search</div>
				<SearchBar onArrowDown={() => searchResultsRef.current?.focusFirstResult()} />
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
}