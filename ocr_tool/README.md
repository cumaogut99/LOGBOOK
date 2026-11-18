# Görselden Metin Çıkarma (OCR) Aracı

PNG, JPG ve **taranmış PDF** (metni seçilemeyen, sadece görüntü içeren) dosyalardaki yazıları metne çevirir.
PM Logbook uygulamasından bağımsızdır.

- **Motor:** Tesseract. `tesserocr` Python paketinin içinde geldiği için ayrıca bir program kurmanız gerekmez.
- **Derin öğrenme yok:** Varsayılan mod "Klasik" Tesseract motorudur ve sinir ağı kullanmaz.
  İsterseniz arayüzden "LSTM (sinir ağı)" moduna da geçebilirsiniz. LSTM genellikle daha doğrudur, fakat bir sinir ağıdır.
- **Arayüz:** Python ile birlikte gelen `tkinter` kullanılır.

## Kurulum

```bash
pip install -r requirements.txt
```

Türkçe dil dosyası (`tessdata/tur.traineddata`) bu klasörde hazır gelir.
İngilizce de gerekirse:

```bash
pip install tessdata.eng
```

Diğer diller için ilgili `.traineddata` dosyasını `tessdata/` klasörüne koymanız yeterlidir.
Klasik mod için dosyanın `tesseract-ocr/tessdata` deposundan alınması gerekir.
`tessdata_fast` ve `tessdata_best` depolarındaki dosyalar yalnızca LSTM modunda çalışır.

## Çalıştırma

```bash
python app.py
```

Windows'ta `BASLAT.bat` dosyasına çift tıklayarak da açabilirsiniz.

1. **Dosya Seç ve Oku** ile bir PNG, JPG veya PDF dosyası seçin.
2. Metin pencerede görünür. **Kopyala** ile panoya alabilir, **Metni Kaydet** ile `.txt` dosyası olarak saklayabilirsiniz.

PDF'lerde, sayfada seçilebilir metin varsa bu metin doğrudan alınır, çünkü bu yol daha hızlı ve kesindir.
Yalnızca görüntü olan sayfalar 300 DPI'da görüntüye çevrilip OCR ile okunur.

## Daha iyi sonuç için

- Taramaları en az 300 DPI ile yapın.
- Eğik, gölgeli veya düşük kontrastlı görüntülerde doğruluk düşer. Klasik mod bu durumdan LSTM'e göre daha çok etkilenir.
- El yazısı desteklenmez; yalnızca basılı metin okunur.

## Dosyalar

| Dosya | Açıklama |
|---|---|
| `ocr_engine.py` | OCR mantığı (arayüzden bağımsız, test edilebilir) |
| `app.py` | Masaüstü arayüzü |
| `tessdata/` | Dil dosyaları. `tur.traineddata`: Tesseract projesi, Apache 2.0 lisansı |
| `BASLAT.bat` | Windows için başlatıcı |
