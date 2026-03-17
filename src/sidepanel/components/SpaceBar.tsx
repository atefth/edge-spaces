import { useEffect, useMemo, useRef, useState } from 'react';

import { useAppStore } from '../../shared/store';
import type { Space, SpaceColor } from '../../shared/types';
import { ConfirmDialog } from './ConfirmDialog';
import { InlineEdit } from './InlineEdit';
import styles from './SpaceBar.module.css';

const SPACE_COLORS: SpaceColor[] = ['green', 'blue', 'purple', 'orange', 'red', 'pink', 'gray'];

interface ContextMenuState {
	spaceId: string;
	x: number;
	y: number;
}

function getAccentColor(color: SpaceColor): string {
	return `var(--accent-${color})`;
}

export function SpaceBar() {
	const spaces = useAppStore((state) => state.spaces);
	const activeSpaceId = useAppStore((state) => state.activeSpaceId);
	const addSpace = useAppStore((state) => state.addSpace);
	const deleteSpace = useAppStore((state) => state.deleteSpace);
	const renameSpace = useAppStore((state) => state.renameSpace);
	const setActiveSpace = useAppStore((state) => state.setActiveSpace);
	const setSpaceColor = useAppStore((state) => state.setSpaceColor);
	const menuRef = useRef<HTMLDivElement>(null);
	const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
	const [showColorMenu, setShowColorMenu] = useState(false);
	const [deleteCandidate, setDeleteCandidate] = useState<Space | null>(null);

	const contextSpace = useMemo(
		() => spaces.find((space) => space.id === contextMenu?.spaceId) ?? null,
		[contextMenu?.spaceId, spaces],
	);

	useEffect(() => {
		if (!editingSpaceId || spaces.some((space) => space.id === editingSpaceId)) {
			return;
		}

		setEditingSpaceId(null);
	}, [editingSpaceId, spaces]);

	useEffect(() => {
		if (!contextMenu) {
			return;
		}

		function handlePointerDown(event: MouseEvent) {
			if (menuRef.current?.contains(event.target as Node)) {
				return;
			}

			setContextMenu(null);
			setShowColorMenu(false);
		}

		function handleWindowBlur() {
			setContextMenu(null);
			setShowColorMenu(false);
		}

		document.addEventListener('mousedown', handlePointerDown);
		window.addEventListener('blur', handleWindowBlur);

		return () => {
			document.removeEventListener('mousedown', handlePointerDown);
			window.removeEventListener('blur', handleWindowBlur);
		};
	}, [contextMenu]);

	function closeMenu() {
		setContextMenu(null);
		setShowColorMenu(false);
	}

	function handleCreateSpace() {
		const existingIds = new Set(spaces.map((space) => space.id));
		addSpace('New Space', 'green');

		const nextState = useAppStore.getState();
		const newSpace = nextState.spaces.find((space) => !existingIds.has(space.id)) ?? nextState.spaces.at(-1);

		if (newSpace) {
			setEditingSpaceId(newSpace.id);
		}
	}

	return (
		<>
			<div className={styles.wrapper}>
				<div className={styles.scrollRegion}>
					<div className={styles.tabList} role="tablist" aria-label="Spaces">
						{spaces.map((space) => {
							const isActive = space.id === activeSpaceId;
							const isEditing = space.id === editingSpaceId;

							return (
								<div
									key={space.id}
									className={`${styles.tabShell} ${isActive ? styles.tabShellActive : ''}`}
									style={{ '--space-accent': getAccentColor(space.color) } as React.CSSProperties}
								>
									<button
										type="button"
										role="tab"
										aria-selected={isActive}
										className={`${styles.tab} ${isActive ? styles.tabActive : ''}`}
										onClick={() => setActiveSpace(space.id)}
										onContextMenu={(event) => {
											event.preventDefault();
											setActiveSpace(space.id);
											setContextMenu({
												spaceId: space.id,
												x: event.clientX,
												y: event.clientY,
											});
											setShowColorMenu(false);
										}}
										onDoubleClick={() => setEditingSpaceId(space.id)}
									>
										{isEditing ? (
											<InlineEdit
												value={space.name}
												onCancel={() => setEditingSpaceId(null)}
												onSave={(nextName) => {
													renameSpace(space.id, nextName);
													setEditingSpaceId(null);
												}}
											/>
										) : (
											<span className={styles.tabLabel}>{space.name}</span>
										)}
									</button>
								</div>
							);
						})}
						<button type="button" className={styles.addButton} onClick={handleCreateSpace} aria-label="Create space">
							+
						</button>
					</div>
				</div>
			</div>

			{contextMenu && contextSpace ? (
				<div
					ref={menuRef}
					className={styles.contextMenu}
					style={{ left: contextMenu.x, top: contextMenu.y }}
					role="menu"
				>
					<button
						type="button"
						className={styles.menuItem}
						onClick={() => {
							setEditingSpaceId(contextSpace.id);
							closeMenu();
						}}
					>
						Rename
					</button>
					<div className={styles.menuGroup}>
						<button
							type="button"
							className={styles.menuItem}
							onClick={() => setShowColorMenu((current) => !current)}
						>
							<span>Change Color</span>
							<span className={styles.menuHint}>›</span>
						</button>
						{showColorMenu ? (
							<div className={styles.submenu}>
								{SPACE_COLORS.map((color) => (
									<button
										key={color}
										type="button"
										className={styles.colorOption}
										onClick={() => {
											setSpaceColor(contextSpace.id, color);
											closeMenu();
										}}
									>
										<span
											className={styles.colorDot}
											style={{ backgroundColor: getAccentColor(color) }}
										/>
										<span className={styles.colorLabel}>{color}</span>
									</button>
								))}
							</div>
						) : null}
					</div>
					<button
						type="button"
						className={styles.menuItem}
						disabled={spaces.length <= 1}
						onClick={() => {
							setDeleteCandidate(contextSpace);
							closeMenu();
						}}
					>
						Delete
					</button>
				</div>
			) : null}

			{deleteCandidate ? (
				<ConfirmDialog
					title="Delete space?"
					message={`All folders and bookmarks in "${deleteCandidate.name}" will be removed.`}
					confirmLabel="Delete"
					destructive
					onCancel={() => setDeleteCandidate(null)}
					onConfirm={() => {
						deleteSpace(deleteCandidate.id);
						setDeleteCandidate(null);
					}}
				/>
			) : null}
		</>
	);
}