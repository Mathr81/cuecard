'use client';

import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { useTranslations } from 'next-intl';
import { ICON, X, iconProps } from '@/components/icons';
import { useMediaQuery } from '@/hooks/useMediaQuery';

/** Au-delà, le geste est une intention de fermer, pas une hésitation. */
const DISMISS_DISTANCE_PX = 110;

interface Props {
  open: boolean;
  title: string;
  subtitle?: string;
  /** Une commande posée dans l'en-tête, à gauche de la croix. */
  action?: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Feuille glissante en bas sur mobile (attrapable au pouce, fermable d'un
 * balayage vers le bas) et panneau latéral sur desktop, où le bas de l'écran
 * est loin de la souris.
 *
 * Le panneau reste monté en permanence : l'ouverture et la fermeture ne sont
 * qu'un changement de classe, donc les deux sens s'animent sans machine à états.
 */
export function BottomSheet({ open, title, subtitle, action, onClose, children }: Props) {
  const t = useTranslations('reader');
  const isDesktop = useMediaQuery('(min-width: 640px)');

  const [drag, setDrag] = useState<{ startY: number; offset: number } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open) {
      previouslyFocused.current = document.activeElement as HTMLElement | null;
      sheetRef.current?.focus();
      return;
    }
    // Rendre le focus au mot qu'on venait de toucher, pas au début de la page.
    previouslyFocused.current?.focus();
    previouslyFocused.current = null;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  function onGrabberDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (isDesktop) return;
    setDrag({ startY: event.clientY, offset: 0 });
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onGrabberMove(event: ReactPointerEvent<HTMLDivElement>) {
    setDrag((current) =>
      current ? { ...current, offset: Math.max(0, event.clientY - current.startY) } : null
    );
  }

  function onGrabberUp() {
    if (!drag) return;
    const travelled = drag.offset;
    setDrag(null);
    // On garde la feuille là où le doigt l'a laissée : la classe de fermeture
    // prend le relais vers le bas, sans saut.
    if (travelled > DISMISS_DISTANCE_PX) onClose();
  }

  return (
    <div className={`fixed inset-0 z-50 ${open ? '' : 'pointer-events-none'}`} inert={!open}>
      <button
        type="button"
        aria-label={t('close')}
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${
          open ? 'opacity-100' : 'opacity-0'
        }`}
      />

      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={drag ? { transform: `translateY(${drag.offset}px)`, transition: 'none' } : undefined}
        className={`absolute inset-x-0 bottom-0 flex max-h-[85dvh] flex-col rounded-t-2xl border-t border-line bg-surface transition-transform duration-200 ease-out outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:w-[26rem] sm:rounded-none sm:rounded-l-2xl sm:border-l sm:border-t-0 ${
          open
            ? 'translate-y-0 sm:translate-x-0'
            : 'translate-y-full sm:translate-y-0 sm:translate-x-full'
        }`}
      >
        <div
          onPointerDown={onGrabberDown}
          onPointerMove={onGrabberMove}
          onPointerUp={onGrabberUp}
          onPointerCancel={onGrabberUp}
          className="shrink-0 cursor-grab touch-none px-4 pt-3 sm:cursor-default"
        >
          <div className="mx-auto h-1 w-10 rounded-full bg-line sm:hidden" />
          <div className="flex items-start gap-3 pt-4 pb-3">
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-2xl font-semibold tracking-tight text-ink">{title}</h2>
              {/* La réplique d'où vient le mot : le contexte, pas le sujet. */}
              {subtitle ? (
                <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-dim">{subtitle}</p>
              ) : null}
            </div>
            {action}
            <button
              type="button"
              onClick={onClose}
              aria-label={t('close')}
              className="press -mr-1 flex size-11 shrink-0 items-center justify-center rounded-xl text-muted"
            >
              <X size={ICON} {...iconProps} />
            </button>
          </div>
        </div>

        <div className="pb-safe flex-1 overflow-y-auto overscroll-contain px-4 pb-6">
          {children}
        </div>
      </div>
    </div>
  );
}
