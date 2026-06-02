import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

let serviceAccountAuth: JWT | null = null;
let cachedDoc: GoogleSpreadsheet | null = null;

/**
 * Fungsi untuk memanggil instance Google Spreadsheet yang telah terotentikasi.
 * Fungsi ini memuat seluruh informasi properti tab di awal pemanggilan.
 */
export const connectToSpreadsheet = async (): Promise<GoogleSpreadsheet> => {
  if (cachedDoc) {
    return cachedDoc;
  }

  const spreadsheetId = process.env.GOOGLE_SPREADSHEET_ID || process.env.GOOGLE_SHEET_ID;
  let email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (email) {
    email = email.replace(/^['"]|['"]$/g, ''); 
  }
  let key = process.env.GOOGLE_PRIVATE_KEY;
  if (key) {
    key = key.replace(/\\n/g, '\n');
    key = key.replace(/^['"]|['"]$/g, ''); 
  }
  
  if (!spreadsheetId) {
    throw new Error('Konfigurasi GOOGLE_SHEET_ID belum diatur di environment variables (.env)');
  }

  if (!email || !key) {
    throw new Error('Konfigurasi GOOGLE_SERVICE_ACCOUNT_EMAIL atau GOOGLE_PRIVATE_KEY belum diatur di environment variables (.env)');
  }

  if (!serviceAccountAuth) {
    serviceAccountAuth = new JWT({
      email,
      key,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ],
    });
  }

  const doc = new GoogleSpreadsheet(spreadsheetId, serviceAccountAuth);
  
  try {
    // Memuat data struktur sheet (metadata, judul tab, dll)
    await doc.loadInfo();
    cachedDoc = doc;
    return doc;
  } catch (error: any) {
    console.error('Gagal terhubung ke Google Sheets API:', error);
    throw new Error(`Koneksi database spreadsheet gagal: ${error.message}`);
  }
};