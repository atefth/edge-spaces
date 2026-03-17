import { useAppStore } from '../../shared/store';
import { PinnedGrid } from './PinnedGrid';
import styles from './SpaceContent.module.css';

export function SpaceContent() {
	const spaces = useAppStore((state) => state.spaces);
	const activeSpaceId = useAppStore((state) => state.activeSpaceId);
	const activeSpace = spaces.find((space) => space.id === activeSpaceId) ?? null;
	const isEmpty = !activeSpace || (activeSpace.pinnedSites.length === 0 && activeSpace.rootFolderIds.length === 0);

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
				{isEmpty ? (
					<div className={styles.emptyState}>
						<div className={styles.emptyIcon} aria-hidden="true">
							<div className={styles.emptyIconTab} />
						</div>
						<h2 className={styles.emptyTitle}>This space is empty</h2>
						<p className={styles.emptyMessage}>Start with a bookmark or bring over what you already pinned in Arc.</p>
						<div className={styles.emptyActions}>
							<button type="button" className={styles.primaryAction}>
								Add a bookmark
							</button>
							<button type="button" className={styles.secondaryAction}>
								Import from Arc
							</button>
						</div>
					</div>
				) : (
					<div className={`${styles.placeholderCard} ${styles.treePlaceholder}`}>Folder tree coming next.</div>
				)}
			</div>
		</div>
	);
}