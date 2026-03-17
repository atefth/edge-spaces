import { useEffect, useRef, useState } from 'react';

import styles from './InlineEdit.module.css';

interface InlineEditProps {
	value: string;
	onSave: (newValue: string) => void;
	onCancel: () => void;
}

export function InlineEdit({ value, onSave, onCancel }: InlineEditProps) {
	const inputRef = useRef<HTMLInputElement>(null);
	const finishedRef = useRef(false);
	const [draftValue, setDraftValue] = useState(value);

	useEffect(() => {
		const input = inputRef.current;

		if (!input) {
			return;
		}

		input.focus();
		input.select();
	}, []);

	function handleSave() {
		if (finishedRef.current) {
			return;
		}

		const trimmedValue = draftValue.trim();

		if (!trimmedValue) {
			finishedRef.current = true;
			onCancel();
			return;
		}

		finishedRef.current = true;
		onSave(trimmedValue);
	}

	function handleCancel() {
		if (finishedRef.current) {
			return;
		}

		finishedRef.current = true;
		onCancel();
	}

	return (
		<input
			ref={inputRef}
			className={styles.input}
			value={draftValue}
			onBlur={handleSave}
			onChange={(event) => setDraftValue(event.target.value)}
			onClick={(event) => event.stopPropagation()}
			onKeyDown={(event) => {
				event.stopPropagation();

				if (event.key === 'Enter') {
					event.preventDefault();
					handleSave();
					return;
				}

				if (event.key === 'Escape') {
					event.preventDefault();
					handleCancel();
				}
			}}
		/>
	);
}