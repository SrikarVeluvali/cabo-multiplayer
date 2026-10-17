// Build-time only: never import this filesystem check into a client component.
import path from 'node:path';
import sharp, { type Metadata } from 'sharp';
import { deckAssets, deckThemes, type DeckTheme } from './deck-themes';

export async function checkDeckAssets(
  directory: string,
  themes: readonly DeckTheme[] = deckThemes,
) {
  const root = path.resolve(directory);
  const metadata = new Map<string, Promise<Metadata>>();
  const read = (asset: string) => {
    const file = path.resolve(root, `.${asset}`);
    if (!file.startsWith(root + path.sep))
      throw new Error(`Deck asset escapes public directory: ${asset}`);
    if (!metadata.has(asset))
      metadata.set(
        asset,
        sharp(file)
          .metadata()
          .catch(() => {
            throw new Error(`Missing or unreadable deck image: ${asset}`);
          }),
      );
    return metadata.get(asset)!;
  };
  const results = [];
  for (const theme of themes) {
    await Promise.all(deckAssets(theme).map(read));
    if (theme.face.type === 'atlas') {
      const face = theme.face,
        info = await read(face.image);
      if (
        !info.width ||
        !info.height ||
        info.width % face.columns.length ||
        info.height % face.rows.length
      )
        throw new Error(
          `${theme.id}: atlas dimensions must divide evenly into ${face.columns.length} columns × ${face.rows.length} rows.`,
        );
      results.push(
        `${theme.id}: ${face.columns.length}×${face.rows.length} atlas, ${info.width / face.columns.length}×${info.height / face.rows.length}px per card`,
      );
    } else results.push(`${theme.id}: 52 card files`);
  }
  return results;
}
