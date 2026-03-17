import { useEffect, useMemo, useRef, useState } from 'react';

import { useAppStore } from '../../shared/store';
import { ImportWizard } from './ImportWizard';
import { SpaceBar } from './SpaceBar';
import { SpaceContent } from './SpaceContent';
import { TreeDndProvider } from './TreeDndProvider';
import styles from './Sidebar.module.css';

function getAccentVariable(color: string): string {
	return `var(--space-${color})`;
}

export function Sidebar() {
	const hydrate = useAppStore((state) => state.hydrate);
	const activeSpaceId = useAppStore((state) => state.activeSpaceId);
	const spaces = useAppStore((state) => state.spaces);
	const theme = useAppStore((state) => state.theme);
	const [isHydrating, setIsHydrating] = useState(true);
	const [isImportOpen, setIsImportOpen] = useState(false);
	const searchInputRef = useRef<HTMLInputElement>(null);
	const activeSpace = useMemo(
		() => spaces.find((space) => space.id === activeSpaceId) ?? null,
		[activeSpaceId, spaces],
	);

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

	useEffect(() => {
		const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
		const root = document.documentElement;

		function applyTheme() {
			const resolvedTheme = theme === 'auto' ? (mediaQuery.matches ? 'dark' : 'light') : theme;

			if (theme === 'auto') {
				root.removeAttribute('data-theme');
			} else {
				root.setAttribute('data-theme', theme);
			}

			root.style.colorScheme = resolvedTheme;
		}

		applyTheme();
		mediaQuery.addEventListener('change', applyTheme);

		return () => {
			mediaQuery.removeEventListener('change', applyTheme);
		};
	}, [theme]);

	function focusSearch() {
		searchInputRef.current?.focus();
		searchInputRef.current?.select();
	}

	return (
		<div
			className={styles.sidebar}
			data-accent={activeSpace?.color ?? 'green'}
			style={{ '--accent-current': getAccentVariable(activeSpace?.color ?? 'green') } as React.CSSProperties}
			onKeyDownCapture={(event) => {
				if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
					event.preventDefault();
					focusSearch();
				}
			}}
		>
			<div
				className={styles.sidebarContent}
				style={{ 
					pointerEvents: isImportOpen ? 'none' : undefined,
					userSelect: isImportOpen ? 'none' : undefined,
					display: 'flex',
					flexDirection: 'column',
					flex: 1,
					minHeight: '100vh',
					filter: isImportOpen ? 'blur(8px)' : undefined,
					transition: 'filter 200ms ease',
					position: isImportOpen ? 'relative' : undefined,
					zIndex: isImportOpen ? -100 : undefined
				}}
				aria-hidden={isImportOpen}
			>
				{isHydrating ? (
					<div className={styles.loadingState}>
						<div className={styles.loadingLabel}>Loading spaces...</div>
					</div>
				) : (
					<TreeDndProvider>
						<SpaceBar onOpenImport={() => setIsImportOpen(true)} />
						<SpaceContent ref={searchInputRef} onOpenImport={() => setIsImportOpen(true)} />
					</TreeDndProvider>
				)}
			</div>
			{isImportOpen ? <ImportWizard onClose={() => setIsImportOpen(false)} /> : null}
		</div>
	);
}