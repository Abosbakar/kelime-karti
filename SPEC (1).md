# Kelime Kartı Uygulaması — Proje Spesifikasyonu

Bu dosya projenin tek doğruluk kaynağıdır. Kodlamaya başlamadan önce tamamını oku, önce zamanlama algoritmasını ve testlerini yaz, sonra arayüze geç.

## 1\. Amaç

İngilizce kelime öğrenmek için kişisel bir flashcard uygulaması. Kullanıcı her gün istediği kadar kart ekler. Kartlar eklendikleri tarihe göre gruplanır ve sabit aralıklarla (1, 3, 7, 30, 60, 120, 360 gün) tekrar sorulur. Bilinmeyen veya cevaplanmayan kartlar bir kademe geriye düşer.

İki bağımsız öğrenme modu var:

- **Tanıma modu:** İngilizce kelime gösterilir, kullanıcı anlamını hatırlar.  
- **Yazım modu:** Türkçe anlam gösterilir, kullanıcı İngilizcesini yazar.

## 2\. Teknoloji

- React \+ TypeScript \+ Vite  
- PWA olarak çalışmalı (telefona "ana ekrana ekle", çevrimdışı çalışma)  
- Veri: IndexedDB, Dexie.js üzerinden. Backend yok, tek kullanıcı.  
- Excel okuma: SheetJS (`xlsx`)  
- Testler: Vitest  
- Tarihler yerel saat diliminde `YYYY-MM-DD` string olarak tutulur. Gün farkı hesapları saat bilgisi olmadan, sadece takvim günü üzerinden yapılır.

## 3\. Veri Modeli

type Mode \= 'recognition' | 'writing';

interface Card {

  id: string;

  term: string;          // İngilizce

  definition: string;    // Türkçe

  example?: string;      // opsiyonel örnek cümle

  createdDate: string;   // YYYY-MM-DD, eklendiği gün (değişmez)

  progress: Record\<Mode, Progress\>;

}

interface Progress {

  stage: number;         // 0..7, geçilen kontrol sayısı

  anchorDate: string;    // YYYY-MM-DD, kelimenin "öğrenilmiş sayıldığı" gün

  mastered: boolean;     // stage \=== 7

}

interface ReviewLog {

  cardId: string;

  mode: Mode;

  date: string;

  checkStage: number;    // hangi kontrol (1..7)

  result: 'correct' | 'wrong' | 'missed';

}

interface Meta {

  lastProcessedDate: string; // en son "kapatılan" gün

}

Yeni kartta her iki mod için: `stage = 0`, `anchorDate = createdDate`, `mastered = false`.

## 4\. Zamanlama Algoritması (en kritik kısım)

Aralıklar dizisi: `I = [0, 1, 3, 7, 30, 60, 120, 360]`.

`stage = s` olan bir kart, `s + 1` numaralı kontrolü bekliyordur. Bu kontrolün tarihi:

dueDate \= anchorDate \+ I\[s \+ 1\]

**Doğru cevap (dueDate günü):**

- `stage = s + 1`, `anchorDate` değişmez.  
- `stage === 7` olursa `mastered = true` ve kart artık sorulmaz.

**Yanlış cevap veya cevapsız (dueDate günü D):**

- `anchorDate = D` olur. Kart, düştüğü günün kelimesi sayılır.  
- `stage = max(s − 1, 0)` olur. Kart bir alt kategoriye düşer.  
- Sonuç olarak bir sonraki soru `D + I[s]` gününde gelir. Örneğin 3 günlük kategoriden düşen kart 1 gün sonra, 7 günlükten düşen 3 gün sonra, 30 günlükten düşen 7 gün sonra sorulur.  
- `s = 0` iken (1 günlük kontrolde düşerse): `stage = 0`, `anchorDate = D`, kart ertesi gün tekrar sorulur.  
- Kart düştükten sonra yeni çapa tarihinden itibaren normal akışa devam eder. Sonraki kontroller `anchorDate + I[stage + 1]` formülüyle hesaplanır.

**Kaçırılan günler:** Uygulama her açıldığında `lastProcessedDate + 1` gününden dünün tarihine kadar her gün sırayla işlenir. O gün `dueDate`'i gelmiş ve cevaplanmamış her kart, o gün için `missed` (yanlış) sayılır ve yukarıdaki kural uygulanır. Yeni hesaplanan `dueDate` yine geçmişte kalıyorsa, o gün geldiğinde döngü onu da işler. Böylece birden fazla gün girilmezse kart art arda düşebilir. Ardından `lastProcessedDate = dün` yapılır.

**Bugün:** `dueDate <= bugün` olan kartlar bugünün oturumunda sorulur. Bugün cevaplanmayanlar, gün bitip uygulama ertesi açıldığında `missed` olarak işlenir.

Algoritma saf (pure) fonksiyonlar olarak `src/scheduler.ts` içinde yazılmalı. Veritabanı veya UI bağımlılığı olmamalı.

### Zorunlu test senaryoları

1. **Kullanıcının örneği (a):** 13 Ağustos'ta eklenen kart 14 Ağustos'ta doğru biliniyor (stage 1). 16 Ağustos'ta bilinmiyor. Beklenen sonuç: `anchorDate = 16 Ağustos`, `stage = 0`, sonraki soru 17 Ağustos. 17'de doğru bilinirse sonraki 19 Ağustos.  
2. **Kullanıcının örneği (b):** 9 Ağustos'ta eklenen kart 10 ve 12 Ağustos'ta doğru biliniyor (stage 2). 16 Ağustos'ta bilinmiyor. Beklenen sonuç: `anchorDate = 16 Ağustos`, `stage = 1`, sonraki soru 19 Ağustos. 19'da doğru bilinirse sonraki 23 Ağustos (16 \+ 7).  
3. **Stage 0 hata:** Kart eklendiği günün ertesi bilinmiyor. Ertesi gün tekrar sorulmalı.  
4. **Art arda kaçırma:** Kullanıcı 5 gün hiç girmiyor. Gün gün işleme sonucunda beklenen kademeler doğru hesaplanmalı.  
5. **Ustalık:** 7 kontrolü de geçen kart `mastered` olmalı ve bir daha sorulmamalı.  
6. **Mod bağımsızlığı:** Yazım modundaki hata, tanıma modundaki ilerlemeyi etkilememeli.

Ayrıca geliştirme için "bugünün tarihini simüle et" ayarı olsun. Sadece dev modda görünsün.

## 5\. Kart Ekleme

Üç yöntem:

1. **Tek tek ekleme:** İngilizce, Türkçe ve opsiyonel örnek cümle alanları. Enter ile kaydedip bir sonrakine geçilebilmeli.  
2. **Excel'den ekleme (.xlsx / .csv):** 1\. sütun İngilizce, 2\. sütun Türkçe, opsiyonel 3\. sütun örnek cümle. İlk satır başlık gibi görünüyorsa atlama seçeneği sunulmalı.  
3. **Yapıştırarak ekleme (Quizlet tarzı):** Büyük bir metin kutusu ve iki ayırıcı seçimi:  
   - Terim ile tanım arası: **Tab** (varsayılan) / **Virgül** / **Özel** (kullanıcı yazar)  
   - Kartlar arası: **Yeni satır** (varsayılan) / **Noktalı virgül** / **Özel**

Tüm toplu eklemelerde kaydetmeden önce önizleme tablosu gösterilmeli: kaç kart algılandı, hatalı satırlar ve aynı kelimenin zaten var olması durumunda uyarı. Kullanıcı tek tek satır silebilmeli.

Eklenen kartın `createdDate` değeri varsayılan olarak bugündür.

## 6\. Çalışma Ekranları

**Ana sayfa:**

- Bugün sorulacak kart sayısı, iki mod için ayrı ayrı ve kademe bazında: "1 gün önceki: 12, 3 gün önceki: 8, …"  
- Bugün eklenen kart sayısı  
- Toplam kart, ustalaşılan kart sayısı  
- "Tanıma çalış" ve "Yazım çalış" butonları

**Tanıma modu:**

- İngilizce gösterilir, karta dokununca Türkçesi açılır.  
- "Bildim" / "Bilemedim" butonları. Klavyede 1/2 kısayolları olmalı.

**Yazım modu:**

- Türkçe gösterilir, kullanıcı İngilizcesini yazar.  
- Kontrol: küçük/büyük harf duyarsız, baş/son boşluklar kırpılır.  
- Tanımda `/` ile ayrılmış birden fazla doğru cevap varsa hepsi kabul edilir.  
- Yanlışsa doğru cevap gösterilir.  
- Yazım hatası durumları için "Aslında doğruydu" butonu olmalı, sonucu doğruya çevirir.

**Oturum:**

- Kartlar karışık sırada gelir.  
- Oturum yarıda bırakılabilir, verilen cevaplar anında kaydedilir.  
- Bitişte özet gösterilir: doğru, yanlış, kademesi düşen kart sayısı.

## 7\. Diğer

- **Kart listesi:** Ekleme tarihine göre gruplu. Arama, düzenleme ve silme yapılabilmeli. Her kartın iki moddaki kademesi görünmeli.  
- **Yedekleme:** Tüm verinin JSON olarak dışa ve içe aktarılması.  
- **Arayüz:** Mobil öncelikli tasarım, koyu/açık tema.

## 8\. Geliştirme Sırası

1. `scheduler.ts` ve 4\. bölümdeki testler (hepsi geçmeli)  
2. Veri katmanı (Dexie) ve gün işleme (kaçırılan günler)  
3. Kart ekleme: tek tek, yapıştırma, Excel  
4. Tanıma modu, ardından yazım modu  
5. Ana sayfa istatistikleri, kart listesi, yedekleme  
6. PWA ayarları (manifest, service worker)

Her adımdan sonra çalışan bir sürüm olmalı.