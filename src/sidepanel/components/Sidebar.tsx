import { useEffect, useState } from 'react';

import { useAppStore } from '../../shared/store';
import { SpaceBar } from './SpaceBar';
import { SpaceContent } from './SpaceContent';
import styles from './Sidebar.module.css';

export function Sidebar() {
	const hydrate = useAppStore((state) => state.hydrate);
	const [isHydrating, setIsHydrating] = useState(true);

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
				<>
					<SpaceBar />
					<SpaceContent />
				</>
			)}
		</div>
	);
}