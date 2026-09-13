export interface DecodedSubtitle {
  text: string;
  encoding: string;
}

function startsWith(bytes: Uint8Array, signature: number[]): boolean {
  return signature.every((byte, i) => bytes[i] === byte);
}

/**
 * Les .srt téléchargés sont tantôt en UTF-8, tantôt en latin-1 (windows-1252).
 * Décoder du latin-1 comme de l'UTF-8 casse tous les accents, et l'inverse
 * produit du mojibake : on détecte au lieu de supposer.
 */
export function decodeSubtitleBuffer(buffer: ArrayBuffer): DecodedSubtitle {
  const bytes = new Uint8Array(buffer);

  if (startsWith(bytes, [0xef, 0xbb, 0xbf])) {
    return { text: strip(new TextDecoder('utf-8').decode(bytes)), encoding: 'utf-8' };
  }
  if (startsWith(bytes, [0xff, 0xfe])) {
    return { text: strip(new TextDecoder('utf-16le').decode(bytes)), encoding: 'utf-16le' };
  }
  if (startsWith(bytes, [0xfe, 0xff])) {
    return { text: strip(new TextDecoder('utf-16be').decode(bytes)), encoding: 'utf-16be' };
  }

  try {
    // `fatal` fait échouer le décodage sur toute séquence invalide : c'est
    // exactement le signal qui distingue un fichier latin-1 d'un fichier UTF-8.
    const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    return { text: strip(text), encoding: 'utf-8' };
  } catch {
    return { text: strip(new TextDecoder('windows-1252').decode(bytes)), encoding: 'windows-1252' };
  }
}

function strip(text: string): string {
  return text.replace(/^﻿/, '');
}
