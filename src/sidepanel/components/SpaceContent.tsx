import { useAppStore } from '../../shared/store';
import { FolderTree } from './FolderTree';
import { PinnedGrid } from './PinnedGrid';
import styles from './SpaceContent.module.css';

export function SpaceContent() {
	const spaces = useAppStore((state) => state.spaces);
	const activeSpaceId = useAppStore((state) => state.activeSpaceId);
	const activeSpace = spaces.find((space) => space.id === activeSpaceId) ?? null;

	return (
		<div className={styles.content}>
			<div className={styles.section}>
				<div className={styles.sectionLabel}>Pinned Sites</div>
				<PinnedGrid activeSpaceId={activeSpaceId} pinnedSites={activeSpace?.pinnedSites ?? []} />
			</div>

			<div className={styles.section}>
				<div className={styles.sectionLabel}>Search</div>
				<div className={styles.placeholderCard}>Search bar coming next.</div>
			</div>

			<div className={styles.sectionGrow}>
				<div className={styles.sectionLabel}>Bookmarks</div>
				{activeSpace ? <FolderTree /> : null}
			</div>
		</div>
	);
}