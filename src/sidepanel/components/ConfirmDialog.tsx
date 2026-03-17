import { useEffect, useId, useRef } from 'react';

import styles from './ConfirmDialog.module.css';

interface ConfirmDialogProps {
	title: string;
	message: string;
	confirmLabel: string;
	onConfirm: () => void;
	onCancel: () => void;
	destructive?: boolean;
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
	return Array.from(
		container.querySelectorAll<HTMLElement>(
			'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
		),
	).filter((element) => !element.hasAttribute('disabled'));
}

export function ConfirmDialog({
	title,
	message,
	confirmLabel,
	onConfirm,
	onCancel,
	destructive = false,
}: ConfirmDialogProps) {
	const titleId = useId();
	const messageId = useId();
	const dialogRef = useRef<HTMLDivElement>(null);

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
				onCancel();
				return;
			}

			if (event.key === 'Enter') {
				event.preventDefault();
				onConfirm();
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
	}, [onCancel, onConfirm]);

	return (
		<div className={styles.backdrop} onMouseDown={onCancel}>
			<div
				ref={dialogRef}
				role="alertdialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={messageId}
				tabIndex={-1}
				className={styles.dialog}
				onMouseDown={(event) => event.stopPropagation()}
			>
				<div className={styles.content}>
					<h2 id={titleId} className={styles.title}>
						{title}
					</h2>
					<p id={messageId} className={styles.message}>
						{message}
					</p>
				</div>
				<div className={styles.actions}>
					<button type="button" className={styles.secondaryButton} onClick={onCancel}>
						Cancel
					</button>
					<button
						type="button"
						className={destructive ? styles.destructiveButton : styles.primaryButton}
						onClick={onConfirm}
					>
						{confirmLabel}
					</button>
				</div>
			</div>
		</div>
	);
}