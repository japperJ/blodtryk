// EXIF-udtrækningstjeneste
// Læser DateTimeOriginal fra billeder taget med mobilkamera

export interface ExifData {
  dateOriginal: Date | null;
  make: string | null;
  model: string | null;
}

/**
 * Læser EXIF-data fra et File-objekt (client-side)
 * Bruger exifr biblioteket til at udtrække metadata
 */
export async function extractExifData(file: File): Promise<ExifData> {
  try {
    // Dynamisk import af exifr (kun client-side)
    const exifr = (await import('exifr')).default;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const exif = await exifr.parse(buffer);

    if (!exif) {
      return { dateOriginal: null, make: null, model: null };
    }

    // DateTimeOriginal er det primære tidspunkt (når billedet blev taget)
    // DateTime er redigeringstidspunktet
    // CreateDate er oprettelsestidspunktet
    let dateOriginal: Date | null = null;

    if (exif.DateTimeOriginal) {
      dateOriginal = new Date(exif.DateTimeOriginal);
    } else if (exif.CreateDate) {
      dateOriginal = new Date(exif.CreateDate);
    } else if (exif.DateTime) {
      dateOriginal = new Date(exif.DateTime);
    }

    return {
      dateOriginal,
      make: exif.Make || null,
      model: exif.Model || null,
    };
  } catch (error) {
    console.error('EXIF extraction failed:', error);
    return { dateOriginal: null, make: null, model: null };
  }
}

/**
 * Formaterer EXIF-dato til dansk format
 */
export function formatExifDate(date: Date | null): string {
  if (!date) return 'Ukendt tidspunkt';

  return date.toLocaleDateString('da-DK', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Sammenligner to datoer for sortering (nyeste først)
 */
export function compareByDate(a: Date | null, b: Date | null): number {
  if (!a && !b) return 0;
  if (!a) return 1;  // b kommer først
  if (!b) return -1; // a kommer først
  return b.getTime() - a.getTime(); // Nyeste først
}
