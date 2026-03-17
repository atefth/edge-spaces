import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import styles from './ContextMenu.module.css';

export interface ContextMenuItem {
	label: string;
	icon?: React.ReactNode;
	onClick?: () => void;
	disabled?: boolean;
	destructive?: boolean;
	separator?: boolean;
	children?: ContextMenuItem[];
}

interface ContextMenuProps {
	items: ContextMenuItem[];
	position: { x: number; y: number };
	onClose: () => void;
}

interface MeasuredPosition {
	x: number;
	y: number;
	openLeft: boolean;
}

const VIEWPORT_MARGIN = 12;

export function ContextMenu({ items, position, onClose }: ContextMenuProps) {
	const menuRef = useRef<HTMLDivElement>(null);
	const [activeSubmenuIndex, setActiveSubmenuIndex] = useState<number | null>(null);
	const [measuredPosition, setMeasuredPosition] = useState<MeasuredPosition>({
		x: position.x,
		y: position.y,
		openLeft: false,
	});

	useEffect(() => {
		setMeasuredPosition({ x: position.x, y: position.y, openLeft: false });
	}, [position.x, position.y]);

	useEffect(() => {
		const menu = menuRef.current;

		if (!menu) {
			return;
		}

		const rect = menu.getBoundingClientRect();
		const x = Math.max(VIEWPORT_MARGIN, Math.min(position.x, window.innerWidth - rect.width - VIEWPORT_MARGIN));
		const y = Math.max(VIEWPORT_MARGIN, Math.min(position.y, window.innerHeight - rect.height - VIEWPORT_MARGIN));
		const openLeft = window.innerWidth - x < rect.width * 2;

		setMeasuredPosition((current) => {
			if (current.x === x && current.y === y && current.openLeft === openLeft) {
				return current;
			}

			return { x, y, openLeft };
		});
	}, [items, position.x, position.y]);

	useEffect(() => {
		function handlePointerDown(event: MouseEvent) {
			if (menuRef.current?.contains(event.target as Node)) {
				return;
			}

			onClose();
		}

		function handleKeyDown(event: KeyboardEvent) {
			if (event.key === 'Escape') {
				onClose();
			}
		}

		function handleScroll() {
			onClose();
		}

		document.addEventListener('mousedown', handlePointerDown);
		document.addEventListener('keydown', handleKeyDown);
		window.addEventListener('scroll', handleScroll, true);
		window.addEventListener('blur', onClose);

		return () => {
			document.removeEventListener('mousedown', handlePointerDown);
			document.removeEventListener('keydown', handleKeyDown);
			window.removeEventListener('scroll', handleScroll, true);
			window.removeEventListener('blur', onClose);
		};
	}, [onClose]);

	const content = useMemo(
		() => (
			<div
				ref={menuRef}
				className={styles.menu}
				style={{ left: measuredPosition.x, top: measuredPosition.y }}
				role="menu"
			>
				{items.map((item, index) => {
					if (item.separator) {
						return <div key={`separator-${index}`} className={styles.separator} role="separator" />;
					}

					const isSubmenuOpen = activeSubmenuIndex === index && Boolean(item.children?.length);

					return (
						<div
							key={`${item.label}-${index}`}
							className={styles.itemGroup}
							onMouseEnter={() => setActiveSubmenuIndex(item.children?.length ? index : null)}
							onMouseLeave={() => setActiveSubmenuIndex((current) => (current === index ? null : current))}
						>
							<button
								type="button"
								className={`${styles.item} ${item.destructive ? styles.itemDestructive : ''}`}
								disabled={item.disabled}
								role="menuitem"
								onClick={() => {
									if (item.disabled) {
										return;
									}

									if (item.children?.length) {
										setActiveSubmenuIndex((current) => (current === index ? null : index));
										return;
									}

									item.onClick?.();
									onClose();
								}}
								onFocus={() => setActiveSubmenuIndex(item.children?.length ? index : null)}
							>
								<span className={styles.itemLead}>
									{item.icon ? <span className={styles.icon}>{item.icon}</span> : <span className={styles.iconSpacer} />}
									<span className={styles.label}>{item.label}</span>
								</span>
								{item.children?.length ? <span className={styles.chevron}>›</span> : null}
							</button>

							{isSubmenuOpen ? (
								<div className={`${styles.submenu} ${measuredPosition.openLeft ? styles.submenuLeft : ''}`}>
									{item.children.map((child, childIndex) => {
										if (child.separator) {
											return <div key={`child-separator-${childIndex}`} className={styles.separator} role="separator" />;
										}

										return (
											<button
												key={`${child.label}-${childIndex}`}
												type="button"
												className={`${styles.item} ${child.destructive ? styles.itemDestructive : ''}`}
												disabled={child.disabled}
												role="menuitem"
												onClick={() => {
													if (child.disabled) {
														return;
													}

													child.onClick?.();
													onClose();
												}}
											>
												<span className={styles.itemLead}>
													{child.icon ? <span className={styles.icon}>{child.icon}</span> : <span className={styles.iconSpacer} />}
													<span className={styles.label}>{child.label}</span>
												</span>
											</button>
										);
									})}
								</div>
							) : null}
						</div>
					);
				})}
			</div>
		),
		[activeSubmenuIndex, items, measuredPosition.openLeft, measuredPosition.x, measuredPosition.y, onClose],
	);

	return createPortal(content, document.body);
}