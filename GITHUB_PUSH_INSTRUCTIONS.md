# GitHub'a Yükleme Talimatları

## 1. GitHub'da Repository Oluştur

1. https://github.com/new adresine git
2. Repository name: **LOGBOOK**
3. Description: "PM Logbook - Engine Preventive Maintenance Tracking System with SQLite"
4. Public veya Private seç
5. **Create repository**'ye tıkla

## 2. Local Repository'yi GitHub'a Bağla

GitHub'da repository oluşturduktan sonra, GitHub'ın verdiği URL'yi kullan:

```bash
# GitHub repository URL'nizi buraya yazın (örnek)
git remote add origin https://github.com/KULLANICI_ADINIZ/LOGBOOK.git

# veya SSH kullanıyorsanız:
git remote add origin git@github.com:KULLANICI_ADINIZ/LOGBOOK.git
```

## 3. Push ile GitHub'a Yükle

```bash
# Ana branch'i main olarak yeniden adlandır (modern standart)
git branch -M main

# GitHub'a push et
git push -u origin main
```

## Alternatif: Tek Komutla

GitHub'da repository oluşturduktan sonra, aşağıdaki komutu çalıştır:

```bash
git remote add origin https://github.com/KULLANICI_ADINIZ/LOGBOOK.git
git branch -M main
git push -u origin main
```

## GitHub Repository URL'nizi Söyleyin

Repository oluşturduktan sonra URL'yi bana söyleyin, ben komutları çalıştırayım!

Örnek URL'ler:
- HTTPS: `https://github.com/username/LOGBOOK.git`
- SSH: `git@github.com:username/LOGBOOK.git`

