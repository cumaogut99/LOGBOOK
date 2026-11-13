# PM Logbook – Geliştirme Kuralları

Bu dosya, bu projede çalışan geliştiriciler ve yapay zekâ asistanları için bağlayıcı kuralları içerir.
Uygulama demo sonrası IT birimine devredilecek; bakımı ve işletmesi orada yapılacaktır.

## 1. Okunabilirlik ve yönetilebilirlik (SonarQube uyumu)

Kod, SonarQube vb. statik analiz araçlarından geçecek ve insanlar tarafından bakımı yapılacaktır.

- Kod önce insan için yazılır: açık isimler, kısa fonksiyonlar, tek sorumluluk.
- Fonksiyonlar mümkünse ~50 satırı geçmesin; derin iç içe `if`/callback yapılarından kaçının (bilişsel karmaşıklık).
- Aynı mantık birden fazla yerde tekrarlanmaz; ortak yardımcı fonksiyona / sabite taşınır.
- Sihirli sayı ve string kullanılmaz; anlamlı sabitler tanımlanır (ör. bakım durumları `server/constants/maintenance.js`).
- Aynı Express rotası iki kez tanımlanmaz. Sabit yollar (`/engines/count`) parametreli yollardan (`/engines/:id`) önce tanımlanır.
- Yeni sunucu kodunda `async/await` ve `server/database.js` içindeki `dbGet`/`dbAll`/`dbRun` kullanılır; yeni callback zinciri yazılmaz.
- Ölü kod, yorum satırına alınmış kod ve kullanılmayan değişken/import bırakılmaz.
- Hata yakalanıp yutulmaz; ya kullanıcıya anlamlı mesaj döner ya da loglanır.
- Hassas veri ve gereksiz detaylı `console.log` (ör. tüm request body) eklenmez.
- Yorumlar "ne" değil "neden" sorusunu cevaplar. Mevcut dil kullanımına uyulur (kullanıcıya dönük metinler Türkçe).
- Değişiklikler küçük ve odaklı tutulur; ilgisiz yeniden düzenleme aynı değişikliğe karıştırılmaz.

## 2. Performans: veri büyüdükçe yavaşlamamalı

- Listeleme uç noktaları büyük tablolar için sayfalama (`limit`/`offset`) ve filtreyi sunucuda destekler; tüm tabloyu çekip istemcide filtrelemekten kaçının.
- `WHERE`, `JOIN` ve `ORDER BY` içinde kullanılan sütunlara indeks eklenir (`server/database.js` içinde `CREATE INDEX IF NOT EXISTS`).
- Döngü içinde sorgu atılmaz (N+1). Gerekirse tek sorguda `IN (...)` / `JOIN` kullanılır.
- Toplu yazma işlemleri transaction içinde yapılır.
- Sayım gibi işlemler veritabanında yapılır (`COUNT(*)`), satırları çekip saymak yerine.
- Büyük alanlar (ör. base64 doküman içeriği) listeleme sorgularında seçilmez; yalnızca detay/indirme uç noktasında döner.
- React tarafında pahalı hesaplamalar `useMemo` ile, uzun listeler sayfalama/sanallaştırma ile ele alınır.
- Geçmiş/log niteliğindeki veriler (aktivite, lokasyon geçmişi vb.) motor kaydındaki JSON alanına eklenmez; indeksli ayrı tabloda tutulur.

## 3. Veritabanı

- Şimdilik **SQLite** kullanılmaya devam edilecek (lokal çalıştırma ve demo için). Kalıcı çözüm IT ile belirlenecek.
- Bu nedenle SQL mümkün olduğunca standart tutulur; SQLite'a özgü özelliklere bağımlılık artırılmaz ki ileride başka veritabanına geçiş kolay olsun.
- Şema değişiklikleri `server/database.js` içinde geriye uyumlu şekilde (`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE ... ADD COLUMN`) yapılır.

## 4. Kapsam dışı (IT yönlendirmesi beklenecek)

- Ağ yapılandırması (CORS, sunucu adresleri, proxy) ve güvenlik konuları (kimlik doğrulama middleware'i, şifre hash'leme, JWT ayarları) IT ile görüşüldükten sonra ele alınacaktır. Bu alanlarda talep olmadan değişiklik yapılmaz.

## Çalıştırma

```bash
npm install && (cd server && npm install)
npm run dev   # backend :5001, frontend :3002
```

Veritabanı dosyası: `server/pm-logbook.db` (ilk çalıştırmada otomatik oluşturulur).
