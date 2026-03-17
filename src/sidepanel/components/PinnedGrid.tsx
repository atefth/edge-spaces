import {
	DndContext,
	DragOverlay,
	type DragEndEvent,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	closestCenter,
	useSensor,
	useSensors,
} from '@dnd-kit/core';
import { SortableContext, arrayMove, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from '@dnd-kit/sortable';
import { type ButtonHTMLAttributes, type CSSProperties, type Ref, useEffect, useMemo, useRef, useState } from 'react';

import { MAX_PINNED_SITES } from '../../shared/constants';
import { getFaviconUrl } from '../../shared/favicon';
import { useAppStore } from '../../shared/store';
import type { PinnedSite } from '../../shared/types';
import { toRowTransform } from './TreeDndProvider';
import styles from './PinnedGrid.module.css';

interface PinnedGridProps {
	activeSpaceId: string;
	pinnedSites: PinnedSite[];
}

interface ContextMenuState {
	site: PinnedSite;
	x: number;
	y: number;
}

interface PinnedIconProps {
	site: PinnedSite;
	buttonAttributes?: ButtonHTMLAttributes<HTMLButtonElement>;
	buttonRef?: Ref<HTMLButtonElement>;
	buttonStyle?: CSSProperties;
	instructionId?: string;
	isDragging?: boolean;
	onOpen: (openInNewTab: boolean) => void;
	onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
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

function PinnedIcon({
	site,
	buttonAttributes,
	buttonRef,
	buttonStyle,
	instructionId,
	isDragging = false,
	onOpen,
	onContextMenu,
}: PinnedIconProps) {
	const [hasImageError, setHasImageError] = useState(false);
	const [isTooltipVisible, setIsTooltipVisible] = useState(false);

	useEffect(() => {
		setHasImageError(false);
	}, [site.faviconUrl, site.url]);

	return (
		<div
			className={styles.siteCell}
			onMouseEnter={() => setIsTooltipVisible(true)}
			onMouseLeave={() => setIsTooltipVisible(false)}
		>
			<button
				ref={buttonRef}
				type="button"
				className={`${styles.siteButton} ${isDragging ? styles.siteButtonDragging : ''}`}
				aria-label={site.title}
				aria-describedby={instructionId}
				style={buttonStyle}
				{...buttonAttributes}
				onBlur={() => setIsTooltipVisible(false)}
				onFocus={() => setIsTooltipVisible(true)}
				onClick={(event) => {
					if (event.ctrlKey || event.metaKey) {
						event.preventDefault();
						onOpen(true);
						return;
					}

					onOpen(false);
				}}
				onAuxClick={(event) => {
					if (event.button === 1) {
						event.preventDefault();
						onOpen(true);
					}
				}}
				onContextMenu={onContextMenu}
			>
				<div className={styles.siteInner}>
					<div className={styles.siteSheen} aria-hidden="true" />
					{!hasImageError && site.faviconUrl ? (
						<img
							className={styles.siteImage}
							src={site.faviconUrl}
							alt=""
							loading="lazy"
							onError={() => setHasImageError(true)}
						/>
					) : (
						<GlobeIcon />
					)}
				</div>
			</button>
			<div className={`${styles.tooltip} ${isTooltipVisible ? styles.tooltipVisible : ''}`} role="tooltip">
				{site.title}
			</div>
		</div>
	);
	}

interface SortablePinnedIconProps {
	site: PinnedSite;
	instructionId: string;
	onOpen: (openInNewTab: boolean) => void;
	onContextMenu: (event: React.MouseEvent<HTMLButtonElement>) => void;
}

function SortablePinnedIcon({ site, instructionId, onOpen, onContextMenu }: SortablePinnedIconProps) {
	const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
		id: site.id,
		data: {
			siteId: site.id,
		},
	});

	return (
		<div className={`${styles.siteCell} ${isDragging ? styles.siteCellDragging : ''}`}>
			<PinnedIcon
				site={site}
				buttonAttributes={{ ...attributes, ...listeners }}
				buttonRef={setNodeRef}
				buttonStyle={{
					transform: toRowTransform(transform),
					transition,
					zIndex: isDragging ? 12 : undefined,
				}}
				instructionId={instructionId}
				isDragging={isDragging}
				onOpen={onOpen}
				onContextMenu={onContextMenu}
			/>
		</div>
	);
}

export function PinnedGrid({ activeSpaceId, pinnedSites }: PinnedGridProps) {
	const addPinnedSite = useAppStore((state) => state.addPinnedSite);
	const removePinnedSite = useAppStore((state) => state.removePinnedSite);
	const reorderPinnedSites = useAppStore((state) => state.reorderPinnedSites);
	const menuRef = useRef<HTMLDivElement>(null);
	const timeoutRef = useRef<number | null>(null);
	const [statusMessage, setStatusMessage] = useState<string | null>(null);
	const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
	const [isAddTooltipVisible, setIsAddTooltipVisible] = useState(false);
	const [activeDraggedSiteId, setActiveDraggedSiteId] = useState<string | null>(null);
	const [liveMessage, setLiveMessage] = useState('');

	const sortedSites = useMemo(
		() => [...pinnedSites].sort((left, right) => left.position - right.position),
		[pinnedSites],
	);
	const canAddMore = sortedSites.length < MAX_PINNED_SITES;
	const sensors = useSensors(
		useSensor(PointerSensor, {
			activationConstraint: {
				distance: 8,
			},
		}),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	useEffect(() => {
		return () => {
			if (timeoutRef.current !== null) {
				window.clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		if (!contextMenu) {
			return;
		}

		function handlePointerDown(event: MouseEvent) {
			if (menuRef.current?.contains(event.target as Node)) {
				return;
			}

			setContextMenu(null);
		}

		function handleEscape(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				setContextMenu(null);
			}
		}

		document.addEventListener('mousedown', handlePointerDown);
		document.addEventListener('keydown', handleEscape);

		return () => {
			document.removeEventListener('mousedown', handlePointerDown);
			document.removeEventListener('keydown', handleEscape);
		};
	}, [contextMenu]);

	function showStatus(message: string) {
		setStatusMessage(message);

		if (timeoutRef.current !== null) {
			window.clearTimeout(timeoutRef.current);
		}

		timeoutRef.current = window.setTimeout(() => {
			setStatusMessage(null);
			timeoutRef.current = null;
		}, 1800);
	}

	async function openSite(url: string, openInNewTab: boolean) {
		if (openInNewTab) {
			await chrome.tabs.create({ url });
			return;
		}

		await chrome.tabs.update({ url });
	}

	function openContextMenu(event: React.MouseEvent<HTMLButtonElement>, site: PinnedSite) {
		event.preventDefault();
		const viewportWidth = window.innerWidth;
		const viewportHeight = window.innerHeight;
		const menuWidth = 176;
		const menuHeight = 124;
		const margin = 12;

		setContextMenu({
			site,
			x: Math.max(margin, Math.min(event.clientX, viewportWidth - menuWidth - margin)),
			y: Math.max(margin, Math.min(event.clientY, viewportHeight - menuHeight - margin)),
		});
	}

	async function pinCurrentTab() {
		if (!activeSpaceId) {
			return;
		}

		if (!canAddMore) {
			showStatus('Pinned limit reached');
			return;
		}

		const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
		const url = activeTab?.url ?? '';

		if (!url || !/^https?:/i.test(url)) {
			showStatus('This page cannot be pinned');
			return;
		}

		if (sortedSites.some((site) => site.url === url)) {
			showStatus('Already pinned');
			return;
		}

		addPinnedSite(activeSpaceId, {
			title: activeTab?.title?.trim() || new URL(url).hostname,
			url,
			faviconUrl: getFaviconUrl(url, 32),
		});
		showStatus('Pinned current tab');
	}

	function handleDragStart(event: DragStartEvent) {
		setActiveDraggedSiteId(String(event.active.id));
		const site = sortedSites.find((candidate) => candidate.id === event.active.id);
		setLiveMessage(site ? `Picked up ${site.title}.` : 'Pinned site picked up.');
	}

	function handleDragEnd(event: DragEndEvent) {
		const { active, over } = event;
		setActiveDraggedSiteId(null);

		if (!over || active.id === over.id) {
			return;
		}

		const oldIndex = sortedSites.findIndex((site) => site.id === active.id);
		const newIndex = sortedSites.findIndex((site) => site.id === over.id);

		if (oldIndex === -1 || newIndex === -1) {
			return;
		}

		const nextOrder = arrayMove(sortedSites, oldIndex, newIndex).map((site) => site.id);
		reorderPinnedSites(activeSpaceId, nextOrder);

		const site = sortedSites[oldIndex];
		setLiveMessage(site ? `Moved ${site.title}.` : 'Pinned site moved.');
	}

	const activeDraggedSite = activeDraggedSiteId ? sortedSites.find((site) => site.id === activeDraggedSiteId) ?? null : null;

	return (
		<div className={styles.panel}>
			<div id="pinned-grid-dnd-instructions" className={styles.srOnly}>
				Press space to pick up a pinned site, use arrow keys to move it, and press space again to drop it.
			</div>
			<div className={styles.srOnly} aria-live="polite" aria-atomic="true">
				{liveMessage}
			</div>
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragStart={handleDragStart}
				onDragEnd={handleDragEnd}
				onDragCancel={() => setActiveDraggedSiteId(null)}
			>
				<SortableContext items={sortedSites.map((site) => site.id)} strategy={rectSortingStrategy}>
					<div className={styles.grid}>
						{sortedSites.map((site) => (
							<SortablePinnedIcon
								key={site.id}
								site={site}
								instructionId="pinned-grid-dnd-instructions"
								onOpen={(openInNewTab) => {
									void openSite(site.url, openInNewTab);
								}}
								onContextMenu={(event) => openContextMenu(event, site)}
							/>
						))}

						{canAddMore ? (
							<div
								className={`${styles.addCell} ${sortedSites.length === 0 ? styles.addCellEmpty : ''}`}
								onMouseEnter={() => setIsAddTooltipVisible(true)}
								onMouseLeave={() => setIsAddTooltipVisible(false)}
							>
								<button
									type="button"
									className={`${styles.addButton} ${sortedSites.length === 0 ? styles.addButtonEmpty : ''}`}
									onBlur={() => setIsAddTooltipVisible(false)}
									onClick={() => {
										void pinCurrentTab();
									}}
									onFocus={() => setIsAddTooltipVisible(true)}
									aria-label="Pin the current tab"
								>
									<span className={styles.addGlyph}>+</span>
									{sortedSites.length === 0 ? <span className={styles.addLabel}>Pin a site</span> : null}
								</button>
								<div className={`${styles.tooltip} ${isAddTooltipVisible ? styles.tooltipVisible : ''}`} role="tooltip">
									Pin current tab
								</div>
							</div>
						) : null}
					</div>
				</SortableContext>
				<DragOverlay>
					{activeDraggedSite ? (
						<div className={styles.overlay}>
							<PinnedIcon
								site={activeDraggedSite}
								onOpen={() => undefined}
								onContextMenu={() => undefined}
							/>
						</div>
					) : null}
				</DragOverlay>
			</DndContext>

			{statusMessage ? <div className={styles.toast}>{statusMessage}</div> : null}

			{contextMenu ? (
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
							void openSite(contextMenu.site.url, false);
							setContextMenu(null);
						}}
					>
						Open
					</button>
					<button
						type="button"
						className={styles.menuItem}
						onClick={() => {
							void openSite(contextMenu.site.url, true);
							setContextMenu(null);
						}}
					>
						Open in New Tab
					</button>
					<button
						type="button"
						className={`${styles.menuItem} ${styles.menuItemDanger}`}
						onClick={() => {
							removePinnedSite(activeSpaceId, contextMenu.site.id);
							setContextMenu(null);
							showStatus('Pin removed');
						}}
					>
						Remove Pin
					</button>
				</div>
			) : null}
		</div>
	);
}