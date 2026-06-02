import React from 'react';
import { terbilangRupiah } from '../lib/terbilang';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface KwitansiPrintProps {
  trx: any;
  profilData: any;
  pejabatList: any;
  onClose?: () => void;
}

export const KwitansiPrint: React.FC<KwitansiPrintProps> = ({ trx, profilData, pejabatList, onClose }) => {
  if (!trx) return null;

  // Lunas Terbayar tgl
  const tglTerbayar = trx.tanggal ? format(new Date(trx.tanggal), 'dd MMMM yyyy', { locale: id }) : '';

  // Get pejabat
  const list = Array.isArray(pejabatList) ? pejabatList : [];
  const namaInstansi = profilData?.namaInstansi || 'Puskesmas Kalitengah';
  
  const getPejabat = (jabatan: string) => list.find(p => p.jabatan.toLowerCase() === jabatan.toLowerCase()) || { nama: '.........................', nip: '.........................' };
  
  const kpa = getPejabat('Kepala');
  const pptk = getPejabat('PPTK');
  const bendahara = getPejabat('Bendahara');
  
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 print:p-0 print:bg-white print:block overflow-auto">
      <div className="bg-white text-black p-8 font-sans w-full max-w-[800px] print-area relative shadow-2xl rounded-sm">
        <div className="absolute top-4 right-4 flex gap-2 print:hidden items-center">
          <span className="text-xs text-red-600 font-medium mr-2 max-w-[200px] text-right">Jika gagal dicetak, buka aplikasi di <b>Tab Baru</b> via icon ↗ di kanan atas layar.</span>
          <button onClick={() => window.print()} className="px-4 py-2 bg-green-600 text-white font-bold rounded-sm text-sm hover:bg-green-700">
            Cetak (Print)
          </button>
          {onClose && (
            <button onClick={onClose} className="px-4 py-2 bg-gray-500 text-white font-bold rounded-sm text-sm hover:bg-gray-600">
              Tutup
            </button>
          )}
        </div>
        
        <div className="mt-8 print:mt-0 print:border-b-2 print:border-black max-w-[800px] mx-auto border-b-2 border-black pb-8">
          {/* Header grid */}
          <div className="grid grid-cols-2 text-sm mb-6 pb-2 mt-4 print:mt-0">
          <div className="grid grid-cols-[120px_10px_1fr]">
            <div>Buku Kas No.</div>
            <div>:</div>
            <div>{trx.bukuKasNoFormatted || "....../BKU/....../...."}</div>
            
            <div className="mt-2">Buat Keperluan</div>
            <div className="mt-2">:</div>
            <div className="mt-2 text-sm">{trx.namaRekening || "..."}</div>
          </div>
          
          <div className="grid grid-cols-[80px_10px_1fr]">
            <div>Buku No</div>
            <div>:</div>
            <div>{trx.bukuNoFormatted || "...."}</div>
            
            <div className="mt-2">Tanggal</div>
            <div className="mt-2">:</div>
            <div className="mt-2">{tglTerbayar}</div>

            <div className="mt-2">Rekening</div>
            <div className="mt-2">:</div>
            <div className="mt-2 text-sm">{trx.kodeRekening}</div>
          </div>
        </div>

        <div className="border border-black text-center font-bold text-xl py-1 mb-6 uppercase tracking-wider">
          TANDA TERIMA
        </div>

        <div className="text-sm space-y-4 mb-12">
          <div className="grid grid-cols-[140px_10px_1fr]">
            <div className="col-span-3 mb-4">
              Menerangkan telah diterima dari : Kepala {namaInstansi}
            </div>

            <div>Banyaknya uang</div>
            <div>:</div>
            <div>Rp <span className="ml-[100px]">{Number(trx.nominal).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>

            <div className="mt-4">Buat Pembayaran</div>
            <div className="mt-4">:</div>
            <div className="mt-4">
              {trx.uraian} dalam rangka Penyediaan Biaya Operasional dan Pemeliharaan Jaminan Kesehatan Nasional Tahun {new Date().getFullYear()}
            </div>

            <div className="mt-4">Terbilang</div>
            <div className="mt-4">:</div>
            <div className="mt-4 italic font-semibold">
              #{terbilangRupiah(Number(trx.nominal))}#
            </div>
          </div>
        </div>

        {/* Footer info & Signatures */}
        <div className="text-sm">
          <div className="flex justify-end mb-4 mr-10">
            <div className="grid grid-cols-[140px_1fr]">
              <div className="text-right mr-4">Terbuat lembar ke</div>
              <div></div>
              <div className="text-right mr-4">Lunas Terbayar tgl.</div>
              <div>{tglTerbayar}</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-8 text-center mt-8">
            <div>
              <div>Mengetahui,</div>
              <div>Kepala {namaInstansi}</div>
              <div>KPA</div>
              <div className="mt-20 border-b border-black inline-block font-bold min-w-[200px]">
                {kpa.nama}
              </div>
              <div className="mt-1">NIP. {kpa.nip}</div>
            </div>
            
            <div>
              <div className="mt-5">Pejabat Pelaksana Teknis</div>
              <div>Kegiatan</div>
              <div className="mt-20 border-b border-black inline-block font-bold min-w-[200px]">
                {pptk.nama}
              </div>
              <div className="mt-1">NIP. {pptk.nip}</div>
            </div>
            
            <div>
              <div className="mt-5">Bendahara Pengeluaran Pembantu</div>
              <div>{namaInstansi}</div>
              <div className="mt-20 border-b border-black inline-block font-bold min-w-[200px]">
                {bendahara.nama}
              </div>
              <div className="mt-1">NIP. {bendahara.nip}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};
