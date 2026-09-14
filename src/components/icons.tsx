import {
  ArrowLeft,
  ArrowUpRight,
  BookmarkSimple,
  CaretLeft,
  CaretRight,
  DownloadSimple,
  GearSix,
  SpeakerHigh,
  X,
} from '@phosphor-icons/react/dist/ssr';

/**
 * Une seule famille d'icônes, une seule graisse, déclarées ici et nulle part
 * ailleurs. L'app se lit dans le noir à bout de bras : un trait fin disparaît,
 * donc tout est en `bold`. Le point d'entrée `dist/ssr` rend les icônes
 * utilisables aussi bien dans un composant serveur que client.
 *
 * Les icônes sont toujours décoratives : ce qui les rend compréhensibles est
 * l'`aria-label` du bouton qui les contient, pas l'icône elle-même.
 */
export {
  ArrowLeft,
  ArrowUpRight,
  BookmarkSimple,
  CaretLeft,
  CaretRight,
  DownloadSimple,
  GearSix,
  SpeakerHigh,
  X,
};

/** Taille d'icône dans une cible tactile de 44px. */
export const ICON = 20;
/** Les deux flèches du lecteur : visées au pouce, sans regarder. */
export const ICON_LARGE = 28;

export const iconProps = { weight: 'bold', 'aria-hidden': true } as const;
