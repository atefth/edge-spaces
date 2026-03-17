import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

import { SEARCH_DEBOUNCE_MS } from '../../shared/constants';
import { useAppStore } from '../../shared/store';
import styles from './SearchBar.module.css';

interface SearchBarProps {
	onArrowDown: () => void;
}

function focusTreeRoot() {
	window.setTimeout(() => {
		const treeRoot = document.querySelector<HTMLElement>('[data-tree-root="true"]');
		treeRoot?.focus();
	}, 0);
}

export const SearchBar = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
	{ onArrowDown },
	ref,
) {
	const searchQuery = useAppStore((state) => state.searchQuery);
	const setSearchQuery = useAppStore((state) => state.setSearchQuery);
	const inputRef = useRef<HTMLInputElement>(null);
	const [draftQuery, setDraftQuery] = useState(searchQuery);

	useImperativeHandle(ref, () => inputRef.current as HTMLInputElement, []);

	useEffect(() => {
		setDraftQuery(searchQuery);
	}, [searchQuery]);

	useEffect(() => {
		const timeoutId = window.setTimeout(() => {
			setSearchQuery(draftQuery);
		}, SEARCH_DEBOUNCE_MS);

		return () => {
			window.clearTimeout(timeoutId);
		};
	}, [draftQuery, setSearchQuery]);

	useEffect(() => {
		function handleFocusMessage(message: unknown) {
			if (!message || typeof message !== 'object' || (message as { type?: string }).type !== 'FOCUS_SEARCH') {
				return;
			}

			inputRef.current?.focus();
			inputRef.current?.select();
		}

		chrome.runtime.onMessage.addListener(handleFocusMessage);

		return () => {
			chrome.runtime.onMessage.removeListener(handleFocusMessage);
		};
	}, []);

	function clearQuery() {
		setDraftQuery('');
		setSearchQuery('');
		focusTreeRoot();
	}

	return (
		<div className={styles.shell}>
			<label className={styles.searchField}>
				<svg viewBox="0 0 20 20" className={styles.icon} aria-hidden="true">
					<path
						d="M13.9 12.5 17 15.6l-1.4 1.4-3.1-3.1a6 6 0 1 1 1.4-1.4ZM8.5 13a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Z"
						fill="currentColor"
					/>
				</svg>
				<input
					ref={inputRef}
					type="search"
					role="searchbox"
					aria-label="Search bookmarks"
					className={styles.input}
					placeholder="Search bookmarks..."
					value={draftQuery}
					onChange={(event) => setDraftQuery(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === 'ArrowDown' && draftQuery.trim()) {
							event.preventDefault();
							onArrowDown();
						}

						if (event.key === 'Escape' && draftQuery) {
							event.preventDefault();
							clearQuery();
						}
					}}
				/>
				<button
					type="button"
					className={`${styles.clearButton} ${draftQuery ? styles.clearButtonVisible : ''}`}
					onClick={clearQuery}
					aria-label="Clear search"
				>
					×
				</button>
			</label>
		</div>
	);
});