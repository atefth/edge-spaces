import { useEffect, useState } from 'react';

import { useAppStore } from '../../shared/store';
import { ImportWizard } from './ImportWizard';
import { SpaceBar } from './SpaceBar';
import { SpaceContent } from './SpaceContent';
import { TreeDndProvider } from './TreeDndProvider';
import styles from './Sidebar.module.css';

export function Sidebar() {
	const hydrate = useAppStore((state) => state.hydrate);
	const [isHydrating, setIsHydrating] = useState(true);
	const [isImportOpen, setIsImportOpen] = useState(false);

	useEffect(() => {
		let isMounted = true;

		void hydrate().finally(() => {
			if (isMounted) {
				setIsHydrating(false);
			}
		});

		return () => {
			isMounted = false;
		};
	}, [hydrate]);

	return (
		<div className={styles.sidebar}>
			{isHydrating ? (
				<div className={styles.loadingState}>
					<div className={styles.loadingLabel}>Loading spaces...</div>
				</div>
			) : (
				<TreeDndProvider>
					<SpaceBar onOpenImport={() => setIsImportOpen(true)} />
					<SpaceContent onOpenImport={() => setIsImportOpen(true)} />
				</TreeDndProvider>
			)}
			{isImportOpen ? <ImportWizard onClose={() => setIsImportOpen(false)} /> : null}
		</div>
	);
}