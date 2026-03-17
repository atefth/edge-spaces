import { useEffect, useId, useMemo, useRef, useState } from 'react';

import {
	ArcImportParser,
	convertToStorageData,
	getParsedFolderBookmarkCount,
	type ParseResult,
	type ParsedFolder,
	type ParsedSpace,
} from '../../shared/arc-import-parser';
import { useAppStore } from '../../shared/store';
import styles from './ImportWizard.module.css';

type ImportMode = 'merge' | 'replace';

interface ImportWizardProps {
	onClose: () => void;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
	return Array.from(
		container.querySelectorAll<HTMLElement>(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
		),
	).filter((element) => !element.hasAttribute('disabled'));
}

function getInitialExpandedKeys(result: ParseResult): Set<string> {
	const keys = new Set<string>();

	for (const [spaceIndex, space] of result.spaces.entries()) {
		keys.add(`space-${spaceIndex}`);

		for (const [folderIndex] of space.rootFolders.entries()) {
			keys.add(`space-${spaceIndex}-folder-${folderIndex}`);
		}
	}

	return keys;
}

function TreePreview({
	result,
	expandedKeys,
	onToggle,
}: {
	result: ParseResult;
	expandedKeys: Set<string>;
	onToggle: (key: string) => void;
}) {
	return (
		<div className={styles.previewTree}>
			{result.spaces.map((space, index) => (
				<SpacePreviewNode
					key={`space-${index}`}
					space={space}
					nodeKey={`space-${index}`}
					expandedKeys={expandedKeys}
					onToggle={onToggle}
				/>
			))}
		</div>
	);
}

function SpacePreviewNode({
	space,
	nodeKey,
	expandedKeys,
	onToggle,
}: {
	space: ParsedSpace;
	nodeKey: string;
	expandedKeys: Set<string>;
	onToggle: (key: string) => void;
}) {
	const isExpanded = expandedKeys.has(nodeKey);

	return (
		<div className={styles.treeNode}>
			<button type="button" className={styles.treeToggle} onClick={() => onToggle(nodeKey)}>
				<span className={styles.treeChevron} aria-hidden="true">{isExpanded ? '▼' : '▶'}</span>
				<span className={styles.treeLabel}>{space.name}</span>
			</button>
			{isExpanded ? (
				<div className={styles.treeChildren}>
					{space.rootFolders.length === 0 ? <div className={styles.treeEmpty}>No folders</div> : null}
					{space.rootFolders.map((folder, index) => (
						<FolderPreviewNode
							key={`${nodeKey}-folder-${index}`}
							folder={folder}
							nodeKey={`${nodeKey}-folder-${index}`}
							expandedKeys={expandedKeys}
							onToggle={onToggle}
						/>
					))}
				</div>
			) : null}
		</div>
	);
}

function FolderPreviewNode({
	folder,
	nodeKey,
	expandedKeys,
	onToggle,
}: {
	folder: ParsedFolder;
	nodeKey: string;
	expandedKeys: Set<string>;
	onToggle: (key: string) => void;
}) {
	const isExpanded = expandedKeys.has(nodeKey);
	const bookmarkCount = getParsedFolderBookmarkCount(folder);
	const childFolders = folder.children.filter((child): child is ParsedFolder => !('url' in child));

	return (
		<div className={styles.treeNode}>
			<button type="button" className={styles.treeToggle} onClick={() => onToggle(nodeKey)}>
				<span className={styles.treeChevron} aria-hidden="true">{isExpanded ? '▼' : '▶'}</span>
				<span className={styles.treeLabel}>{folder.name}</span>
				<span className={styles.treeCount}>({bookmarkCount})</span>
			</button>
			{isExpanded ? (
				<div className={styles.treeChildren}>
					{childFolders.map((childFolder, index) => (
						<FolderPreviewNode
							key={`${nodeKey}-folder-${index}`}
							folder={childFolder}
							nodeKey={`${nodeKey}-folder-${index}`}
							expandedKeys={expandedKeys}
							onToggle={onToggle}
						/>
					))}
				</div>
			) : null}
		</div>
	);
}

export function ImportWizard({ onClose }: ImportWizardProps) {
	const titleId = useId();
	const dialogRef = useRef<HTMLDivElement>(null);
	const fileInputRef = useRef<HTMLInputElement>(null);
	const importData = useAppStore((state) => state.importData);
	const [step, setStep] = useState<1 | 2 | 3>(1);
	const [mode, setMode] = useState<ImportMode>('merge');
	const [parseResult, setParseResult] = useState<ParseResult | null>(null);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isReadingFile, setIsReadingFile] = useState(false);
	const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());

	const summary = useMemo(() => {
		if (!parseResult) {
			return null;
		}

		return {
			spaces: parseResult.spaces.length,
			folders: parseResult.totalFolders,
			bookmarks: parseResult.totalBookmarks,
			pinnedSites: parseResult.totalPinnedSites,
		};
	}, [parseResult]);

	useEffect(() => {
		const previousActiveElement = document.activeElement instanceof HTMLElement ? document.activeElement : null;
		const dialog = dialogRef.current;

		if (!dialog) {
			return;
		}

		const focusableElements = getFocusableElements(dialog);
		(focusableElements[0] ?? dialog).focus();

		function handleKeyDown(event: KeyboardEvent) {
			if (!dialogRef.current) {
				return;
			}

			if (event.key === 'Escape') {
				event.preventDefault();
				onClose();
				return;
			}

			if (event.key !== 'Tab') {
				return;
			}

			const nodes = getFocusableElements(dialogRef.current);

			if (nodes.length === 0) {
				event.preventDefault();
				dialogRef.current.focus();
				return;
			}

			const firstNode = nodes[0];
			const lastNode = nodes[nodes.length - 1];
			const activeElement = document.activeElement;

			if (event.shiftKey && activeElement === firstNode) {
				event.preventDefault();
				lastNode.focus();
				return;
			}

			if (!event.shiftKey && activeElement === lastNode) {
				event.preventDefault();
				firstNode.focus();
			}
		}

		document.addEventListener('keydown', handleKeyDown);

		return () => {
			document.removeEventListener('keydown', handleKeyDown);
			previousActiveElement?.focus();
		};
	}, [onClose]);

	function handleToggleNode(key: string) {
		setExpandedKeys((current) => {
			const next = new Set(current);

			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}

			return next;
		});
	}

	function handleChooseFile() {
		fileInputRef.current?.click();
	}

	function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
		const file = event.target.files?.[0];
		event.target.value = '';

		if (!file) {
			return;
		}

		setIsReadingFile(true);
		setErrorMessage(null);

		const reader = new FileReader();

		reader.onerror = () => {
			setIsReadingFile(false);
			setErrorMessage('The selected file could not be read.');
		};

		reader.onload = () => {
			try {
				const parser = new ArcImportParser();
				const result = parser.parse(String(reader.result ?? ''));
				setParseResult(result);
				setExpandedKeys(getInitialExpandedKeys(result));
				setStep(2);
			} catch (error) {
				setErrorMessage(error instanceof Error ? error.message : 'Import parsing failed.');
			} finally {
				setIsReadingFile(false);
			}
		};

		reader.readAsText(file);
	}

	function handleImport() {
		if (!parseResult) {
			return;
		}

		const storageData = convertToStorageData(parseResult);
		importData(storageData, mode);
		setStep(3);
	}

	return (
		<div className={styles.backdrop} onMouseDown={onClose}>
			<div
				ref={dialogRef}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				tabIndex={-1}
				className={styles.dialog}
				onMouseDown={(event) => event.stopPropagation()}
			>
				<input
					ref={fileInputRef}
					type="file"
					accept=".html,text/html"
					className={styles.hiddenInput}
					onChange={handleFileSelected}
				/>

				{step === 1 ? (
					<div className={styles.stepLayout}>
						<div className={styles.headerBlock}>
							<h2 id={titleId} className={styles.title}>Import from Arc Browser</h2>
							<p className={styles.description}>Select your Arc bookmarks export file to preview and import it.</p>
						</div>
						<div className={styles.fileCard}>
							<div className={styles.filePrompt}>Select your Arc bookmarks export file (.html)</div>
							<button type="button" className={styles.primaryButton} onClick={handleChooseFile} disabled={isReadingFile}>
								{isReadingFile ? 'Reading file...' : 'Choose File'}
							</button>
							{errorMessage ? <div className={styles.errorBanner}>{errorMessage}</div> : null}
						</div>
						<div className={styles.instructionsCard}>
							<div className={styles.instructionsTitle}>How to export from Arc</div>
							<ol className={styles.instructionsList}>
								<li>Open Arc and go to Settings.</li>
								<li>Click Export Arc Browser Bookmarks.</li>
								<li>Save the exported .html file.</li>
							</ol>
						</div>
						<div className={styles.actions}>
							<button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button>
						</div>
					</div>
				) : null}

				{step === 2 && parseResult && summary ? (
					<div className={styles.stepLayout}>
						<div className={styles.headerBlock}>
							<h2 id={titleId} className={styles.title}>Import Preview</h2>
							<p className={styles.description}>Review what was found before it is added to Edge Spaces.</p>
						</div>

						<div className={styles.summaryGrid}>
							<div className={styles.summaryCard}><span className={styles.summaryValue}>{summary.spaces}</span><span className={styles.summaryLabel}>Spaces</span></div>
							<div className={styles.summaryCard}><span className={styles.summaryValue}>{summary.folders}</span><span className={styles.summaryLabel}>Folders</span></div>
							<div className={styles.summaryCard}><span className={styles.summaryValue}>{summary.bookmarks}</span><span className={styles.summaryLabel}>Bookmarks</span></div>
							<div className={styles.summaryCard}><span className={styles.summaryValue}>{summary.pinnedSites}</span><span className={styles.summaryLabel}>Pinned sites</span></div>
						</div>

						{parseResult.warnings.length > 0 ? (
							<div className={styles.warningCard}>
								<div className={styles.warningTitle}>Warnings ({parseResult.warnings.length})</div>
								<ul className={styles.warningList}>
									{parseResult.warnings.map((warning) => (
										<li key={warning}>{warning}</li>
									))}
								</ul>
							</div>
						) : null}

						<div className={styles.previewSection}>
							<div className={styles.sectionTitle}>Preview</div>
							<TreePreview result={parseResult} expandedKeys={expandedKeys} onToggle={handleToggleNode} />
						</div>

						<div className={styles.modeSection}>
							<div className={styles.sectionTitle}>Import mode</div>
							<label className={styles.modeOption}>
								<input type="radio" name="import-mode" value="merge" checked={mode === 'merge'} onChange={() => setMode('merge')} />
								<span>Merge with existing data</span>
							</label>
							<label className={styles.modeOption}>
								<input type="radio" name="import-mode" value="replace" checked={mode === 'replace'} onChange={() => setMode('replace')} />
								<span>Replace all existing data</span>
							</label>
							{mode === 'replace' ? <div className={styles.replaceWarning}>This will delete all existing spaces, folders, and bookmarks.</div> : null}
						</div>

						<div className={styles.actions}>
							<button type="button" className={styles.secondaryButton} onClick={onClose}>Cancel</button>
							<button type="button" className={styles.primaryButton} onClick={handleImport}>Import</button>
						</div>
					</div>
				) : null}

				{step === 3 && summary ? (
					<div className={styles.stepLayout}>
						<div className={styles.headerBlock}>
							<h2 id={titleId} className={styles.title}>Import Complete</h2>
							<p className={styles.description}>Your Arc bookmarks were imported into Edge Spaces.</p>
						</div>
						<div className={styles.successCard} aria-live="polite" aria-atomic="true">
							<div className={styles.srOnly}>Import complete: {summary.bookmarks} bookmarks imported.</div>
							<div className={styles.successRow}><span>Spaces</span><strong>{summary.spaces}</strong></div>
							<div className={styles.successRow}><span>Folders</span><strong>{summary.folders}</strong></div>
							<div className={styles.successRow}><span>Bookmarks</span><strong>{summary.bookmarks}</strong></div>
							<div className={styles.successRow}><span>Pinned sites</span><strong>{summary.pinnedSites}</strong></div>
						</div>
						<div className={styles.actions}>
							<button type="button" className={styles.primaryButton} onClick={onClose}>Done</button>
						</div>
					</div>
				) : null}
			</div>
		</div>
	);
}