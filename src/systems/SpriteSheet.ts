/**
 * Generic, content-agnostic sprite-sheet loader/drawer.
 *
 * This knows nothing about Centipede specifically — it just loads an image
 * and blits arbitrary cells from a uniform grid onto a canvas with
 * nearest-neighbor scaling (no smoothing, so pixel art stays crisp). Pair
 * it with a `SpriteMapping` (see `spriteMapping.ts`) that says which cell
 * is which sprite/frame for a particular sheet.
 */
export class SpriteSheet {
  private image = new Image();
  loaded = false;
  failed = false;

  constructor(
    url: string,
    public readonly cellWidth: number,
    public readonly cellHeight: number
  ) {
    this.image.onload = () => {
      this.loaded = true;
    };
    this.image.onerror = () => {
      this.failed = true;
    };
    this.image.src = url;
  }

  get ready(): boolean {
    return this.loaded && !this.failed;
  }

  /**
   * Draws the cell at (col, row) into the destination rect. `flip` mirrors
   * horizontally — useful for reusing one drawn facing for both directions
   * instead of needing separate art, the same trick the original hardware
   * used via its flip flags.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    col: number,
    row: number,
    destX: number,
    destY: number,
    destW: number,
    destH: number,
    flip = false
  ): void {
    if (!this.ready) return;
    const sx = col * this.cellWidth;
    const sy = row * this.cellHeight;
    ctx.save();
    if (flip) {
      ctx.translate(Math.round(destX) + destW, Math.round(destY));
      ctx.scale(-1, 1);
      ctx.drawImage(this.image, sx, sy, this.cellWidth, this.cellHeight, 0, 0, destW, destH);
    } else {
      ctx.drawImage(this.image, sx, sy, this.cellWidth, this.cellHeight, Math.round(destX), Math.round(destY), destW, destH);
    }
    ctx.restore();
  }
}
