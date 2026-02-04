import crypto from 'crypto';

/**
 * Generates a unique visitor hash based on blogId, IP, useragent, and current date (YYYYMMDD)
 * The hash changes every 24 hours for the same visitor, which is intentional for daily unique visitor tracking
 * 
 * @param blogId - The blog identifier
 * @param ip - The visitor's IP address
 * @param useragent - The visitor's user agent string
 * @param date - Optional date string in YYYYMMDD format. If not provided, uses current UTC date
 * @returns SHA-256 hash in hexadecimal format
 */
export default function generateVisitorHash(
  blogId: string,
  ip: string,
  useragent: string,
  date?: string
): string {
  // Get current date in YYYYMMDD format if not provided
  const dateStr = date || getCurrentDateYYYYMMDD();
  
  // Combine all components
  const input = `${blogId}|${ip}|${useragent}|${dateStr}`;
  
  // Generate SHA-256 hash
  const hash = crypto.createHash('sha256').update(input).digest('hex');
  
  return hash;
}

/**
 * Gets current UTC date in YYYYMMDD format
 */
function getCurrentDateYYYYMMDD(): string {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  const day = String(now.getUTCDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}


