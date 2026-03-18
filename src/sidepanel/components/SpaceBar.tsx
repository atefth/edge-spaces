import { useDroppable } from '@dnd-kit/core';
import { useEffect, useMemo, useRef, useState } from 'react';

import { useAppStore } from '../../shared/store';
import type { Space, SpaceColor, ThemePreference } from '../../shared/types';
import { ConfirmDialog } from './ConfirmDialog';
import { InlineEdit } from './InlineEdit';
import { getSpaceTabDndId, useTreeDnd } from './TreeDndProvider';
import styles from './SpaceBar.module.css';

const SPACE_COLORS: SpaceColor[] = ['green', 'blue', 'purple', 'orange', 'red', 'pink', 'gray'];

interface ContextMenuState {
	spaceId: string;
	x: number;
	y: number;
	openLeft: boolean;
}

interface SpaceBarProps {
	onOpenImport: () => void;
	sidebarPosition: 'left' | 'right' | 'top';
}

function getAccentColor(color: SpaceColor): string {
	return `var(--space-${color})`;
}

const THEMES: ThemePreference[] = ['auto', 'light', 'dark'];

interface SpaceTabProps {
	space: Space;
	isActive: boolean;
	isEditing: boolean;
	registerTabRef: (spaceId: string, node: HTMLDivElement | null) => void;
	onActivate: (spaceId: string) => void;
	onOpenContextMenu: (spaceId: string, x: number, y: number) => void;
	onStartRename: (spaceId: string) => void;
	onRename: (spaceId: string, nextName: string) => void;
	onCancelRename: () => void;
	sidebarPosition: 'left' | 'right' | 'top';
}

function SpaceTab({
	space,
	isActive,
	isEditing,
	registerTabRef,
	onActivate,
	onOpenContextMenu,
	onStartRename,
	onRename,
	onCancelRename,
	sidebarPosition,
}: SpaceTabProps) {
	const { activeItem, instructionsId, preview } = useTreeDnd();
	const { setNodeRef } = useDroppable({
		id: getSpaceTabDndId(space.id),
		data: {
			kind: 'space-tab',
			spaceId: space.id,
		},
	});
	const isDropTarget = Boolean(activeItem) && preview?.kind === 'space-tab' && preview.targetSpaceId === space.id;
	const isInvalidDrop = isDropTarget && Boolean(preview?.invalidReason);

	return (
		<div
			ref={(node) => {
				setNodeRef(node);
				registerTabRef(space.id, node);
			}}
			className={`${styles.tabShell} ${isActive ? styles.tabShellActive : ''}`}
			style={{ '--space-accent': getAccentColor(space.color) } as React.CSSProperties}
		>
			<button
				id={`space-tab-${space.id}`}
				type="button"
				role="tab"
				aria-describedby={activeItem ? instructionsId : undefined}
				aria-selected={isActive}
				className={`${styles.tab} ${isActive ? styles.tabActive : ''} ${isDropTarget ? styles.tabDropTarget : ''} ${isInvalidDrop ? styles.tabInvalidDrop : ''}`}
				onClick={() => onActivate(space.id)}
				onContextMenu={(event) => {
					event.preventDefault();
					onActivate(space.id);
					onOpenContextMenu(space.id, event.clientX, event.clientY);
				}}
				onDoubleClick={() => onStartRename(space.id)}
			>
				{isActive ? <span className={styles.activeGlow} aria-hidden="true" /> : null}
				{isEditing ? (
					<InlineEdit
						value={space.name}
						onCancel={onCancelRename}
						onSave={(nextName) => {
							onRename(space.id, nextName);
						}}
					/>
				) : (
					<>
						<span className={styles.tabLabel}>
							{sidebarPosition === 'top' ? space.name : (space.name.charAt(0).toUpperCase() || '?')}
						</span>
						<span className={styles.tabUnderline} aria-hidden="true" />
					</>
				)}
			</button>
		</div>
	);
}

export function SpaceBar({ onOpenImport, sidebarPosition }: SpaceBarProps) {
	const spaces = useAppStore((state) => state.spaces);
	const activeSpaceId = useAppStore((state) => state.activeSpaceId);
	const theme = useAppStore((state) => state.theme);
	const sidebarPositionFromStore = useAppStore((state) => state.sidebarPosition);
	const addSpace = useAppStore((state) => state.addSpace);
	const deleteSpace = useAppStore((state) => state.deleteSpace);
	const renameSpace = useAppStore((state) => state.renameSpace);
	const setActiveSpace = useAppStore((state) => state.setActiveSpace);
	const setSpaceColor = useAppStore((state) => state.setSpaceColor);
	const setTheme = useAppStore((state) => state.setTheme);
	const setSidebarPosition = useAppStore((state) => state.setSidebarPosition);
	const scrollRegionRef = useRef<HTMLDivElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const headerMenuRef = useRef<HTMLDivElement>(null);
	const tabRefs = useRef<Record<string, HTMLDivElement | null>>({});
	const [editingSpaceId, setEditingSpaceId] = useState<string | null>(null);
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
	const [isHeaderMenuOpen, setIsHeaderMenuOpen] = useState(false);
	const [headerMenuPos, setHeaderMenuPos] = useState<{ top: number; left: number } | null>(null);
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
		if (!contextMenu && !isHeaderMenuOpen) {
			return;
		}

		function handlePointerDown(event: MouseEvent) {
			const target = event.target as Node;

			if (menuRef.current?.contains(target) || headerMenuRef.current?.contains(target)) {
				return;
			}

			setContextMenu(null);
			setShowColorMenu(false);
			setIsHeaderMenuOpen(false);
		}

		function handleWindowBlur() {
			setContextMenu(null);
			setShowColorMenu(false);
			setIsHeaderMenuOpen(false);
		}

		document.addEventListener('mousedown', handlePointerDown);
		window.addEventListener('blur', handleWindowBlur);

		return () => {
			document.removeEventListener('mousedown', handlePointerDown);
			window.removeEventListener('blur', handleWindowBlur);
		};
	}, [contextMenu, isHeaderMenuOpen]);

	useEffect(() => {
		const targetSpaceId = editingSpaceId ?? activeSpaceId;

		if (!targetSpaceId) {
			return;
		}

		tabRefs.current[targetSpaceId]?.scrollIntoView({
			behavior: 'smooth',
			block: 'nearest',
			inline: 'center',
		});
	}, [activeSpaceId, editingSpaceId, spaces.length]);

	function closeMenu() {
		setContextMenu(null);
		setShowColorMenu(false);
	}

	function openContextMenu(spaceId: string, x: number, y: number) {
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const menuWidth = 188;
		const menuHeight = 132;
		const submenuWidth = 150;
		const margin = 12;
		const clampedX = Math.min(x, viewportWidth - menuWidth - margin);
		const clampedY = Math.min(y, viewportHeight - menuHeight - margin);
		const openLeft = viewportWidth - clampedX < menuWidth + submenuWidth + 40;

		setContextMenu({
			spaceId,
			x: Math.max(margin, clampedX),
			y: Math.max(margin, clampedY),
			openLeft,
		});
		setIsHeaderMenuOpen(false);
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
			<div className={styles.wrapper} data-sidebar-position={sidebarPosition}>
				<div className={styles.headerRow}>
					<div className={styles.panelLabel}>Spaces</div>
					<div className={styles.headerActions}>
						<div className={styles.headerMenuShell} ref={headerMenuRef}>
							<button
								type="button"
								className={styles.menuButton}
								onClick={(event) => {
									const rect = event.currentTarget.getBoundingClientRect();
									const menuWidth = 194;
									const menuHeight = 280;
									const vw = window.innerWidth;
									const vh = window.innerHeight;

									let left = Math.min(rect.left, vw - menuWidth - 8);
									left = Math.max(8, left);

									let top = rect.bottom + 6;
									if (top + menuHeight > vh) {
										top = Math.max(8, rect.top - menuHeight - 6);
									}

									setHeaderMenuPos({ top, left });
									setIsHeaderMenuOpen((current) => !current);
									setContextMenu(null);
									setShowColorMenu(false);
								}}
								aria-label="Open sidebar settings"
							>
								<span aria-hidden="true">⚙</span>
							</button>
							{isHeaderMenuOpen && headerMenuPos ? (
								<div
									className={styles.headerMenu}
									role="menu"
									style={{ top: headerMenuPos.top, left: headerMenuPos.left }}
								>
									<button
										type="button"
										className={styles.menuItem}
										onClick={() => {
											onOpenImport();
											setIsHeaderMenuOpen(false);
										}}
									>
										Import from Arc
									</button>
									<div className={styles.menuSectionLabel}>Theme</div>
									{THEMES.map((candidateTheme) => (
										<button
											key={candidateTheme}
											type="button"
											className={`${styles.menuItem} ${theme === candidateTheme ? styles.menuItemSelected : ''}`}
											onClick={() => {
												setTheme(candidateTheme);
												setIsHeaderMenuOpen(false);
											}}
										>
											<span>{candidateTheme[0].toUpperCase() + candidateTheme.slice(1)}</span>
											{theme === candidateTheme ? <span className={styles.menuSelectedMark}>✓</span> : null}
										</button>
									))}
									<div className={styles.menuSectionLabel}>Sidebar Position</div>
									{(['left', 'right', 'top'] as const).map((pos) => (
										<button
											key={pos}
											type="button"
											className={`${styles.menuItem} ${sidebarPositionFromStore === pos ? styles.menuItemSelected : ''}`}
											onClick={() => {
												setSidebarPosition(pos);
												setIsHeaderMenuOpen(false);
											}}
										>
											<span>{pos[0].toUpperCase() + pos.slice(1)}</span>
											{sidebarPositionFromStore === pos ? <span className={styles.menuSelectedMark}>✓</span> : null}
										</button>
									))}
								</div>
							) : null}
						</div>
						<button type="button" className={styles.addButton} onClick={handleCreateSpace} aria-label="Create space">
							+
						</button>
					</div>
				</div>
				<div ref={scrollRegionRef} className={styles.scrollRegion}>
					<div className={styles.tabList} role="tablist" aria-label="Spaces">
						{spaces.map((space) => {
							const isActive = space.id === activeSpaceId;
							const isEditing = space.id === editingSpaceId;

							return (
								<SpaceTab
									key={space.id}
									space={space}
									isActive={isActive}
									isEditing={isEditing}
									registerTabRef={(spaceId, node) => {
										tabRefs.current[spaceId] = node;
									}}
									onActivate={setActiveSpace}
									onOpenContextMenu={openContextMenu}
									onStartRename={setEditingSpaceId}
									onRename={(spaceId, nextName) => {
										renameSpace(spaceId, nextName);
										setEditingSpaceId(null);
									}}
									onCancelRename={() => setEditingSpaceId(null)}
									sidebarPosition={sidebarPosition}
								/>
							);
						})}
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
					<div
						className={styles.menuGroup}
						onMouseEnter={() => setShowColorMenu(true)}
						onMouseLeave={() => setShowColorMenu(false)}
					>
						<button
							type="button"
							className={styles.menuItem}
							onClick={() => setShowColorMenu((current) => !current)}
						>
							<span>Change Color</span>
							<span className={styles.menuHint}>›</span>
						</button>
						{showColorMenu ? (
							<div
								className={`${styles.submenu} ${contextMenu.openLeft ? styles.submenuLeft : ''}`}
							>
								{SPACE_COLORS.map((color) => (
									<button
										key={color}
										type="button"
										className={`${styles.colorOption} ${contextSpace.color === color ? styles.colorOptionActive : ''}`}
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
										{contextSpace.color === color ? <span className={styles.colorCheck}>✓</span> : null}
									</button>
								))}
							</div>
						) : null}
					</div>
					<button
						type="button"
						className={`${styles.menuItem} ${styles.menuItemDanger}`}
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