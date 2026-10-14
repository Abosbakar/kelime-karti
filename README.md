# Kelime Kartı

Aralıklı tekrarla (1, 3, 7, 30, 60, 120, 360 gün) İngilizce kelime öğrenme uygulaması. Spesifikasyon: [SPEC (1).md](<SPEC (1).md>).

## Komutlar

```bash
npm install        # bağımlılıklar
npm run dev        # geliştirme sunucusu (http://localhost:5173), "Geliştirici" paneli burada görünür
npm test           # testler
npm run build      # üretim derlemesi → dist/
npm run preview    # derlenmiş sürümü yerelde sun (service worker burada çalışır)
```

## Telefona kurma

Service worker yalnızca HTTPS (veya localhost) üzerinde çalışır. `npm run build` ile oluşan `dist/` klasörünü
herhangi bir statik barındırmaya yükle (Netlify, Cloudflare Pages, GitHub Pages…). Yollar göreli olduğu için alt
dizinde de çalışır. Sonra telefonda adresi aç:

- **Android (Chrome):** menü → "Ana ekrana ekle" / "Uygulamayı yükle"
- **iPhone (Safari):** Paylaş → "Ana Ekrana Ekle"

İlk açılıştan sonra uygulama internetsiz de çalışır. Yeni sürüm yayınlandığında uygulama içinde "Yeni sürüm hazır"
bildirimi çıkar.

## Veriler

Tüm veriler cihazdaki tarayıcıda (IndexedDB) tutulur; sunucu yoktur. Cihazlar arası eşitleme yoktur.
**Ayarlar → Yedekleme** ile düzenli JSON yedeği al. Ayarlar'daki "kalıcı depolama" izni, tarayıcının yer darlığında
verileri silmesini engeller (ana ekrana eklenmiş uygulamada otomatik istenir).

## Hazır kelime havuzları

`src/pools/<id>.json` dosyalarında `["İngilizce", "Türkçe"]` çiftleri olarak durur (A1–C2, YÖKDİL Sağlık/Fen/Sosyal,
YDS; her biri ~550–730 kelime). Listeler elle derlenmiştir; seviye atamaları yaklaşıktır ve dosyalar doğrudan
düzenlenebilir. `npm test` her havuzda boş satır, tekrar ve CEFR seviyeleri arası çakışma olup olmadığını denetler.
Yeni havuz eklemek için JSON dosyasını koyup `src/pools.ts` içindeki `POOLS` listesine bir satır eklemek yeterli.

## Yapı

| Dosya | İçerik |
| --- | --- |
| `src/scheduler.ts` | Zamanlama algoritması (saf fonksiyonlar) |
| `src/dates.ts` | Takvim günü hesapları |
| `src/db.ts`, `src/repo.ts` | Dexie veritabanı ve işlemler (cevap kaydı, gün kapatma, yedek) |
| `src/importParse.ts`, `src/spreadsheet.ts` | Yapıştırma ve Excel/CSV ayrıştırma |
| `src/answer.ts` | Yazım modu cevap kontrolü |
| `src/stats.ts`, `src/backup.ts` | Ana sayfa istatistikleri, yedek doğrulama |
| `src/pages/`, `src/add/`, `src/study/` | Ekranlar |
| `public/` | Uygulama ikonları |
