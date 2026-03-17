import { type CSSProperties, type HTMLAttributes, type Ref, useEffect, useRef, useState } from 'react';

import { getFaviconUrl } from '../../shared/favicon';
import { useAppStore } from '../../shared/store';
import { ContextMenu, type ContextMenuItem } from './ContextMenu';
import { InlineEdit } from './InlineEdit';
import styles from './BookmarkItem.module.css';

interface BookmarkItemProps {
	bookmarkId: string;
	depth: number;
	isRenaming: boolean;
	isEditingForm: boolean;
	rowAttributes?: HTMLAttributes<HTMLDivElement> & Record<string, unknown>;
	rowClassName?: string;
	rowRef?: Ref<HTMLDivElement>;
	rowStyle?: CSSProperties;
	onStartBookmarkRename: (itemId: string) => void;
	onStartBookmarkForm: (itemId: string) => void;
	onClearEditing: () => void;
	onShowStatus: (message: string) => void;
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

function isOpenableUrl(url: string): boolean {
	try {
		const parsedUrl = new URL(url);
		return /^https?:$/.test(parsedUrl.protocol);
	} catch {
		return false;
	}
}

function isBookmarkUrlDraft(url: string): boolean {
	return /^https?:\/\//i.test(url.trim());
}

export function BookmarkItem({
	bookmarkId,
	depth,
	isRenaming,
	isEditingForm,
	rowAttributes,
	rowClassName,
	rowRef,
	rowStyle,
	onStartBookmarkRename,
	onStartBookmarkForm,
	onClearEditing,
	onShowStatus,
}: BookmarkItemProps) {
	const bookmark = useAppStore((state) => state.bookmarks[bookmarkId]);
	const deleteBookmark = useAppStore((state) => state.deleteBookmark);
	const updateBookmark = useAppStore((state) => state.updateBookmark);
	const [contextMenuPosition, setContextMenuPosition] = useState<{ x: number; y: number } | null>(null);
	const [draftTitle, setDraftTitle] = useState(bookmark?.title ?? '');
	const [draftUrl, setDraftUrl] = useState(bookmark?.url ?? 'https://');
	const [formError, setFormError] = useState<string | null>(null);
	const [hasImageError, setHasImageError] = useState(false);
	const clickTimeoutRef = useRef<number | null>(null);

	useEffect(() => {
		return () => {
			if (clickTimeoutRef.current !== null) {
				window.clearTimeout(clickTimeoutRef.current);
			}
		};
	}, []);

	useEffect(() => {
		setHasImageError(false);
	}, [bookmark?.faviconUrl, bookmark?.url]);

	useEffect(() => {
		if (!bookmark) {
			return;
		}

		setDraftTitle(bookmark.title);
		setDraftUrl(bookmark.url);
		setFormError(null);
	}, [bookmark, isEditingForm]);

	if (!bookmark) {
		return null;
	}

	function clearPendingOpen() {
		if (clickTimeoutRef.current !== null) {
			window.clearTimeout(clickTimeoutRef.current);
			clickTimeoutRef.current = null;
		}
	}

	async function openBookmark(openInNewTab: boolean) {
		if (!isOpenableUrl(bookmark.url)) {
			onShowStatus('Finish the bookmark URL before opening it');
			return;
		}

		if (openInNewTab) {
			await chrome.tabs.create({ url: bookmark.url });
			return;
		}

		await chrome.tabs.update({ url: bookmark.url });
	}

	async function copyUrl() {
		try {
			await navigator.clipboard.writeText(bookmark.url);
			onShowStatus('URL copied');
		} catch {
			onShowStatus('Clipboard access failed');
		}
	}

	function saveForm() {
		const trimmedTitle = draftTitle.trim();
		const trimmedUrl = draftUrl.trim();

		if (!trimmedTitle) {
			setFormError('Title is required');
			return;
		}

		if (!isBookmarkUrlDraft(trimmedUrl)) {
			setFormError('URL must start with http:// or https://');
			return;
		}

		updateBookmark(bookmark.id, { title: trimmedTitle, url: trimmedUrl });
		onClearEditing();
	}

	const menuItems: ContextMenuItem[] = [
		{ label: 'Open', onClick: () => void openBookmark(false) },
		{ label: 'Open in New Tab', onClick: () => void openBookmark(true) },
		{ label: 'Edit', onClick: () => onStartBookmarkForm(bookmark.id) },
		{ label: 'Copy URL', onClick: () => void copyUrl() },
		{ label: 'Move to…', disabled: true },
		{ label: 'Delete', destructive: true, onClick: () => deleteBookmark(bookmark.id) },
	];

	return (
		<>
			{isEditingForm ? (
				<div className={styles.formShell} style={{ '--node-depth': depth } as React.CSSProperties}>
					<div className={styles.formCard}>
						<label className={styles.formField}>
							<span className={styles.formLabel}>Title</span>
							<input
								type="text"
								value={draftTitle}
								onChange={(event) => setDraftTitle(event.target.value)}
								className={styles.formInput}
							/>
						</label>
						<label className={styles.formField}>
							<span className={styles.formLabel}>URL</span>
							<input
								type="url"
								value={draftUrl}
								onChange={(event) => setDraftUrl(event.target.value)}
								className={styles.formInput}
							/>
						</label>
						{formError ? <div className={styles.formError}>{formError}</div> : null}
						<div className={styles.formActions}>
							<button type="button" className={styles.formSecondaryButton} onClick={onClearEditing}>
								Cancel
							</button>
							<button type="button" className={styles.formPrimaryButton} onClick={saveForm}>
								Save
							</button>
						</div>
					</div>
				</div>
			) : null}

			<div
				ref={rowRef}
				style={{ ...rowStyle, '--node-depth': depth } as CSSProperties}
				{...rowAttributes}
				className={`${styles.row} ${rowClassName ?? ''}`.trim()}
				onContextMenu={(event) => {
					rowAttributes?.onContextMenu?.(event);

					if (event.defaultPrevented) {
						return;
					}

					event.preventDefault();
					setContextMenuPosition({ x: event.clientX, y: event.clientY });
				}}
			>
				<div className={styles.leading}>
					{!hasImageError && (bookmark.faviconUrl || getFaviconUrl(bookmark.url, 16)) ? (
						<img
							className={styles.favicon}
							src={bookmark.faviconUrl || getFaviconUrl(bookmark.url, 16)}
							alt=""
							onError={() => setHasImageError(true)}
						/>
					) : (
						<GlobeIcon />
					)}
				</div>

				<div className={styles.content}>
					{isRenaming ? (
						<InlineEdit
							value={bookmark.title}
							onCancel={onClearEditing}
							onSave={(nextTitle) => {
								updateBookmark(bookmark.id, { title: nextTitle });
								onClearEditing();
							}}
						/>
					) : (
						<button
							type="button"
							className={styles.labelButton}
							onClick={(event) => {
								if (event.ctrlKey || event.metaKey) {
									event.preventDefault();
									void openBookmark(true);
									return;
								}

								if (event.detail !== 1) {
									return;
								}

								clearPendingOpen();
								clickTimeoutRef.current = window.setTimeout(() => {
									void openBookmark(false);
									clickTimeoutRef.current = null;
								}, 180);
							}}
							onAuxClick={(event) => {
								if (event.button === 1) {
									event.preventDefault();
									clearPendingOpen();
									void openBookmark(true);
								}
							}}
							onDoubleClick={(event) => {
								event.preventDefault();
								clearPendingOpen();
								onStartBookmarkRename(bookmark.id);
							}}
							title={bookmark.url}
						>
							<span className={styles.title}>{bookmark.title}</span>
							<span className={styles.url}>{bookmark.url}</span>
						</button>
					)}
				</div>

				<button
					type="button"
					className={styles.menuButton}
					onClick={(event) => {
						const rect = event.currentTarget.getBoundingClientRect();
						setContextMenuPosition({ x: rect.right - 8, y: rect.bottom + 6 });
					}}
					aria-label={`Bookmark actions for ${bookmark.title}`}
				>
					⋯
				</button>
			</div>

			{contextMenuPosition ? (
				<ContextMenu
					items={menuItems}
					position={contextMenuPosition}
					onClose={() => setContextMenuPosition(null)}
				/>
			) : null}
		</>
	);
}